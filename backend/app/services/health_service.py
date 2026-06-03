from datetime import datetime, timezone, timedelta
from firebase_admin import firestore
from app.models.health import (
    HealthInfoUpdate, HealthInfoResponse,
    InsulinDoseCreate, InsulinDoseResponse,
)

DEFAULT_ISF = 30.0  # mg/dL per unit (conservative default)


class HealthService:

    def __init__(self):
        self.db = firestore.client()

    # ==========================================
    # Health Info (Profile)
    # ==========================================

    def get_health_info(self, user_id: str) -> HealthInfoResponse:
        doc = self.db.collection("users").document(user_id).get()
        health = doc.to_dict().get("health", {}) if doc.exists else {}
        basal_raw = health.get("basal_insulin")
        return HealthInfoResponse(
            conditions=health.get("conditions", []),
            basal_insulin=basal_raw,
            insulin_sensitivity=health.get("insulin_sensitivity", DEFAULT_ISF),
        )

    def update_health_info(self, user_id: str, data: HealthInfoUpdate) -> HealthInfoResponse:
        payload: dict = {
            "health.conditions": data.conditions,
            "health.insulin_sensitivity": data.insulin_sensitivity or DEFAULT_ISF,
            "updatedAt": datetime.now(timezone.utc),
        }
        if data.basal_insulin:
            payload["health.basal_insulin"] = data.basal_insulin.model_dump()
        else:
            payload["health.basal_insulin"] = None

        self.db.collection("users").document(user_id).update(payload)

        return HealthInfoResponse(
            conditions=data.conditions,
            basal_insulin=data.basal_insulin,
            insulin_sensitivity=data.insulin_sensitivity or DEFAULT_ISF,
        )

    # ==========================================
    # Insulin Doses (Daily Log)
    # ==========================================

    def add_insulin_dose(
        self, user_id: str, data: InsulinDoseCreate
    ) -> InsulinDoseResponse:
        now = datetime.now(timezone.utc)
        doc = {
            "userId":       user_id,
            "insulin_type": data.insulin_type,
            "units":        data.units,
            "timestamp":    data.timestamp,
            "createdAt":    now,
        }
        ref = self.db.collection("insulin_logs").document()
        ref.set(doc)
        return InsulinDoseResponse(id=ref.id, **doc)

    def _dose_from_doc(self, doc) -> InsulinDoseResponse:
        d = doc.to_dict()
        return InsulinDoseResponse(
            id=doc.id,
            insulin_type=d["insulin_type"],
            units=d["units"],
            timestamp=d["timestamp"],
            createdAt=d["createdAt"],
        )

    def _ensure_tz(self, ts):
        if ts and hasattr(ts, "tzinfo") and ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts

    def get_doses_today(self, user_id: str) -> list[InsulinDoseResponse]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        result = []
        for doc in self.db.collection("insulin_logs").where("userId", "==", user_id).stream():
            d = doc.to_dict()
            ts = self._ensure_tz(d.get("timestamp"))
            if ts and ts >= cutoff:
                result.append(self._dose_from_doc(doc))
        result.sort(key=lambda x: x.timestamp, reverse=True)
        return result

    def get_doses_by_date(self, user_id: str, date_str: str) -> list[InsulinDoseResponse]:
        from datetime import date
        day   = date.fromisoformat(date_str)
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        end   = start + timedelta(days=1)
        result = []
        for doc in self.db.collection("insulin_logs").where("userId", "==", user_id).stream():
            d  = doc.to_dict()
            ts = self._ensure_tz(d.get("timestamp"))
            if ts and start <= ts < end:
                result.append(self._dose_from_doc(doc))
        result.sort(key=lambda x: x.timestamp, reverse=True)
        return result

    def delete_insulin_dose(self, user_id: str, dose_id: str) -> bool:
        ref = self.db.collection("insulin_logs").document(dose_id)
        doc = ref.get()
        if not doc.exists or doc.to_dict().get("userId") != user_id:
            return False
        ref.delete()
        return True

    # ==========================================
    # For prediction_service: last N hours
    # ==========================================

    def get_doses_last_hours(
        self, user_id: str, hours: int = 4
    ) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = []
        for doc in self.db.collection("insulin_logs").where("userId", "==", user_id).stream():
            d = doc.to_dict()
            ts = d.get("timestamp")
            if ts is None:
                continue
            if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts >= cutoff:
                result.append({"units": d["units"], "timestamp": ts})
        return result


health_service = HealthService()
