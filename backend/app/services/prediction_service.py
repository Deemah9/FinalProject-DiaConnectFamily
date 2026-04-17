"""
Glucose Prediction Service
Uses an LSTM model trained on the patient's own readings to predict
the next glucose value. Also detects patch malfunctions and generates
AI-powered advice via OpenAI API for both the patient and family members.
"""

from sklearn.preprocessing import MinMaxScaler
from firebase_admin import firestore
import numpy as np
import json
import urllib.request
import urllib.error
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()


# ==========================================
# Constants
# ==========================================

MIN_READINGS = 15          # minimum readings required to run the model
SEQUENCE_LENGTH = 10       # number of past readings used as input
PATCH_ERROR_THRESHOLD = 40  # % deviation from prediction to flag patch error
CGM_MAX_CHANGE = 30        # max mg/dL change between two CGM readings
MANUAL_MAX_CHANGE = 80     # max mg/dL change between two manual readings

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


# ==========================================
# Prediction Service
# ==========================================

class PredictionService:

    def __init__(self):
        self.db = firestore.client()

    # ==========================================
    # Fetch Readings
    # ==========================================

    def _fetch_readings(self, user_id: str) -> list[dict]:
        """
        Fetch all glucose readings for a user from Firestore.
        Returns list sorted oldest → newest.
        """
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
            key=lambda r: r.get("measuredAt") or datetime.min.replace(
                tzinfo=timezone.utc)
        )
        return readings

    # ==========================================
    # Remove Outliers
    # ==========================================

    def _remove_outliers(self, readings: list[dict]) -> list[dict]:
        """
        Remove readings that deviate too much from the previous one.
        Uses CGM threshold (30) for LibreView readings and manual threshold (80)
        for manually entered readings. Replaces outlier with previous value.
        """
        if not readings:
            return readings

        cleaned = [readings[0]]
        for i in range(1, len(readings)):
            current = readings[i]
            prev_value = cleaned[-1]["value"]
            curr_value = current["value"]
            source = current.get("source", "manual")

            max_change = CGM_MAX_CHANGE if source == "libreview" else MANUAL_MAX_CHANGE

            if abs(curr_value - prev_value) > max_change:
                # Replace outlier with previous value (ignore bad reading)
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
        """
        Determine if glucose is rising, falling, or stable based on
        the last 5 readings. Uses average change per step.
        """
        if len(values) < 2:
            return "stable"

        recent = values[-5:]
        changes = [recent[i] - recent[i - 1] for i in range(1, len(recent))]
        avg_change = sum(changes) / len(changes)

        if avg_change > 2:
            return "rising"
        elif avg_change < -2:
            return "falling"
        return "stable"

    # ==========================================
    # Detect Patch Error
    # ==========================================

    def _detect_patch_error(self, actual: float, predicted: float) -> bool:
        """
        Returns True if the actual reading deviates more than
        PATCH_ERROR_THRESHOLD% from the predicted value.
        """
        if predicted == 0:
            return False
        deviation = abs(actual - predicted) / predicted * 100
        return deviation > PATCH_ERROR_THRESHOLD

    # ==========================================
    # LSTM Prediction
    # ==========================================

    def _predict_lstm(self, values: list[float], hours: int = 1) -> float:
        """
        Train a simple LSTM on the patient's readings and predict
        the next value. Uses recursive prediction for hours > 1.
        Imports TensorFlow inside the function to avoid slow startup.
        """
        import tensorflow as tf
        tf.random.set_seed(42)
        np.random.seed(42)

        scaler = MinMaxScaler(feature_range=(0, 1))
        arr = np.array(values, dtype=np.float32).reshape(-1, 1)
        scaled = scaler.fit_transform(arr).flatten()

        # Build sequences
        X, y = [], []
        for i in range(len(scaled) - SEQUENCE_LENGTH):
            X.append(scaled[i: i + SEQUENCE_LENGTH])
            y.append(scaled[i + SEQUENCE_LENGTH])

        X = np.array(X).reshape(-1, SEQUENCE_LENGTH, 1)
        y = np.array(y)

        # Build LSTM model
        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(32, input_shape=(SEQUENCE_LENGTH, 1)),
            tf.keras.layers.Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        model.fit(X, y, epochs=30, batch_size=8, verbose=0)

        # Recursive prediction for multi-hour horizon
        sequence = list(scaled[-SEQUENCE_LENGTH:])
        predicted_scaled = None
        for _ in range(hours):
            input_seq = np.array(
                sequence[-SEQUENCE_LENGTH:]).reshape(1, SEQUENCE_LENGTH, 1)
            predicted_scaled = float(model.predict(input_seq, verbose=0)[0][0])
            sequence.append(predicted_scaled)

        # Inverse transform
        predicted_value = float(
            scaler.inverse_transform([[predicted_scaled]])[0][0]
        )
        return round(predicted_value, 1)

    # ==========================================
    # OpenAI Advice
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
    ) -> dict | None:
        """
        Call Groq API (LLaMA 3.3) to generate personalized advice for both
        the patient and their family members.
        Returns dict with 'patient' and 'family' keys, or None on failure.
        """
        if not GROQ_API_KEY:
            return None

        lang_instruction = {
            "ar": "Respond ONLY in Arabic.",
            "en": "Respond ONLY in English.",
            "he": "Respond ONLY in Hebrew.",
        }.get(lang, "Respond ONLY in Arabic.")

        prompt = f"""You are a medical assistant specialized in Type 2 diabetes patients.
{lang_instruction}

Patient data:
- Name: {patient_name}
- Current glucose: {current} mg/dL
- Trend: {trend}
- Predicted glucose in {hours} hour(s): {predicted} mg/dL
- Alert type: {alert_type}

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
                # Extract JSON from response
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

    def predict(
        self,
        user_id: str,
        patient_name: str,
        hours: int = 1,
        lang: str = "ar",
    ) -> dict:
        """
        Full prediction pipeline:
        1. Fetch readings from Firestore
        2. Remove outliers
        3. Check minimum readings
        4. Train LSTM and predict
        5. Detect patch error
        6. Determine alert type
        7. Get OpenAI advice if alert
        8. Return structured result
        """
        raw_readings = self._fetch_readings(user_id)
        cleaned_readings = self._remove_outliers(raw_readings)
        values = [r["value"] for r in cleaned_readings]

        if len(values) < MIN_READINGS:
            return {
                "predicted_value": None,
                "hours": hours,
                "trend": None,
                "alert_type": None,
                "advice": None,
                "readings_used": len(values),
                "message": f"بيانات غير كافية — يلزم {MIN_READINGS} قراءة على الأقل، لديك {len(values)} فقط.",
            }

        # If the last reading was replaced by outlier removal, flag as patch error
        raw_last = raw_readings[-1]["value"] if raw_readings else None
        last_was_outlier = raw_last is not None and raw_last != values[-1]

        current = raw_last if raw_last is not None else values[-1]
        predicted = self._predict_lstm(values, hours)
        trend = self._calculate_trend(values)
        patch_error = last_was_outlier or self._detect_patch_error(current, predicted)
        alert_type = self._get_alert_type(current, predicted, patch_error)

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
