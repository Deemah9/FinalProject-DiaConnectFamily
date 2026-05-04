"""
Glucose Prediction Service — v3 (dual prediction: LSTM + historical pattern)

Prediction modes
----------------
real_time  : fresh data (<6 h)  → LSTM only
hybrid     : data 6–24 h old    → LSTM + staleness warning
pattern    : data >24 h old     → historical pattern only (LSTM disabled)
none       : <MIN_READINGS      → no prediction possible

Pattern analysis
----------------
Groups the last 30 days of readings into a ±1.5-hour circular window
around the current time, applies recency weighting (1/(days_ago+1)),
and computes a weighted average + IQR (p25/p75) on raw values.
"""

import os
import json
import urllib.request
import urllib.error
import numpy as np
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from firebase_admin import firestore
from app.services.family_service import send_prediction_alert, send_stale_pattern_alert

load_dotenv()

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"


# ==========================================
# Constants
# ==========================================

MIN_READINGS          = 10
SEQUENCE_LENGTH       = 12
N_FEATURES            = 6
GLUCOSE_MIN           = 40.0
GLUCOSE_MAX           = 600.0
PATCH_ERROR_THRESHOLD = 40
CGM_MAX_CHANGE        = 30
MANUAL_MAX_CHANGE     = 80
AUGMENT_COPIES        = 3
FINETUNE_EPOCHS       = 15
FINETUNE_LR           = 5e-4
MAX_STALE_HOURS       = 24
PATTERN_DAYS          = 30
PATTERN_HOUR_WINDOW   = 1.5   # ±1.5 h circular window
PATTERN_MIN_SAMPLES   = 5

ALERT_RATE_LIMIT: dict[str, int] = {
    "low":         60,   # minutes between same-type alerts
    "high":        60,
    "patch_error": 120,
    "pattern_low":  180,
    "pattern_high": 180,
    "pattern_variable": 240,
}

ACTIVITY_LEVEL_MAP = {"low": 0.2, "moderate": 0.5, "high": 0.8}
GROQ_API_KEY       = os.getenv("GROQ_API_KEY", "")
GROQ_URL           = "https://api.groq.com/openai/v1/chat/completions"
BASE_MODEL_PATH    = Path(__file__).parent.parent.parent / "models" / "base_model.keras"


# ==========================================
# Prediction Service
# ==========================================

class PredictionService:

    _model_cache:     dict = {}   # user_id → {model, n_readings, sigma}
    _base_weights           = None
    _last_alert_sent: dict = {}   # "{user_id}:{alert_type}" → datetime

    def __init__(self):
        self.db = firestore.client()

    # ==========================================
    # Rate Limiting
    # ==========================================

    def _can_send_alert(self, user_id: str, alert_type: str) -> bool:
        window = ALERT_RATE_LIMIT.get(alert_type, 60)
        key    = f"{user_id}:{alert_type}"
        last   = PredictionService._last_alert_sent.get(key)
        if last is None:
            return True
        return (datetime.now(timezone.utc) - last).total_seconds() / 60 >= window

    def _mark_alert_sent(self, user_id: str, alert_type: str) -> None:
        PredictionService._last_alert_sent[f"{user_id}:{alert_type}"] = datetime.now(timezone.utc)

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
        try:
            doc = self.db.collection("users").document(user_id).get()
            if doc.exists:
                lifestyle = doc.to_dict().get("lifestyle", {})
                sleep = lifestyle.get("sleep_hours")
                return {
                    "activity_level":       lifestyle.get("activity_level", "moderate"),
                    "sleep_hours_baseline": float(sleep) if sleep else 7.0,
                }
        except Exception:
            pass
        return {"activity_level": "moderate", "sleep_hours_baseline": 7.0}

    # ==========================================
    # Fetch Daily Log Context
    # ==========================================

    def _fetch_daily_log_context(self, user_id: str) -> dict:
        def _ensure_tz(ts):
            if ts and hasattr(ts, "tzinfo") and ts.tzinfo is None:
                return ts.replace(tzinfo=timezone.utc)
            return ts

        meals, activities, sleep_logs = [], [], []

        for doc in self.db.collection("meals").where("userId", "==", user_id).stream():
            d  = doc.to_dict()
            ts = _ensure_tz(d.get("timestamp"))
            if ts:
                meals.append({"ts": ts, "carbs": float(d.get("carbs", 0))})

        for doc in self.db.collection("activities").where("userId", "==", user_id).stream():
            d  = doc.to_dict()
            ts = _ensure_tz(d.get("timestamp"))
            if ts:
                activities.append({"ts": ts, "minutes": float(d.get("duration_minutes", 0))})

        for doc in self.db.collection("sleep_logs").where("userId", "==", user_id).stream():
            d  = doc.to_dict()
            ts = _ensure_tz(d.get("timestamp"))
            if ts:
                sleep_logs.append({"ts": ts, "hours": float(d.get("sleep_hours", 0))})

        sleep_logs.sort(key=lambda x: x["ts"])
        return {"meals": meals, "activities": activities, "sleep_logs": sleep_logs}

    # ==========================================
    # Context Features for One Reading
    # ==========================================

    def _context_for_reading(
        self, reading: dict, log_ctx: dict, sleep_baseline: float
    ) -> tuple[float, float, float, float, float]:
        ts = reading.get("measuredAt")
        if ts is None:
            return 12.0, 0.0, 0.0, 0.0, sleep_baseline
        if hasattr(ts, "tzinfo") and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        window_2h_start  = ts - timedelta(hours=2)
        window_30m_start = ts - timedelta(minutes=30)
        hour = float(ts.hour) + float(ts.minute) / 60.0

        carbs_30min = sum(
            m["carbs"] for m in log_ctx["meals"]
            if window_30m_start <= m["ts"] <= ts
        )
        carbs_2h = sum(
            m["carbs"] for m in log_ctx["meals"]
            if window_2h_start <= m["ts"] < window_30m_start
        )
        activity_2h = sum(
            a["minutes"] for a in log_ctx["activities"]
            if window_2h_start <= a["ts"] <= ts
        )
        past_sleep  = [s for s in log_ctx["sleep_logs"] if s["ts"] <= ts]
        sleep_hours = past_sleep[-1]["hours"] if past_sleep else sleep_baseline

        return hour, carbs_30min, carbs_2h, activity_2h, sleep_hours

    # ==========================================
    # Remove Outliers
    # ==========================================

    def _remove_outliers(self, readings: list[dict]) -> list[dict]:
        if not readings:
            return readings
        cleaned = [readings[0]]
        for i in range(1, len(readings)):
            current  = readings[i]
            prev     = cleaned[-1]
            is_cgm   = current.get("source") in ("libreview", "csv")
            base_max = CGM_MAX_CHANGE if is_cgm else MANUAL_MAX_CHANGE

            prev_ts = prev.get("measuredAt")
            curr_ts = current.get("measuredAt")
            if prev_ts and curr_ts:
                if hasattr(prev_ts, "tzinfo") and prev_ts.tzinfo is None:
                    prev_ts = prev_ts.replace(tzinfo=timezone.utc)
                if hasattr(curr_ts, "tzinfo") and curr_ts.tzinfo is None:
                    curr_ts = curr_ts.replace(tzinfo=timezone.utc)
                hours_gap = abs((curr_ts - prev_ts).total_seconds()) / 3600
                max_change = base_max * max(1.0, hours_gap / 0.5)
            else:
                max_change = base_max

            if abs(current["value"] - prev["value"]) > max_change:
                fixed = dict(current)
                fixed["value"] = prev["value"]
                cleaned.append(fixed)
            else:
                cleaned.append(current)
        return cleaned

    # ==========================================
    # Trend + Probability
    # ==========================================

    def _calculate_trend(self, current: float, predicted: float) -> str:
        diff = predicted - current
        if diff > 5:   return "rising"
        if diff < -5:  return "falling"
        return "stable"

    def _calculate_probability(self, current: float, predicted: float, sigma: float) -> tuple[int, int]:
        from math import erf, sqrt
        sigma   = max(1.0, sigma)
        z       = (predicted - current) / sigma
        prob_up = (1.0 + erf(z / sqrt(2))) / 2.0
        prob_up   = int(min(99, max(1, round(prob_up * 100))))
        return prob_up, 100 - prob_up

    # ==========================================
    # Patch Error Detection
    # ==========================================

    # ==========================================
    # Normalise / Denormalise
    # ==========================================

    @staticmethod
    def _normalise(feature_matrix: np.ndarray) -> np.ndarray:
        g_norm   = (feature_matrix[:, 0] - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN)
        h_norm   = feature_matrix[:, 1] / 24.0
        c30_norm = np.clip(feature_matrix[:, 2] / 100.0, 0.0, 1.0)
        c2h_norm = np.clip(feature_matrix[:, 3] / 150.0, 0.0, 1.0)
        a_norm   = np.clip(feature_matrix[:, 4] / 120.0, 0.0, 1.0)
        s_norm   = np.clip(feature_matrix[:, 5] / 12.0,  0.0, 1.0)
        return np.stack([g_norm, h_norm, c30_norm, c2h_norm, a_norm, s_norm], axis=1)

    @staticmethod
    def _denormalise_glucose(val: float) -> float:
        return float(np.clip(val, 0.0, 1.0)) * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN

    # ==========================================
    # Load Base Model (once)
    # ==========================================

    def _get_base_model(self):
        import tensorflow as tf
        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(64, input_shape=(SEQUENCE_LENGTH, N_FEATURES)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ], name="glucose_lstm")

        if PredictionService._base_weights is None and BASE_MODEL_PATH.exists():
            try:
                tmp = tf.keras.models.load_model(str(BASE_MODEL_PATH))
                PredictionService._base_weights = tmp.get_weights()
                print(f"✅ Base model weights loaded from {BASE_MODEL_PATH}")
            except Exception as e:
                print(f"⚠️  Could not load base model: {e}")

        if PredictionService._base_weights is not None:
            model(np.zeros((1, SEQUENCE_LENGTH, N_FEATURES), dtype=np.float32))
            model.set_weights(PredictionService._base_weights)

        return model

    # ==========================================
    # LSTM Prediction
    # ==========================================

    def _predict_lstm(
        self,
        feature_matrix: np.ndarray,
        user_id: str,
        hours: int = 1,
        seed_override: np.ndarray | None = None,
    ) -> tuple[float, float]:
        import tensorflow as tf
        tf.random.set_seed(42)
        np.random.seed(42)

        n      = feature_matrix.shape[0]
        scaled = self._normalise(feature_matrix)

        X, y = [], []
        for i in range(n - SEQUENCE_LENGTH):
            X.append(scaled[i: i + SEQUENCE_LENGTH])
            y.append(scaled[i + SEQUENCE_LENGTH, 0])
        X = np.array(X, dtype=np.float32)
        y = np.array(y, dtype=np.float32)

        split       = max(1, int(len(X) * 0.8))
        X_raw_train, X_val = X[:split], X[split:]
        y_raw_train, y_val = y[:split], y[split:]

        X_aug, y_aug = [X_raw_train], [y_raw_train]
        for _ in range(AUGMENT_COPIES - 1):
            noise = np.random.normal(0, 0.01, X_raw_train.shape).astype(np.float32)
            X_aug.append(X_raw_train + noise)
            y_aug.append(y_raw_train)
        X_train = np.concatenate(X_aug)
        y_train = np.concatenate(y_aug)

        cache = PredictionService._model_cache.get(user_id)
        if cache and cache["n_readings"] == n:
            model = cache["model"]
            sigma = cache["sigma"]
        else:
            model = self._get_base_model()
            model.layers[0].trainable = False
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=FINETUNE_LR),
                loss="mse",
            )
            raw_w = np.exp(np.linspace(0, 3, len(X_raw_train))).astype(np.float32)
            aug_w = np.concatenate([raw_w] * AUGMENT_COPIES)
            aug_w = aug_w / aug_w.mean()

            model.fit(X_train, y_train, sample_weight=aug_w,
                      epochs=FINETUNE_EPOCHS, batch_size=8, verbose=0)

            if len(X_val) > 0:
                y_pred_val = model.predict(X_val, verbose=0).flatten()
                y_true_mg  = y_val * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                y_pred_mg  = np.clip(y_pred_val, 0.0, 1.0) * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                sigma = float(np.sqrt(np.mean((y_pred_mg - y_true_mg) ** 2)))
            else:
                y_pred_tr = model.predict(X_raw_train, verbose=0).flatten()
                y_true_mg = y_raw_train * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                y_pred_mg = np.clip(y_pred_tr, 0.0, 1.0) * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                sigma = float(np.sqrt(np.mean((y_pred_mg - y_true_mg) ** 2)))
            sigma = max(1.0, sigma)
            print(f"[Prediction] σ (val RMSE) = {sigma:.1f} mg/dL")
            PredictionService._model_cache[user_id] = {"model": model, "n_readings": n, "sigma": sigma}

        if seed_override is not None:
            seed_scaled   = self._normalise(seed_override)
            seq           = list(seed_scaled[-SEQUENCE_LENGTH:])
            last_hour_raw = seed_override[-1, 1]
            last_context  = seed_scaled[-1, 2:].copy()
        else:
            seq           = list(scaled[-SEQUENCE_LENGTH:])
            last_hour_raw = feature_matrix[-1, 1]
            last_context  = scaled[-1, 2:].copy()

        predicted_norm = 0.0
        for step in range(hours):
            inp            = np.array(seq[-SEQUENCE_LENGTH:]).reshape(1, SEQUENCE_LENGTH, N_FEATURES)
            predicted_norm = float(model.predict(inp, verbose=0)[0][0])
            predicted_norm = float(np.clip(predicted_norm, 0.0, 1.0))
            next_hour = ((last_hour_raw + step + 1) % 24) / 24.0
            next_row  = np.concatenate([[predicted_norm, next_hour], last_context])
            seq.append(next_row)

        return round(self._denormalise_glucose(predicted_norm), 1), sigma

    # ==========================================
    # Historical Pattern Prediction
    # ==========================================

    @staticmethod
    def _hour_distance(h1: float, h2: float) -> float:
        d = abs(h1 - h2)
        return min(d, 24.0 - d)

    def calculate_pattern_prediction(
        self, user_id: str, lang: str = "ar", days: int = PATTERN_DAYS,
        preloaded_readings: list[dict] | None = None,
    ) -> dict:
        """
        Analyse the last `days` days of readings within a ±PATTERN_HOUR_WINDOW
        circular window around the current time.

        Uses recency weighting (1 / (days_ago + 1)) for the weighted average.
        p25 / p75 are computed on raw values (simpler, still meaningful).

        Returns a dict matching PatternPrediction fields.
        """
        all_readings = preloaded_readings if preloaded_readings is not None else self._fetch_readings(user_id)
        now          = datetime.now(timezone.utc)
        current_hour = now.hour + now.minute / 60.0
        cutoff       = now - timedelta(days=days)

        window_readings: list[tuple[dict, datetime]] = []
        for r in all_readings:
            ts = r.get("measuredAt")
            if ts is None:
                continue
            if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts < cutoff:
                continue
            r_hour = ts.hour + ts.minute / 60.0
            if self._hour_distance(r_hour, current_hour) <= PATTERN_HOUR_WINDOW:
                window_readings.append((r, ts))

        sample_count = len(window_readings)
        if sample_count < PATTERN_MIN_SAMPLES:
            return {"available": False, "sample_count": sample_count}

        raw_values:       list[float] = []
        weighted_sum:     float       = 0.0
        total_weight:     float       = 0.0

        for r, ts in window_readings:
            days_ago      = max(0.0, (now - ts).total_seconds() / 86400)
            weight        = 1.0 / (days_ago + 1.0)
            value         = float(r["value"])
            raw_values.append(value)
            weighted_sum  += value * weight
            total_weight  += weight

        weighted_avg = weighted_sum / total_weight
        values_arr   = np.array(raw_values)
        typical_min  = int(np.percentile(values_arr, 25))
        typical_max  = int(np.percentile(values_arr, 75))
        std          = float(np.std(values_arr))

        # risk_level — variable wins if spread is high regardless of mean
        if std > 40:
            risk_level = "variable"
        elif weighted_avg > 180:
            risk_level = "high"
        elif weighted_avg < 70:
            risk_level = "low"
        else:
            risk_level = "normal"

        # confidence
        if sample_count >= 20:
            confidence = "high"
        elif sample_count >= 10:
            confidence = "medium"
        else:
            confidence = "low"

        variability = "unstable" if std > 40 else "stable"

        # Human-readable hour label
        h = int(current_hour)
        h_end = (h + 1) % 24
        ampm = lambda x: f"{x % 12 or 12} {'AM' if x < 12 else 'PM'}"
        hour_label = {
            "ar": f"{h}:00 - {h_end}:00",
            "en": f"{ampm(h)} – {ampm(h_end)}",
            "he": f"{h}:00 – {h_end}:00",
        }.get(lang, f"{h}:00–{h_end}:00")

        messages = {
            "high": {
                "ar": f"نمطك التاريخي يُظهر ارتفاع السكر في هذه الساعة ({hour_label}). تجنّب الوجبات الثقيلة والمشروبات المحلّاة، وحاول المشي قليلاً بعد الأكل.",
                "en": f"Your pattern shows elevated glucose at this hour ({hour_label}). Avoid heavy meals and sugary drinks — a short walk after eating can help.",
                "he": f"הדפוס ההיסטורי שלך מראה סוכר גבוה בשעה זו ({hour_label}). הימנע מארוחות כבדות ומשקאות ממותקים, ונסה ללכת קצת אחרי הארוחה.",
            },
            "low": {
                "ar": f"نمطك التاريخي يُظهر انخفاض السكر في هذه الساعة ({hour_label}). لا تتأخر في تناول وجبة أو وجبة خفيفة، وتجنّب المجهود البدني على معدة فارغة.",
                "en": f"Your glucose tends to drop at this hour ({hour_label}). Have a meal or small snack soon — avoid intense activity on an empty stomach.",
                "he": f"הסוכר שלך נוטה לרדת בשעה זו ({hour_label}). אכול ארוחה או חטיף בקרוב, והימנע מפעילות גופנית עצימה על קיבה ריקה.",
            },
            "variable": {
                "ar": f"قراءاتك في هذه الساعة ({hour_label}) غير منتظمة. حاول تتبّع وجباتك ونشاطك البدني لمعرفة ما يؤثر على مستوى سكرك في هذا الوقت.",
                "en": f"Your glucose is inconsistent at this hour ({hour_label}). Track your meals and activity to identify what drives the variability.",
                "he": f"קריאות הסוכר שלך לא עקביות בשעה זו ({hour_label}). עקוב אחר הארוחות ופעילות גופנית כדי להבין מה משפיע על הרמות.",
            },
            "normal": {
                "ar": f"سكرك في هذه الساعة ({hour_label}) مستقر عادةً. واصل التزامك بنظامك الغذائي المعتاد وحافظ على إيقاع وجباتك.",
                "en": f"Your glucose is typically stable at this hour ({hour_label}). Keep up your current meal routine and lifestyle habits.",
                "he": f"הסוכר שלך בדרך כלל יציב בשעה זו ({hour_label}). המשך לשמור על שגרת התזונה ואורח החיים שלך.",
            },
        }
        message = messages.get(risk_level, {}).get(lang, messages.get(risk_level, {}).get("en", ""))

        return {
            "available":    True,
            "typical_avg":  int(round(weighted_avg)),
            "typical_min":  typical_min,
            "typical_max":  typical_max,
            "risk_level":   risk_level,
            "sample_count": sample_count,
            "message":      message,
            "confidence":   confidence,
            "variability":  variability,
        }

    # ==========================================
    # Compare LSTM prediction to pattern
    # ==========================================

    @staticmethod
    def _compare_to_pattern(predicted: float | None, pattern_avg: int | None) -> str | None:
        if predicted is None or pattern_avg is None:
            return None
        if predicted > pattern_avg + 20:
            return "above_normal"
        if predicted < pattern_avg - 20:
            return "below_normal"
        return "within_normal"

    # ==========================================
    # Alert Type
    # ==========================================

    def _get_alert_type(self, current: float, predicted: float, patch_error: bool) -> str | None:
        if patch_error:
            return "patch_error"
        if current < 70 or predicted < 70:
            return "low"
        if current > 170 or predicted > 170:
            return "high"
        return None

    # ==========================================
    # Elapsed Time String
    # ==========================================

    @staticmethod
    def _elapsed_str(h: float, lang: str) -> str:
        days = h / 24
        if h < 24:
            n = round(h)
            return {"ar": f"{n} ساعة", "en": f"{n}h", "he": f"{n} שעות"}.get(lang, f"{n}h")
        elif days < 2:
            return {"ar": "يوم واحد", "en": "1 day", "he": "יום אחד"}.get(lang, "1 day")
        else:
            n = round(days)
            return {"ar": f"{n} أيام", "en": f"{n} days", "he": f"{n} ימים"}.get(lang, f"{n} days")

    # ==========================================
    # AI Advice via Groq
    # ==========================================

    def _call_groq(self, payload: dict) -> dict | None:
        try:
            body = json.dumps(payload).encode()
            req  = urllib.request.Request(
                GROQ_URL, data=body,
                headers={
                    "Content-Type":  "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "User-Agent":    "DiaConnectFamily/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                text = json.loads(resp.read().decode())["choices"][0]["message"]["content"].strip()
                if text.startswith("```"):
                    text = text.split("```")[-2] if "```" in text[3:] else text[3:]
                    text = text.lstrip("json").strip()
                return json.loads(text)
        except urllib.error.HTTPError as e:
            print(f"Groq HTTP error: {e.code} - {e.read().decode()}")
            return None
        except Exception as e:
            print(f"Groq error: {e}")
            return None

    def _get_ai_advice(
        self,
        patient_name:          str,
        current:               float,
        predicted:             float,
        trend:                 str,
        alert_type:            str | None,
        hours:                 int,
        lang:                  str = "ar",
        lifestyle_ctx:         dict | None = None,
        prediction_mode:       str = "real_time",
        comparison_to_pattern: str | None = None,
        pattern_risk_level:    str | None = None,
    ) -> dict | None:
        if not GROQ_API_KEY:
            return None

        lang_instruction = {
            "ar": "Respond ONLY in Arabic.",
            "en": "Respond ONLY in English.",
            "he": "Respond ONLY in Hebrew.",
        }.get(lang, "Respond ONLY in Arabic.")

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

        pattern_ctx = ""
        if prediction_mode != "real_time" or comparison_to_pattern or pattern_risk_level:
            pattern_ctx = f"""
Prediction context:
- Prediction mode: {prediction_mode}
- Data stale: {prediction_mode in ('hybrid',)}
- Historical pattern risk at this hour: {pattern_risk_level or 'unknown'}
- Today's prediction vs historical pattern: {comparison_to_pattern or 'unknown'}"""

        prompt = f"""You are a medical assistant specialized in Type 2 diabetes patients.
{lang_instruction}

Patient data:
- Name: {patient_name}
- Current glucose: {current} mg/dL
- Trend: {trend}
- Predicted glucose in {hours} hour(s): {predicted} mg/dL
- Alert type: {alert_type or 'none'}{ctx_lines}{pattern_ctx}

Write two short pieces of advice (1-2 sentences each):
1. For the patient: what should they do right now?
2. For a family member: how can they help or support the patient?

Reply in JSON format only:
{{"patient": "...", "family": "..."}}"""

        parsed = self._call_groq({
            "model":       "llama-3.3-70b-versatile",
            "messages":    [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens":  300,
        })
        if parsed:
            print(f"[Groq advice] {parsed}")
        return parsed

    # ==========================================
    # AI Advice for Pattern Mode
    # ==========================================

    def _get_pattern_advice(
        self,
        patient_name:  str,
        typical_avg:   int,
        typical_min:   int,
        typical_max:   int,
        risk_level:    str,
        hour_label:    str,
        sample_count:  int,
        confidence:    str,
        lang:          str = "ar",
    ) -> dict | None:
        if not GROQ_API_KEY:
            return None

        lang_instruction = {
            "ar": "Respond ONLY in Arabic.",
            "en": "Respond ONLY in English.",
            "he": "Respond ONLY in Hebrew.",
        }.get(lang, "Respond ONLY in Arabic.")

        risk_labels = {
            "high":     {"ar": "مرتفع",    "en": "high",     "he": "גבוה"},
            "low":      {"ar": "منخفض",    "en": "low",      "he": "נמוך"},
            "variable": {"ar": "متذبذب",   "en": "variable", "he": "לא יציב"},
            "normal":   {"ar": "طبيعي",    "en": "normal",   "he": "תקין"},
        }
        risk_label = risk_labels.get(risk_level, {}).get(lang, risk_level)

        prompt = f"""You are a medical assistant specialized in Type 2 diabetes patients (lifestyle-focused, not insulin-dependent).
{lang_instruction}

No recent glucose reading is available. Based on this patient's HISTORICAL PATTERN:
- Patient: {patient_name}
- Typical glucose at current hour ({hour_label}): {typical_avg} mg/dL
- Typical range: {typical_min}–{typical_max} mg/dL
- Risk level at this hour: {risk_label}
- Data confidence: {confidence} ({sample_count} historical readings)

Write two short, practical, actionable pieces of advice (1–2 sentences each):
1. For the patient: what should they be mindful of right now based on their usual pattern at this hour?
2. For a family member: a brief, supportive suggestion.

Focus on diet, meal timing, light activity. Do NOT mention insulin.
Reply in JSON only: {{"patient": "...", "family": "..."}}"""

        parsed = self._call_groq({
            "model":       "llama-3.3-70b-versatile",
            "messages":    [{"role": "user", "content": prompt}],
            "temperature": 0.65,
            "max_tokens":  220,
        })
        if parsed:
            print(f"[Groq pattern advice] {parsed}")
        return parsed

    # ==========================================
    # Main Predict Method
    # ==========================================

    def predict(self, user_id: str, patient_name: str, hours: int = 1, lang: str = "ar") -> dict:
        """
        Full dual-prediction pipeline.

        Decision logic
        ──────────────
        1. <MIN_READINGS readings          → mode = none
        2. hours_elapsed > MAX_STALE_HOURS → mode = pattern (LSTM skipped)
        3. hours_elapsed >= 6              → mode = hybrid  (LSTM + stale warning)
        4. hours_elapsed < 6               → mode = real_time
        """
        raw_readings     = self._fetch_readings(user_id)
        cleaned_readings = self._remove_outliers(raw_readings)

        # ── Insufficient data ─────────────────────────────────────────────
        if len(cleaned_readings) < MIN_READINGS:
            return {
                "predicted_value":          None,
                "hours":                    hours,
                "trend":                    None,
                "alert_type":               None,
                "advice":                   None,
                "readings_used":            len(cleaned_readings),
                "prediction_mode":          "none",
                "pattern_prediction":       None,
                "comparison_to_pattern":    None,
                "data_stale":               False,
                "hours_since_last_reading": None,
                "message": (
                    f"بيانات غير كافية — يلزم {MIN_READINGS} قراءة على الأقل، "
                    f"لديك {len(cleaned_readings)} فقط."
                ),
            }

        # ── Calculate hours elapsed since last reading ────────────────────
        hours_elapsed = 0.0
        last_ts = cleaned_readings[-1].get("measuredAt")
        if last_ts is not None:
            if hasattr(last_ts, "tzinfo") and last_ts.tzinfo is None:
                last_ts = last_ts.replace(tzinfo=timezone.utc)
            hours_elapsed = max(
                0.0, (datetime.now(timezone.utc) - last_ts).total_seconds() / 3600
            )

        # ── Determine prediction mode ─────────────────────────────────────
        if hours_elapsed > MAX_STALE_HOURS:
            prediction_mode = "pattern"
        elif hours_elapsed >= 6.0:
            prediction_mode = "hybrid"
        else:
            prediction_mode = "real_time"

        print(f"[Prediction] mode={prediction_mode}, elapsed={hours_elapsed:.1f}h")

        # ══════════════════════════════════════════════════════════════════
        # MODE: PATTERN — data too old, show historical analysis only
        # ══════════════════════════════════════════════════════════════════
        if prediction_mode == "pattern":
            pattern = self.calculate_pattern_prediction(user_id, lang, preloaded_readings=raw_readings)
            e       = self._elapsed_str(hours_elapsed, lang)

            stale_msg = {
                "ar": (
                    f"آخر قراءة منذ {e}. لا يتوفر تنبؤ لحظي — "
                    "يعرض التطبيق تحليلاً بناءً على نمطك التاريخي."
                ),
                "en": (
                    f"Last reading was {e} ago. No real-time prediction available — "
                    "showing analysis based on your historical pattern."
                ),
                "he": (
                    f"הקריאה האחרונה לפני {e}. אין תחזית בזמן אמת — "
                    "מוצג ניתוח על סמך הדפוס ההיסטורי שלך."
                ),
            }
            family_stale_msg = {
                "ar": (
                    f"لم تُسجَّل أي قراءة لـ {patient_name} منذ {e}. "
                    "لا يتوفر تنبؤ لحظي — يعرض التطبيق تحليلاً بناءً على نمطه التاريخي."
                ),
                "en": (
                    f"No reading from {patient_name} in {e}. No real-time prediction available — "
                    "showing analysis based on their historical pattern."
                ),
                "he": (
                    f"לא נרשמה קריאה מ-{patient_name} מזה {e}. אין תחזית בזמן אמת — "
                    "מוצג ניתוח על סמך הדפוס ההיסטורי שלו."
                ),
            }

            # Groq personalised advice for pattern mode
            pattern_advice = None
            if pattern.get("available"):
                _now    = datetime.now(timezone.utc)
                h_now   = _now.hour
                h_end   = (h_now + 1) % 24
                hl      = {"ar": f"{h_now}:00 - {h_end}:00", "en": f"{h_now}:00–{h_end}:00", "he": f"{h_now}:00–{h_end}:00"}.get(lang, f"{h_now}:00–{h_end}:00")
                pattern_advice = self._get_pattern_advice(
                    patient_name=patient_name,
                    typical_avg=pattern.get("typical_avg", 0),
                    typical_min=pattern.get("typical_min", 0),
                    typical_max=pattern.get("typical_max", 0),
                    risk_level=pattern.get("risk_level", "normal"),
                    hour_label=hl,
                    sample_count=pattern.get("sample_count", 0),
                    confidence=pattern.get("confidence", "low"),
                    lang=lang,
                )

            # Send family alert if pattern shows risk (rate-limited)
            if pattern.get("available") and pattern.get("risk_level") in ("high", "low", "variable"):
                risk    = pattern["risk_level"]
                ak      = f"pattern_{risk}"
                if self._can_send_alert(user_id, ak):
                    try:
                        send_stale_pattern_alert(
                            patient_id=user_id,
                            patient_name=patient_name,
                            risk_level=risk,
                            hours_elapsed=hours_elapsed,
                            typical_avg=pattern.get("typical_avg"),
                        )
                        self._mark_alert_sent(user_id, ak)
                    except Exception as exc:
                        print(f"Pattern alert failed: {exc}")

            return {
                "predicted_value":          None,
                "hours":                    hours,
                "trend":                    None,
                "alert_type":               None,
                "probability":              None,
                "prob_up":                  None,
                "prob_down":                None,
                "advice":                   pattern_advice,
                "readings_used":            len(cleaned_readings),
                "prediction_mode":          "pattern",
                "pattern_prediction":       pattern,
                "comparison_to_pattern":    None,
                "data_stale":               True,
                "hours_since_last_reading": round(hours_elapsed, 1),
                "message":                  stale_msg.get(lang, stale_msg["en"]),
                "family_message":           family_stale_msg.get(lang, family_stale_msg["en"]),
            }

        # ══════════════════════════════════════════════════════════════════
        # MODE: REAL_TIME or HYBRID — run LSTM
        # ══════════════════════════════════════════════════════════════════
        profile  = self._fetch_lifestyle_profile(user_id)
        log_ctx  = self._fetch_daily_log_context(user_id)
        sleep_bl = profile["sleep_hours_baseline"]

        rows = []
        for r in cleaned_readings:
            hour, c30, c2h, activity, sleep = self._context_for_reading(r, log_ctx, sleep_bl)
            rows.append([r["value"], hour, c30, c2h, activity, sleep])
        feature_matrix = np.array(rows, dtype=np.float32)

        raw_last         = raw_readings[-1]["value"] if raw_readings else None
        last_was_outlier = raw_last is not None and raw_last != cleaned_readings[-1]["value"]
        current          = raw_last if raw_last is not None else feature_matrix[-1, 0]

        # Stale note for hybrid mode
        stale_note = None
        if prediction_mode == "hybrid":
            e = self._elapsed_str(hours_elapsed, lang)
            stale_note = {
                "ar": f"آخر قراءة منذ {e} — أضف قراءة جديدة للحصول على تنبؤ محدّث.",
                "en": f"Last reading was {e} ago — add a new reading for a fresher prediction.",
                "he": f"הקריאה האחרונה לפני {e} — הוסף קריאה חדשה לתחזית מעודכנת.",
            }

        # Virtual "now" seed row when lifestyle context changed
        now         = datetime.now(timezone.utc)
        now_reading = {"measuredAt": now, "value": current}
        _, c30_now, c2h_now, act_now, sleep_now = self._context_for_reading(
            now_reading, log_ctx, sleep_bl
        )
        _, c30_last, c2h_last, act_last, _ = self._context_for_reading(
            cleaned_readings[-1], log_ctx, sleep_bl
        )
        seed_matrix = None
        if c30_now != c30_last or c2h_now != c2h_last or act_now > act_last:
            now_hour    = float(now.hour) + float(now.minute) / 60.0
            virtual_row = np.array(
                [[current, now_hour, c30_now, c2h_now, act_now, sleep_now]],
                dtype=np.float32,
            )
            seed_matrix = np.vstack([feature_matrix, virtual_row])
            print(f"[Prediction] Virtual now-row injected: carbs_30={c30_now:.0f}g, act={act_now:.0f}min")

        predicted, sigma  = self._predict_lstm(
            feature_matrix, user_id=user_id, hours=hours, seed_override=seed_matrix
        )
        trend              = self._calculate_trend(current, predicted)
        prob_up, prob_down = self._calculate_probability(current, predicted, sigma)
        probability        = (
            prob_up   if trend == "rising"  else
            prob_down if trend == "falling" else
            max(prob_up, prob_down)
        )
        patch_error = last_was_outlier
        alert_type  = self._get_alert_type(current, predicted, patch_error)

        # Pattern comparison (internal — used for Groq context, not shown as card)
        pattern_data        = self.calculate_pattern_prediction(user_id, lang, preloaded_readings=raw_readings)
        comparison          = self._compare_to_pattern(
            predicted, pattern_data.get("typical_avg")
        )
        pattern_risk_level  = pattern_data.get("risk_level")

        _, last_c30, last_c2h, last_activity, last_sleep = self._context_for_reading(
            cleaned_readings[-1], log_ctx, sleep_bl
        )
        lifestyle_ctx = {
            "carbs_2h":       last_c30 + last_c2h,
            "activity_2h":    last_activity,
            "sleep_hours":    last_sleep,
            "activity_level": profile["activity_level"],
        }

        # Always generate advice (not only on alert)
        advice = self._get_ai_advice(
            patient_name=patient_name,
            current=current,
            predicted=predicted,
            trend=trend,
            alert_type=alert_type,
            hours=hours,
            lang=lang,
            lifestyle_ctx=lifestyle_ctx,
            prediction_mode=prediction_mode,
            comparison_to_pattern=comparison,
            pattern_risk_level=pattern_risk_level,
        )

        # Family notification (rate-limited)
        if alert_type and self._can_send_alert(user_id, alert_type):
            try:
                send_prediction_alert(
                    patient_id=user_id,
                    patient_name=patient_name,
                    alert_type=alert_type,
                    current=current,
                    predicted=predicted,
                    hours=hours,
                    family_advice=advice.get("family") if advice else None,
                )
                self._mark_alert_sent(user_id, alert_type)
            except Exception as exc:
                print(f"Prediction alert notification failed: {exc}")

        return {
            "predicted_value":          predicted,
            "hours":                    hours,
            "trend":                    trend,
            "alert_type":               alert_type,
            "probability":              probability,
            "prob_up":                  prob_up,
            "prob_down":                prob_down,
            "advice":                   advice,
            "readings_used":            len(rows),
            "prediction_mode":          prediction_mode,
            "pattern_prediction":       None,   # card only shown in pattern mode
            "comparison_to_pattern":    comparison,
            "data_stale":               prediction_mode == "hybrid",
            "hours_since_last_reading": round(hours_elapsed, 1),
            "message":                  stale_note.get(lang, stale_note["en"]) if stale_note else None,
        }


prediction_service = PredictionService()
