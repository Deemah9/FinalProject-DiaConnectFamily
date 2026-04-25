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

    DANGEROUS_LOW = 70
    DANGEROUS_HIGH = 300

    def create_reading(self, user_id: str, data: GlucoseCreate) -> dict:
        """
        Save a new glucose reading to Firestore.
        Source is always set to 'manual' for patient-submitted readings.
        Uses GlucoseDocument model to ensure data consistency.
        Returns the saved document including its generated ID.
        Triggers emergency push notifications for family members if value is dangerous.
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

        # Send emergency notifications for dangerous glucose values
        if data.value < self.DANGEROUS_LOW or data.value > self.DANGEROUS_HIGH:
            try:
                from app.services.family_service import send_emergency_notification
                patient_doc = self.db.collection("users").document(user_id).get()
                patient_name = "Patient"
                if patient_doc.exists:
                    pdata = patient_doc.to_dict()
                    patient_name = (
                        f"{pdata.get('firstName', '')} {pdata.get('lastName', '')}".strip()
                        or pdata.get("email", "Patient")
                    )
                send_emergency_notification(
                    patient_id=user_id,
                    patient_name=patient_name,
                    glucose_value=data.value,
                )
            except Exception as e:
                print(f"⚠️ Notification error: {e}")

        return result

    # ==========================================
    # Import Reading from LibreView (single)
    # ==========================================

    def create_reading_from_import(
        self,
        user_id: str,
        value: int,
        measured_at: datetime,
        source: str = "libreview",
    ) -> dict | None:
        """
        Save a single imported glucose reading with per-row deduplication.
        Used by the LibreView sync flow.
        For bulk CSV imports use batch_import_readings instead.
        """
        if measured_at.tzinfo is None:
            measured_at = measured_at.replace(tzinfo=timezone.utc)

        existing = (
            self.db.collection(self.collection)
            .where("userId", "==", user_id)
            .where("measuredAt", "==", measured_at)
            .limit(1)
            .stream()
        )
        for _ in existing:
            return None

        doc_ref = self.db.collection(self.collection).document()
        document = GlucoseDocument(
            userId=user_id,
            value=value,
            measuredAt=measured_at,
            source=source,
            createdAt=datetime.now(timezone.utc),
        )
        doc_ref.set(document.dict())
        result = document.dict()
        result["id"] = doc_ref.id
        return result

    # ==========================================
    # Batch Import (CSV / bulk)
    # ==========================================

    BATCH_SIZE = 400  # Firestore limit is 500; stay below for safety

    def batch_import_readings(
        self,
        user_id: str,
        readings: list[dict],  # [{"value": int, "measuredAt": datetime}]
        source: str = "csv",
    ) -> tuple[int, int]:
        """
        Efficiently import many glucose readings in bulk.

        Strategy (3 Firestore round-trips regardless of reading count):
          1. Stream all existing measuredAt values for this user → Python set.
          2. Filter duplicates in memory.
          3. Write new readings in batches of BATCH_SIZE.

        Returns (imported_count, skipped_count).
        """
        # ── 1. Fetch existing timestamps ──────────────────────────
        existing_ts: set[datetime] = set()
        docs = (
            self.db.collection(self.collection)
            .where("userId", "==", user_id)
            .stream()
        )
        for doc in docs:
            ts = doc.to_dict().get("measuredAt")
            if ts is not None:
                if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                existing_ts.add(ts)

        # ── 2. Deduplicate in memory ──────────────────────────────
        now = datetime.now(timezone.utc)
        new_readings = []
        skipped = 0

        for r in readings:
            ts = r["measuredAt"]
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts in existing_ts:
                skipped += 1
            else:
                new_readings.append({"value": r["value"], "measuredAt": ts})
                existing_ts.add(ts)  # prevent intra-batch duplicates

        # ── 3. Batch write ────────────────────────────────────────
        imported = 0
        for chunk_start in range(0, len(new_readings), self.BATCH_SIZE):
            chunk = new_readings[chunk_start: chunk_start + self.BATCH_SIZE]
            batch = self.db.batch()
            for r in chunk:
                doc_ref = self.db.collection(self.collection).document()
                document = GlucoseDocument(
                    userId=user_id,
                    value=r["value"],
                    measuredAt=r["measuredAt"],
                    source=source,
                    createdAt=now,
                )
                batch.set(doc_ref, document.dict())
                imported += 1
            batch.commit()

        return imported, skipped

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
