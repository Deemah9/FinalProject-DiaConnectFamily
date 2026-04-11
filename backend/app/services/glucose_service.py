from datetime import datetime, timezone, timedelta
from firebase_admin import firestore
from app.models.glucose_reading import GlucoseCreate, GlucoseDocument


# ==========================================
# Glucose Service
# ==========================================

class GlucoseService:
    """
    Service layer for glucose reading business logic.
    Handles all Firestore operations and calculations
    related to glucose readings.
    Separated from routes to allow reuse by AI and analytics modules.
    """

    def __init__(self):
        self.db = firestore.client()
        self.collection = "glucose_readings"

    # ==========================================
    # Create Reading
    # ==========================================

    def create_reading(self, user_id: str, data: GlucoseCreate) -> dict:
        """
        Save a new glucose reading to Firestore.
        Source is always set to 'manual' for patient-submitted readings.
        Uses GlucoseDocument model to ensure data consistency.
        Returns the saved document including its generated ID.
        """
        doc_ref = self.db.collection(self.collection).document()

        document = GlucoseDocument(
            userId=user_id,
            value=data.value,
            measuredAt=data.measuredAt,
            source="manual",
            createdAt=datetime.now(timezone.utc)
        )

        doc_ref.set(document.dict())
        result = document.dict()
        result["id"] = doc_ref.id
        return result

    # ==========================================
    # Get All Readings
    # ==========================================

    def get_readings(self, user_id: str, limit: int = 50) -> list:
        """
        Retrieve glucose readings for a specific user.
        Sorting is done in Python to avoid requiring a composite
        Firestore index on (userId, measuredAt).
        limit: caps the number of results returned.
        """
        docs = self.db.collection(self.collection) \
            .where("userId", "==", user_id) \
            .stream()

        readings = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            readings.append(data)

        readings.sort(
            key=lambda r: r.get("measuredAt") or datetime.min.replace(
                tzinfo=timezone.utc
            ),
            reverse=True,
        )

        return readings[:limit]

    # ==========================================
    # Get Latest Reading
    # ==========================================

    def get_latest(self, user_id: str) -> dict | None:
        """
        Retrieve the most recent glucose reading for a specific user.
        Returns None if no readings exist.
        Sorting done in Python to avoid composite index requirement.
        """
        readings = self.get_readings(user_id=user_id, limit=1)
        return readings[0] if readings else None

    # ==========================================
    # Delete Reading
    # ==========================================

    def delete_reading(self, user_id: str, reading_id: str) -> bool:
        """
        Delete a glucose reading by ID.
        Returns True if deleted, False if not found or not owned by user.
        Ownership is verified before deletion to prevent cross-user access.
        """
        doc_ref = self.db.collection(self.collection).document(reading_id)
        doc = doc_ref.get()

        if not doc.exists:
            return False

        data = doc.to_dict()
        if data.get("userId") != user_id:
            return False

        doc_ref.delete()
        return True

    # ==========================================
    # Calculate Statistics
    # ==========================================

    def calculate_stats(self, user_id: str, days: int = 7) -> dict:
        """
        Calculate glucose statistics for a specific user within a date window.
        days: filter window — 7, 14, or 30 days back from now.
        Date filtering is done in Python to avoid requiring a composite
        Firestore index on (userId, measuredAt) for range queries.
        Computes average, min, max, count, and time_in_range.
        Returns zeroed structure if no readings are found.
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)

        docs = self.db.collection(self.collection) \
            .where("userId", "==", user_id) \
            .stream()

        values = []
        for doc in docs:
            data = doc.to_dict()
            measured = data.get("measuredAt")
            if measured is None:
                continue
            # Firestore returns timezone-aware datetimes; normalise just in case
            if hasattr(measured, "tzinfo") and measured.tzinfo is None:
                measured = measured.replace(tzinfo=timezone.utc)
            if measured >= since:
                values.append(data["value"])

        if not values:
            return {
                "count": 0,
                "average": None,
                "min": None,
                "max": None,
                "time_in_range": None,
                "days": days,
            }

        in_range = sum(1 for v in values if 70 <= v <= 180)

        return {
            "count": len(values),
            "average": round(sum(values) / len(values), 2),
            "min": min(values),
            "max": max(values),
            "time_in_range": round((in_range / len(values)) * 100, 1),
            "days": days,
        }


# Single instance to be used across the app
glucose_service = GlucoseService()
