from datetime import datetime, timezone, timedelta
from firebase_admin import firestore


# ==========================================
# Alert Thresholds
# ==========================================

HIGH_THRESHOLD = 180  # mg/dL — above this is high
LOW_THRESHOLD = 70    # mg/dL — below this is low


# ==========================================
# Alert Service
# ==========================================

class AlertService:
    """
    Service layer for glucose alert logic.
    Detects high and low glucose readings and stores
    alert records in Firestore for the alerts screen.
    """

    def __init__(self):
        self.db = firestore.client()
        self.collection = "alerts"

    # ==========================================
    # Evaluate a reading and store alert if needed
    # ==========================================

    def evaluate_and_store(
        self, user_id: str, reading_id: str, value: int
    ) -> dict | None:
        """
        Check if a glucose value is out of range.
        If high (> 180) or low (< 70), create and store an alert.
        Returns the alert dict if created, None otherwise.
        Called automatically when a glucose reading is saved.
        """
        if value > HIGH_THRESHOLD:
            alert_type = "high"
        elif value < LOW_THRESHOLD:
            alert_type = "low"
        else:
            return None

        doc_ref = self.db.collection(self.collection).document()
        alert = {
            "userId": user_id,
            "type": alert_type,
            "value": value,
            "readingId": reading_id,
            "createdAt": datetime.now(timezone.utc),
            "read": False,
        }
        doc_ref.set(alert)
        alert["id"] = doc_ref.id
        return alert

    # ==========================================
    # Get Recent Alerts
    # ==========================================

    def delete_by_reading_id(self, reading_id: str) -> None:
        """
        Delete all alerts associated with a specific glucose reading.
        Called automatically when a reading is deleted so the alerts
        screen stays consistent with the reading history.
        """
        docs = (
            self.db.collection(self.collection)
            .where("readingId", "==", reading_id)
            .stream()
        )
        for doc in docs:
            doc.reference.delete()

    def get_alerts(self, user_id: str, limit: int = 20) -> list:
        """
        Retrieve the most recent alerts for a user.
        Auto-deletes alerts older than 7 days before returning.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        docs = (
            self.db.collection(self.collection)
            .where("userId", "==", user_id)
            .stream()
        )

        alerts = []
        for doc in docs:
            data = doc.to_dict()
            created = data.get("createdAt")
            if created:
                if hasattr(created, "tzinfo") and created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                if created < cutoff:
                    doc.reference.delete()
                    continue
            data["id"] = doc.id
            data.setdefault("read", False)
            alerts.append(data)

        alerts.sort(
            key=lambda a: a.get("createdAt") or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        return alerts[:limit]

    def mark_as_read(self, alert_id: str, user_id: str) -> bool:
        """Mark a single alert as read. Returns False if not found or not owned."""
        doc_ref = self.db.collection(self.collection).document(alert_id)
        doc = doc_ref.get()
        if not doc.exists or doc.to_dict().get("userId") != user_id:
            return False
        doc_ref.update({"read": True})
        return True

    def mark_all_as_read(self, user_id: str) -> None:
        """Mark all unread alerts for a user as read."""
        docs = (
            self.db.collection(self.collection)
            .where("userId", "==", user_id)
            .stream()
        )
        for doc in docs:
            if not doc.to_dict().get("read", False):
                doc.reference.update({"read": True})


# Single instance to be used across the app
alert_service = AlertService()
