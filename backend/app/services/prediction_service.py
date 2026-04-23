"""
Glucose Prediction Service — v2 (pre-trained base model + per-patient fine-tuning)

Features per reading: glucose, hour_of_day, carbs_30min, carbs_2h, activity_last_2h, sleep_hours.

Pre-training:  run scripts/pretrain_lstm.py once → saves models/base_model.keras
Inference:     load base model → freeze LSTM → fine-tune Dense layers on patient
               readings → cache per user → predict recursively.

Fixed glucose scaler [40–400 mg/dL] matches the pre-training normalisation.
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
from app.services.family_service import send_prediction_alert

load_dotenv()

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"


# ==========================================
# Constants
# ==========================================

MIN_READINGS        = 10            # lowered — fine-tuning works with fewer samples
SEQUENCE_LENGTH     = 12            # 12 × 30-min steps = 6 hours of context window
N_FEATURES          = 6             # glucose, hour, carbs_30min, carbs_2h, activity_2h, sleep
GLUCOSE_MIN         = 40.0          # fixed scaler lower bound
GLUCOSE_MAX         = 600.0         # fixed scaler upper bound (raised to cover extreme hyperglycemia)
PATCH_ERROR_THRESHOLD = 40          # % deviation → patch error
CGM_MAX_CHANGE      = 30
MANUAL_MAX_CHANGE   = 80
AUGMENT_COPIES      = 3             # data-augmentation factor
FINETUNE_EPOCHS     = 15
FINETUNE_LR         = 5e-4

ACTIVITY_LEVEL_MAP  = {"low": 0.2, "moderate": 0.5, "high": 0.8}
GROQ_API_KEY        = os.getenv("GROQ_API_KEY", "")
GROQ_URL            = "https://api.groq.com/openai/v1/chat/completions"

BASE_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "base_model.keras"


# ==========================================
# Prediction Service
# ==========================================

class PredictionService:

    # Shared across all requests for the lifetime of the server process
    _model_cache: dict = {}   # user_id → {"model": model, "n_readings": int}
    _base_weights = None      # loaded once from disk

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
    ) -> tuple[float, float, float, float, float]:
        """
        Returns (hour, carbs_30min, carbs_2h, activity_2h, sleep_hours).
        carbs_30min: carbs eaten in the last 30 min — glucose still rising.
        carbs_2h:    carbs eaten 30 min–2 h ago — absorption mostly done.
        """
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

        past_sleep = [s for s in log_ctx["sleep_logs"] if s["ts"] <= ts]
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
            prev_val = prev["value"]
            curr_val = current["value"]

            base_max = CGM_MAX_CHANGE if current.get("source") == "libreview" else MANUAL_MAX_CHANGE

            # Scale the threshold by elapsed time so a long gap (e.g. 12 hours)
            # doesn't falsely flag a legitimate reading as an outlier.
            prev_ts = prev.get("measuredAt")
            curr_ts = current.get("measuredAt")
            if prev_ts and curr_ts:
                if hasattr(prev_ts, "tzinfo") and prev_ts.tzinfo is None:
                    prev_ts = prev_ts.replace(tzinfo=timezone.utc)
                if hasattr(curr_ts, "tzinfo") and curr_ts.tzinfo is None:
                    curr_ts = curr_ts.replace(tzinfo=timezone.utc)
                hours_gap = abs((curr_ts - prev_ts).total_seconds()) / 3600
                # base_max is defined per ~30-min interval; scale linearly with time
                max_change = base_max * max(1.0, hours_gap / 0.5)
            else:
                max_change = base_max

            if abs(curr_val - prev_val) > max_change:
                fixed = dict(current)
                fixed["value"] = prev_val
                cleaned.append(fixed)
            else:
                cleaned.append(current)
        return cleaned

    # ==========================================
    # Calculate Trend
    # ==========================================

    def _calculate_trend(self, current: float, predicted: float) -> str:
        diff = predicted - current
        if diff > 5:
            return "rising"
        if diff < -5:
            return "falling"
        return "stable"

    def _calculate_probability(self, current: float, predicted: float, sigma: float) -> tuple[int, int]:
        """
        Returns (prob_up, prob_down) as percentages [0..100].
        prob_up  = Φ((predicted - current) / σ)   — probability glucose rises
        prob_down = 1 - prob_up                    — probability glucose falls
        """
        from math import erf, sqrt
        sigma = max(1.0, sigma)
        z = (predicted - current) / sigma
        prob_up = (1.0 + erf(z / sqrt(2))) / 2.0
        prob_up   = int(min(99, max(1, round(prob_up * 100))))
        prob_down = 100 - prob_up
        return prob_up, prob_down

    # ==========================================
    # Detect Patch Error
    # ==========================================

    def _detect_patch_error(self, actual: float, predicted: float) -> bool:
        if predicted == 0:
            return False
        return abs(actual - predicted) / predicted * 100 > PATCH_ERROR_THRESHOLD

    # ==========================================
    # Normalise / Denormalise (fixed range)
    # ==========================================

    @staticmethod
    def _normalise(feature_matrix: np.ndarray) -> np.ndarray:
        g_norm   = (feature_matrix[:, 0] - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN)
        h_norm   = feature_matrix[:, 1] / 24.0
        c30_norm = np.clip(feature_matrix[:, 2] / 100.0, 0.0, 1.0)   # carbs_30min, max ~100g
        c2h_norm = np.clip(feature_matrix[:, 3] / 150.0, 0.0, 1.0)   # carbs_2h,    max ~150g
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
        """
        Returns a freshly-built model with base weights loaded (if available).
        Always returns a new instance so fine-tuning one user never affects another.
        """
        import tensorflow as tf

        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(64, input_shape=(SEQUENCE_LENGTH, N_FEATURES)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ], name="glucose_lstm")

        # Load shared base weights (loaded from disk once, then reused)
        if PredictionService._base_weights is None and BASE_MODEL_PATH.exists():
            try:
                tmp = tf.keras.models.load_model(str(BASE_MODEL_PATH))
                PredictionService._base_weights = tmp.get_weights()
                print(f"✅ Base model weights loaded from {BASE_MODEL_PATH}")
            except Exception as e:
                print(f"⚠️  Could not load base model: {e}")

        if PredictionService._base_weights is not None:
            # Build with a dummy input so weights can be set
            model(np.zeros((1, SEQUENCE_LENGTH, N_FEATURES), dtype=np.float32))
            model.set_weights(PredictionService._base_weights)

        return model

    # ==========================================
    # LSTM Prediction (fine-tune + cache)
    # ==========================================

    def _predict_lstm(
        self,
        feature_matrix: np.ndarray,
        user_id: str,
        hours: int = 1,
        seed_override: np.ndarray | None = None,
    ) -> float:
        import tensorflow as tf
        tf.random.set_seed(42)
        np.random.seed(42)

        n      = feature_matrix.shape[0]
        scaled = self._normalise(feature_matrix)   # (n, 5)

        # ── Build training sequences ──────────────────────────────────────
        X, y = [], []
        for i in range(n - SEQUENCE_LENGTH):
            X.append(scaled[i : i + SEQUENCE_LENGTH])
            y.append(scaled[i + SEQUENCE_LENGTH, 0])   # glucose only
        X = np.array(X, dtype=np.float32)
        y = np.array(y, dtype=np.float32)

        # ── Data augmentation (add small Gaussian noise) ──────────────────
        X_aug, y_aug = [X], [y]
        for _ in range(AUGMENT_COPIES - 1):
            noise = np.random.normal(0, 0.01, X.shape).astype(np.float32)
            X_aug.append(X + noise)
            y_aug.append(y)
        X_train = np.concatenate(X_aug)
        y_train = np.concatenate(y_aug)

        # ── Train / validation split (80 / 20) ───────────────────────────
        split = max(1, int(len(X) * 0.8))
        X_raw_train, X_val = X[:split], X[split:]
        y_raw_train, y_val = y[:split], y[split:]

        # Augment only the training split
        X_aug, y_aug = [X_raw_train], [y_raw_train]
        for _ in range(AUGMENT_COPIES - 1):
            noise = np.random.normal(0, 0.01, X_raw_train.shape).astype(np.float32)
            X_aug.append(X_raw_train + noise)
            y_aug.append(y_raw_train)
        X_train = np.concatenate(X_aug)
        y_train = np.concatenate(y_aug)

        # ── Load or retrieve cached fine-tuned model ──────────────────────
        cache = PredictionService._model_cache.get(user_id)
        if cache and cache["n_readings"] == n:
            model = cache["model"]
            sigma = cache["sigma"]
        else:
            model = self._get_base_model()

            # Freeze the LSTM layer — only adapt the Dense layers per patient
            model.layers[0].trainable = False
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=FINETUNE_LR),
                loss="mse",
            )

            # Recency weights: newer sequences get exponentially higher weight.
            # e^0 (oldest) … e^3 ≈ 20× (newest) — half-weight lost every ~2h for 24 readings.
            raw_w  = np.exp(np.linspace(0, 3, len(X_raw_train))).astype(np.float32)
            aug_w  = np.concatenate([raw_w] * AUGMENT_COPIES)
            aug_w  = aug_w / aug_w.mean()   # keep average weight = 1 so LR stays calibrated

            model.fit(
                X_train, y_train,
                sample_weight=aug_w,
                epochs=FINETUNE_EPOCHS,
                batch_size=8,
                verbose=0,
            )

            # Compute validation RMSE (mg/dL) as σ — unseen data → unbiased estimate
            if len(X_val) > 0:
                y_pred_val = model.predict(X_val, verbose=0).flatten()
                y_true_mg  = y_val * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                y_pred_mg  = np.clip(y_pred_val, 0.0, 1.0) * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                sigma = float(np.sqrt(np.mean((y_pred_mg - y_true_mg) ** 2)))
            else:
                # Fallback to training RMSE when too few samples for a val split
                y_pred_tr  = model.predict(X_raw_train, verbose=0).flatten()
                y_true_mg  = y_raw_train * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                y_pred_mg  = np.clip(y_pred_tr, 0.0, 1.0) * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN
                sigma = float(np.sqrt(np.mean((y_pred_mg - y_true_mg) ** 2)))
            sigma = max(1.0, sigma)
            print(f"[Prediction] σ (val RMSE) = {sigma:.1f} mg/dL")

            PredictionService._model_cache[user_id] = {"model": model, "n_readings": n, "sigma": sigma}

        # ── Recursive prediction ──────────────────────────────────────────
        # seed_override lets predict() inject a virtual "now" row that carries
        # upcoming carbs/activity without polluting the training sequences.
        if seed_override is not None:
            seed_scaled   = self._normalise(seed_override)
            seq           = list(seed_scaled[-SEQUENCE_LENGTH:])
            last_hour_raw = seed_override[-1, 1]
            last_context  = seed_scaled[-1, 2:].copy()
        else:
            seq           = list(scaled[-SEQUENCE_LENGTH:])
            last_hour_raw = feature_matrix[-1, 1]
            last_context  = scaled[-1, 2:].copy()   # [carbs, activity, sleep] normalised

        predicted_norm = 0.0
        for step in range(hours):
            inp = np.array(seq[-SEQUENCE_LENGTH:]).reshape(1, SEQUENCE_LENGTH, N_FEATURES)
            predicted_norm = float(model.predict(inp, verbose=0)[0][0])
            predicted_norm = float(np.clip(predicted_norm, 0.0, 1.0))

            next_hour = ((last_hour_raw + step + 1) % 24) / 24.0
            next_row  = np.concatenate([[predicted_norm, next_hour], last_context])
            seq.append(next_row)

        return round(self._denormalise_glucose(predicted_norm), 1), sigma

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
                    "Content-Type":  "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "User-Agent":    "DiaConnectFamily/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode())
                text   = result["choices"][0]["message"]["content"]
                print(f"[Groq raw] {text[:200]}")
                text   = text.strip()
                if text.startswith("```"):
                    text = text.split("```")[-2] if "```" in text[3:] else text[3:]
                    text = text.lstrip("json").strip()
                parsed = json.loads(text)
                print(f"[Groq parsed] {parsed}")
                return parsed
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
        if current < 70 or predicted < 70:
            return "low"
        if current > 170 or predicted > 170:
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
        4. Fine-tune base LSTM on patient data (cached) and predict
        5. Detect patch error
        6. Determine alert type
        7. Get Groq AI advice if alert detected
        """
        raw_readings     = self._fetch_readings(user_id)
        cleaned_readings = self._remove_outliers(raw_readings)

        if len(cleaned_readings) < MIN_READINGS:
            return {
                "predicted_value": None,
                "hours":           hours,
                "trend":           None,
                "alert_type":      None,
                "advice":          None,
                "readings_used":   len(cleaned_readings),
                "message": (
                    f"بيانات غير كافية — يلزم {MIN_READINGS} قراءة على الأقل، "
                    f"لديك {len(cleaned_readings)} فقط."
                ),
            }

        profile  = self._fetch_lifestyle_profile(user_id)
        log_ctx  = self._fetch_daily_log_context(user_id)
        sleep_bl = profile["sleep_hours_baseline"]

        rows = []
        for r in cleaned_readings:
            hour, c30, c2h, activity, sleep = self._context_for_reading(r, log_ctx, sleep_bl)
            rows.append([r["value"], hour, c30, c2h, activity, sleep])

        feature_matrix = np.array(rows, dtype=np.float32)

        raw_last        = raw_readings[-1]["value"] if raw_readings else None
        last_was_outlier = raw_last is not None and raw_last != cleaned_readings[-1]["value"]
        current          = raw_last if raw_last is not None else feature_matrix[-1, 0]

        # Always predict exactly 1 hour ahead from the last reading.
        # Multi-step recursive prediction compounds errors — keeping it at 1 step
        # gives the most reliable result. If the reading is old, we add a note
        # to the message so the user knows to add a fresh reading.
        predict_hours = hours
        stale_note = None
        last_ts = cleaned_readings[-1].get("measuredAt")
        if last_ts is not None and hasattr(last_ts, "tzinfo"):
            if last_ts.tzinfo is None:
                last_ts = last_ts.replace(tzinfo=timezone.utc)
            hours_elapsed = max(0.0, (datetime.now(timezone.utc) - last_ts).total_seconds() / 3600)
            print(f"[Prediction] Last reading {hours_elapsed:.1f}h ago → predicting {predict_hours} step ahead")
            if hours_elapsed >= 2.0:
                elapsed_str = f"{round(hours_elapsed)}"
                stale_note = {
                    "ar": f"آخر قراءة منذ {elapsed_str} ساعة — أضف قراءة جديدة للحصول على تنبؤ محدّث.",
                    "en": f"Last reading was {elapsed_str}h ago — add a new reading for a fresher prediction.",
                    "he": f"הקריאה האחרונה לפני {elapsed_str} שעות — הוסף קריאה חדשה לתחזית מעודכנת.",
                }

            MAX_STALE_HOURS = 3
            if hours_elapsed > MAX_STALE_HOURS:
                stale_msg = {
                    "ar": f"آخر قراءة منذ {round(hours_elapsed)} ساعة — أضف قراءة جديدة للحصول على تنبؤ دقيق.",
                    "en": f"Last reading was {round(hours_elapsed)} hours ago — add a new reading for an accurate prediction.",
                    "he": f"הקריאה האחרונה לפני {round(hours_elapsed)} שעות — הוסף קריאה חדשה לתחזית מדויקת.",
                }
                return {
                    "predicted_value": None,
                    "hours":           hours,
                    "trend":           None,
                    "alert_type":      None,
                    "probability":     None,
                    "prob_up":         None,
                    "prob_down":       None,
                    "advice":          None,
                    "readings_used":   len(cleaned_readings),
                    "message":         stale_msg.get(lang, stale_msg["en"]),
                }


            # Build a virtual "now" row when the meal/activity context has changed
            # since the last reading. Uses _context_for_reading at current time so
            # carbs_30min correctly reflects meals eaten in the last 30 minutes.
            now = datetime.now(timezone.utc)
            now_reading = {"measuredAt": now, "value": current}
            _, c30_now, c2h_now, act_now, sleep_now = self._context_for_reading(
                now_reading, log_ctx, sleep_bl
            )
            _, c30_last, c2h_last, act_last, _ = self._context_for_reading(
                cleaned_readings[-1], log_ctx, sleep_bl
            )
            if c30_now != c30_last or c2h_now != c2h_last or act_now > act_last:
                now_hour = float(now.hour) + float(now.minute) / 60.0
                virtual_row = np.array([[
                    current, now_hour, c30_now, c2h_now, act_now, sleep_now,
                ]], dtype=np.float32)
                seed_matrix = np.vstack([feature_matrix, virtual_row])
                print(f"[Prediction] Virtual now-row: carbs_30min={c30_now:.0f}g, carbs_2h={c2h_now:.0f}g, activity={act_now:.0f}min")
            else:
                seed_matrix = None
        else:
            seed_matrix = None

        predicted, sigma = self._predict_lstm(
            feature_matrix, user_id=user_id, hours=predict_hours, seed_override=seed_matrix
        )
        trend             = self._calculate_trend(current, predicted)
        prob_up, prob_down = self._calculate_probability(current, predicted, sigma)
        probability       = prob_up if trend == "rising" else prob_down if trend == "falling" else max(prob_up, prob_down)
        patch_error       = last_was_outlier
        alert_type        = self._get_alert_type(current, predicted, patch_error)

        _, last_c30, last_c2h, last_activity, last_sleep = self._context_for_reading(
            cleaned_readings[-1], log_ctx, sleep_bl
        )
        lifestyle_ctx = {
            "carbs_2h":       last_c30 + last_c2h,
            "activity_2h":    last_activity,
            "sleep_hours":    last_sleep,
            "activity_level": profile["activity_level"],
        }

        if alert_type:
            try:
                send_prediction_alert(
                    patient_id=user_id,
                    patient_name=patient_name,
                    alert_type=alert_type,
                    current=current,
                    predicted=predicted,
                    hours=hours,
                )
            except Exception as e:
                print(f"Prediction alert notification failed: {e}")

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
            "hours":           hours,
            "trend":           trend,
            "alert_type":      alert_type,
            "probability":     probability,
            "prob_up":         prob_up,
            "prob_down":       prob_down,
            "advice":          advice,
            "readings_used":   len(rows),
            "message":         stale_note.get(lang, stale_note["en"]) if stale_note else None,
        }


prediction_service = PredictionService()
