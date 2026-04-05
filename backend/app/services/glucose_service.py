from datetime import datetime, timezone
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
        Returns a list of reading documents ordered by measuredAt descending.
        limit: caps the number of documents fetched from Firestore.
        Note: Requires a Firestore composite index on userId + measuredAt.
        """
        docs = self.db.collection(self.collection) \
            .where("userId", "==", user_id) \
            .order_by("measuredAt", direction=firestore.Query.DESCENDING) \
            .limit(limit) \
            .stream()

        readings = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            readings.append(data)

        return readings

    # ==========================================
    # Get Latest Reading
    # ==========================================

    def get_latest(self, user_id: str) -> dict | None:
        """
        Retrieve the most recent glucose reading for a specific user.
        Returns None if no readings exist.
        Note: Requires a Firestore composite index on userId + measuredAt.
        """
        docs = self.db.collection(self.collection) \
            .where("userId", "==", user_id) \
            .order_by("measuredAt", direction=firestore.Query.DESCENDING) \
            .limit(1) \
            .stream()

        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            return data

        return None

    # ==========================================
    # Calculate Statistics
    # ==========================================

    def calculate_stats(self, user_id: str) -> dict:
        """
        Calculate basic glucose statistics for a specific user.
        Computes average, min, max, and count from all stored readings.
        Designed to be extensible for future date filtering and AI features.
        Returns zeroed structure if no readings are found for consistent Frontend handling.
        """
        docs = self.db.collection(self.collection) \
            .where("userId", "==", user_id) \
            .stream()

        values = [doc.to_dict()["value"] for doc in docs]

        if not values:
            return {
                "count": 0,
                "average": None,
                "min": None,
                "max": None
            }

        return {
            "count": len(values),
            "average": round(sum(values) / len(values), 2),
            "min": min(values),
            "max": max(values)
        }


# Single instance to be used across the app
glucose_service = GlucoseService()
