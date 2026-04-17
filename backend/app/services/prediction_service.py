"""
Glucose Prediction Service
Multi-variate LSTM trained on the patient's own readings + lifestyle context.
Features: glucose, hour_of_day, carbs_last_2h, activity_last_2h, sleep_hours.
Lifestyle/daily-log features fall back to profile baseline or zero when missing.
Also detects patch malfunctions and generates AI advice via Groq (LLaMA 3.3).
"""

from sklearn.preprocessing import MinMaxScaler
from firebase_admin import firestore
import numpy as np
import json
import urllib.request
import urllib.error
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()


# ==========================================
# Constants
# ==========================================

MIN_READINGS = 15
SEQUENCE_LENGTH = 10
N_FEATURES = 5                  # glucose, hour, carbs_2h, activity_2h, sleep
PATCH_ERROR_THRESHOLD = 40      # % deviation from prediction → patch error
CGM_MAX_CHANGE = 30             # max mg/dL change for CGM readings
MANUAL_MAX_CHANGE = 80          # max mg/dL change for manual readings

ACTIVITY_LEVEL_MAP = {"low": 0.2, "moderate": 0.5, "high": 0.8}

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


# ==========================================
# Prediction Service
# ==========================================

class PredictionService:

    def __init__(self):
        self.db = firestore.client()

    # ==========================================
    # Fetch Glucose Readings
    # ==========================================

    def _fetch_readings(self, user_id: str) -> list[dict]:
        docs = (
            self.db.collection("glucose_readings")
            .where("userId", "==", user_id)
            .stream()
        )
        readings = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            readings.append(data)

        readings.sort(
            key=lambda r: r.get("measuredAt") or datetime.min.replace(tzinfo=timezone.utc)
        )
        return readings

    # ==========================================
    # Fetch Lifestyle Profile
    # ==========================================

    def _fetch_lifestyle_profile(self, user_id: str) -> dict:
        """
        Returns activity_level and sleep_hours_baseline from user profile.
        Falls back to safe defaults if not set.
        """
        try:
            doc = self.db.collection("users").document(user_id).get()
            if doc.exists:
                lifestyle = doc.to_dict().get("lifestyle", {})
                sleep = lifestyle.get("sleep_hours")
                return {
                    "activity_level": lifestyle.get("activity_level", "moderate"),
                    "sleep_hours_baseline": float(sleep) if sleep else 7.0,
                }
        except Exception:
            pass
        return {"activity_level": "moderate", "sleep_hours_baseline": 7.0}

    # ==========================================
    # Fetch Daily Log Context
    # ==========================================

    def _fetch_daily_log_context(self, user_id: str) -> dict:
        """
        Fetches all meals, activities, and sleep logs for the user.
        Used to compute per-reading context features.
        """
        def _ensure_tz(ts):
            if ts and hasattr(ts, "tzinfo") and ts.tzinfo is None:
                return ts.replace(tzinfo=timezone.utc)
            return ts

        meals, activities, sleep_logs = [], [], []

        for doc in self.db.collection("meals").where("userId", "==", user_id).stream():
            d = doc.to_dict()
            ts = _ensure_tz(d.get("timestamp"))
            if ts:
                meals.append({"ts": ts, "carbs": float(d.get("carbs", 0))})

        for doc in self.db.collection("activities").where("userId", "==", user_id).stream():
            d = doc.to_dict()
            ts = _ensure_tz(d.get("timestamp"))
            if ts:
                activities.append({"ts": ts, "minutes": float(d.get("duration_minutes", 0))})

        for doc in self.db.collection("sleep_logs").where("userId", "==", user_id).stream():
            d = doc.to_dict()
            ts = _ensure_tz(d.get("timestamp"))
            if ts:
                sleep_logs.append({"ts": ts, "hours": float(d.get("sleep_hours", 0))})

        sleep_logs.sort(key=lambda x: x["ts"])
        return {"meals": meals, "activities": activities, "sleep_logs": sleep_logs}

    # ==========================================
    # Compute Context Features for One Reading
    # ==========================================

    def _context_for_reading(
        self, reading: dict, log_ctx: dict, sleep_baseline: float
    ) -> tuple[float, float, float, float]:
        """
        Returns (hour_of_day, carbs_2h, activity_min_2h, sleep_hours) for a reading.
        Falls back to 0 / baseline when daily logs are missing.
        """
        ts = reading.get("measuredAt")
        if ts is None:
            return 12.0, 0.0, 0.0, sleep_baseline
        if hasattr(ts, "tzinfo") and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        window_start = ts - timedelta(hours=2)
        hour = float(ts.hour)

        carbs_2h = sum(
            m["carbs"] for m in log_ctx["meals"]
            if window_start <= m["ts"] <= ts
        )
        activity_2h = sum(
            a["minutes"] for a in log_ctx["activities"]
            if window_start <= a["ts"] <= ts
        )

        # Most recent sleep log before this reading, else use baseline
        past_sleep = [s for s in log_ctx["sleep_logs"] if s["ts"] <= ts]
        sleep_hours = past_sleep[-1]["hours"] if past_sleep else sleep_baseline

        return hour, carbs_2h, activity_2h, sleep_hours

    # ==========================================
    # Remove Outliers
    # ==========================================

    def _remove_outliers(self, readings: list[dict]) -> list[dict]:
        if not readings:
            return readings
        cleaned = [readings[0]]
        for i in range(1, len(readings)):
            current = readings[i]
            prev_value = cleaned[-1]["value"]
            curr_value = current["value"]
            max_change = CGM_MAX_CHANGE if current.get("source") == "libreview" else MANUAL_MAX_CHANGE
            if abs(curr_value - prev_value) > max_change:
                fixed = dict(current)
                fixed["value"] = prev_value
                cleaned.append(fixed)
            else:
                cleaned.append(current)
        return cleaned

    # ==========================================
    # Calculate Trend
    # ==========================================

    def _calculate_trend(self, values: list[float]) -> str:
        if len(values) < 2:
            return "stable"
        recent = values[-5:]
        changes = [recent[i] - recent[i - 1] for i in range(1, len(recent))]
        avg = sum(changes) / len(changes)
        if avg > 2:
            return "rising"
        if avg < -2:
            return "falling"
        return "stable"

    # ==========================================
    # Detect Patch Error
    # ==========================================

    def _detect_patch_error(self, actual: float, predicted: float) -> bool:
        if predicted == 0:
            return False
        return abs(actual - predicted) / predicted * 100 > PATCH_ERROR_THRESHOLD

    # ==========================================
    # Multi-variate LSTM Prediction
    # ==========================================

    def _predict_lstm(self, feature_matrix: np.ndarray, hours: int = 1) -> float:
        """
        Multi-variate LSTM.
        feature_matrix: shape (n_readings, 5)
          col 0 — glucose
          col 1 — hour_of_day
          col 2 — carbs_last_2h
          col 3 — activity_min_last_2h
          col 4 — sleep_hours

        Only glucose is predicted recursively.
        Other features are held at their last known values for future steps,
        except hour_of_day which advances by 1h per step.
        """
        import tensorflow as tf
        tf.random.set_seed(42)
        np.random.seed(42)

        n = feature_matrix.shape[0]

        # ── Normalize ──────────────────────────────────────────────────────
        glucose_scaler = MinMaxScaler(feature_range=(0, 1))
        glucose_scaled = glucose_scaler.fit_transform(
            feature_matrix[:, 0:1]
        ).flatten()

        hour_scaled     = feature_matrix[:, 1] / 24.0
        carbs_scaled    = np.clip(feature_matrix[:, 2] / 150.0, 0.0, 1.0)
        activity_scaled = np.clip(feature_matrix[:, 3] / 120.0, 0.0, 1.0)
        sleep_scaled    = np.clip(feature_matrix[:, 4] / 12.0,  0.0, 1.0)

        scaled = np.stack(
            [glucose_scaled, hour_scaled, carbs_scaled, activity_scaled, sleep_scaled],
            axis=1,
        )  # (n, 5)

        # ── Build sequences ────────────────────────────────────────────────
        X, y = [], []
        for i in range(n - SEQUENCE_LENGTH):
            X.append(scaled[i: i + SEQUENCE_LENGTH])
            y.append(glucose_scaled[i + SEQUENCE_LENGTH])

        X = np.array(X)   # (samples, SEQ, 5)
        y = np.array(y)   # (samples,)

        # ── Model ──────────────────────────────────────────────────────────
        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(32, input_shape=(SEQUENCE_LENGTH, N_FEATURES)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        model.fit(X, y, epochs=30, batch_size=8, verbose=0)

        # ── Recursive prediction ───────────────────────────────────────────
        seq = list(scaled[-SEQUENCE_LENGTH:])
        last_hour_raw = feature_matrix[-1, 1]          # actual last hour (0-23)
        last_context  = scaled[-1, 2:].copy()          # [carbs, activity, sleep]

        predicted_glucose_scaled = None
        for step in range(hours):
            inp = np.array(seq[-SEQUENCE_LENGTH:]).reshape(1, SEQUENCE_LENGTH, N_FEATURES)
            predicted_glucose_scaled = float(model.predict(inp, verbose=0)[0][0])

            next_hour = ((last_hour_raw + step + 1) % 24) / 24.0
            next_row = np.concatenate(
                [[predicted_glucose_scaled, next_hour], last_context]
            )
            seq.append(next_row)

        predicted_value = float(
            glucose_scaler.inverse_transform([[predicted_glucose_scaled]])[0][0]
        )
        return round(predicted_value, 1)

    # ==========================================
    # AI Advice via Groq
    # ==========================================

    def _get_ai_advice(
        self,
        patient_name: str,
        current: float,
        predicted: float,
        trend: str,
        alert_type: str,
        hours: int,
        lang: str = "ar",
        lifestyle_ctx: dict | None = None,
    ) -> dict | None:
        if not GROQ_API_KEY:
            return None

        lang_instruction = {
            "ar": "Respond ONLY in Arabic.",
            "en": "Respond ONLY in English.",
            "he": "Respond ONLY in Hebrew.",
        }.get(lang, "Respond ONLY in Arabic.")

        # Build lifestyle context block for the prompt
        ctx_lines = ""
        if lifestyle_ctx:
            carbs   = lifestyle_ctx.get("carbs_2h", 0)
            act_min = lifestyle_ctx.get("activity_2h", 0)
            sleep   = lifestyle_ctx.get("sleep_hours", 7)
            act_lvl = lifestyle_ctx.get("activity_level", "moderate")
            ctx_lines = f"""
Lifestyle context (last 2 hours / baseline):
- Carbs consumed: {carbs:.0f} g
- Activity: {act_min:.0f} minutes
- Sleep last night: {sleep:.1f} hours
- General activity level: {act_lvl}"""

        prompt = f"""You are a medical assistant specialized in Type 2 diabetes patients.
{lang_instruction}

Patient data:
- Name: {patient_name}
- Current glucose: {current} mg/dL
- Trend: {trend}
- Predicted glucose in {hours} hour(s): {predicted} mg/dL
- Alert type: {alert_type}{ctx_lines}

Write two short pieces of advice (1-2 sentences each):
1. For the patient: what should they do right now?
2. For a family member: how can they help the patient?

Reply in JSON format only:
{{"patient": "...", "family": "..."}}"""

        try:
            body = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 300,
            }).encode()
            req = urllib.request.Request(
                GROQ_URL,
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "User-Agent": "DiaConnectFamily/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode())
                text = result["choices"][0]["message"]["content"]
                text = text.strip().strip("```json").strip("```").strip()
                return json.loads(text)
        except urllib.error.HTTPError as e:
            print(f"Groq advice error: {e.code} - {e.read().decode()}")
            return None
        except Exception as e:
            print(f"Groq advice error: {e}")
            return None

    # ==========================================
    # Determine Alert Type
    # ==========================================

    def _get_alert_type(
        self, current: float, predicted: float, patch_error: bool
    ) -> str | None:
        if patch_error:
            return "patch_error"
        if current < 100 or predicted < 100:
            return "low"
        if current > 150 or predicted > 150:
            return "high"
        return None

    # ==========================================
    # Main Predict Method
    # ==========================================

    def predict(self, user_id: str, patient_name: str, hours: int = 1, lang: str = "ar") -> dict:
        """
        Full pipeline:
        1. Fetch glucose readings + lifestyle profile + daily logs
        2. Remove outliers
        3. Build multi-variate feature matrix per reading
        4. Train multi-variate LSTM and predict
        5. Detect patch error
        6. Determine alert type
        7. Get Groq AI advice with lifestyle context if alert
        """
        raw_readings = self._fetch_readings(user_id)
        cleaned_readings = self._remove_outliers(raw_readings)

        if len(cleaned_readings) < MIN_READINGS:
            return {
                "predicted_value": None,
                "hours": hours,
                "trend": None,
                "alert_type": None,
                "advice": None,
                "readings_used": len(cleaned_readings),
                "message": f"بيانات غير كافية — يلزم {MIN_READINGS} قراءة على الأقل، لديك {len(cleaned_readings)} فقط.",
            }

        # ── Fetch context ──────────────────────────────────────────────────
        profile  = self._fetch_lifestyle_profile(user_id)
        log_ctx  = self._fetch_daily_log_context(user_id)
        sleep_bl = profile["sleep_hours_baseline"]

        # ── Build feature matrix ───────────────────────────────────────────
        rows = []
        for r in cleaned_readings:
            hour, carbs, activity, sleep = self._context_for_reading(r, log_ctx, sleep_bl)
            rows.append([r["value"], hour, carbs, activity, sleep])

        feature_matrix = np.array(rows, dtype=np.float32)

        # ── Patch error check ──────────────────────────────────────────────
        raw_last = raw_readings[-1]["value"] if raw_readings else None
        last_was_outlier = raw_last is not None and raw_last != cleaned_readings[-1]["value"]

        values  = feature_matrix[:, 0].tolist()
        current = raw_last if raw_last is not None else values[-1]

        predicted   = self._predict_lstm(feature_matrix, hours)
        trend       = self._calculate_trend(values)
        patch_error = last_was_outlier or self._detect_patch_error(current, predicted)
        alert_type  = self._get_alert_type(current, predicted, patch_error)

        # ── Latest lifestyle context for Groq prompt ───────────────────────
        _, last_carbs, last_activity, last_sleep = self._context_for_reading(
            cleaned_readings[-1], log_ctx, sleep_bl
        )
        lifestyle_ctx = {
            "carbs_2h":       last_carbs,
            "activity_2h":    last_activity,
            "sleep_hours":    last_sleep,
            "activity_level": profile["activity_level"],
        }

        advice = None
        if alert_type:
            advice = self._get_ai_advice(
                patient_name=patient_name,
                current=current,
                predicted=predicted,
                trend=trend,
                alert_type=alert_type,
                hours=hours,
                lang=lang,
                lifestyle_ctx=lifestyle_ctx,
            )

        return {
            "predicted_value": predicted,
            "hours": hours,
            "trend": trend,
            "alert_type": alert_type,
            "advice": advice,
            "readings_used": len(values),
            "message": None,
        }


prediction_service = PredictionService()
