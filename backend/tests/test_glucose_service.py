"""
Unit tests for GlucoseService methods (direct service testing).
Tests actual service logic with mocked Firestore via patch.object on db.
Covers: create_reading, batch_import_readings, calculate_stats,
        get_estimated_a1c, get_readings, get_latest, update_reading.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

PATIENT_ID = "patient_svc_001"


def make_doc(value=120, hours_ago=1, source="manual"):
    doc = MagicMock()
    doc.id = f"reading_{value}_{hours_ago}"
    measured = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    doc.to_dict.return_value = {
        "userId": PATIENT_ID,
        "value": value,
        "unit": "mg/dL",
        "measuredAt": measured,
        "createdAt": measured,
        "source": source,
    }
    return doc


# ==========================================
# calculate_stats
# ==========================================

class TestCalculateStats:

    def test_stats_correct_values(self, client):
        """Stats returns correct average, min, max, count."""
        from app.services.glucose_service import glucose_service

        docs = [make_doc(80), make_doc(120), make_doc(160)]
        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = glucose_service.calculate_stats(PATIENT_ID, days=7)

        assert result["count"] == 3
        assert result["average"] == round((80 + 120 + 160) / 3, 2)
        assert result["min"] == 80
        assert result["max"] == 160
        assert result["days"] == 7

    def test_stats_empty_returns_zeroed_structure(self, client):
        """No readings returns zeroed structure without raising an exception."""
        from app.services.glucose_service import glucose_service

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([])
            result = glucose_service.calculate_stats(PATIENT_ID, days=7)

        assert result["count"] == 0
        assert result["average"] is None
        assert result["min"] is None
        assert result["max"] is None
        assert result["time_in_range"] is None

    def test_stats_time_in_range_two_out_of_three(self, client):
        """2 in-range (70–180) out of 3 → time_in_range = 66.7%."""
        from app.services.glucose_service import glucose_service

        docs = [make_doc(100), make_doc(150), make_doc(250)]
        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = glucose_service.calculate_stats(PATIENT_ID, days=7)

        assert result["time_in_range"] == round(2 / 3 * 100, 1)

    def test_stats_old_reading_excluded_from_7_day_window(self, client):
        """Reading older than 7 days is excluded from stats."""
        from app.services.glucose_service import glucose_service

        recent = make_doc(120, hours_ago=2)
        old    = make_doc(300, hours_ago=24 * 10)   # 10 days old

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([recent, old])
            result = glucose_service.calculate_stats(PATIENT_ID, days=7)

        assert result["count"] == 1
        assert result["average"] == 120.0

    def test_stats_all_in_range_100_percent(self, client):
        """All readings in 70–180 → time_in_range = 100%."""
        from app.services.glucose_service import glucose_service

        docs = [make_doc(v) for v in [70, 120, 150, 180]]
        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = glucose_service.calculate_stats(PATIENT_ID, days=7)

        assert result["time_in_range"] == 100.0


# ==========================================
# get_estimated_a1c
# ==========================================

class TestGetEstimatedA1C:

    def test_a1c_formula_correct(self, client):
        """A1C formula: (avg + 46.7) / 28.7. Avg=154 → eA1C ≈ 7.0."""
        from app.services.glucose_service import glucose_service

        docs = []
        for i in range(20):
            d = make_doc(154, hours_ago=i * 24)
            docs.append(d)

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = glucose_service.get_estimated_a1c(PATIENT_ID)

        assert result["estimated_a1c"] is not None
        assert abs(result["estimated_a1c"] - round((154 + 46.7) / 28.7, 1)) < 0.1
        assert result["readings_count"] == 20
        assert result["is_reliable"] is True

    def test_a1c_no_readings_returns_none(self, client):
        """No readings → all fields None, is_reliable False."""
        from app.services.glucose_service import glucose_service

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([])
            result = glucose_service.get_estimated_a1c(PATIENT_ID)

        assert result["estimated_a1c"] is None
        assert result["is_reliable"] is False
        assert result["readings_count"] == 0

    def test_a1c_less_than_14_days_not_reliable(self, client):
        """Less than 14 days of data → is_reliable = False."""
        from app.services.glucose_service import glucose_service

        docs = [make_doc(120, hours_ago=i * 6) for i in range(5)]
        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = glucose_service.get_estimated_a1c(PATIENT_ID)

        assert result["is_reliable"] is False

    def test_a1c_time_in_range_breakdown(self, client):
        """TIR breakdown: each category gets 20% with 5 equal-spread readings."""
        from app.services.glucose_service import glucose_service

        readings = [
            make_doc(50,  hours_ago=24 * 0),   # very_low  < 54
            make_doc(65,  hours_ago=24 * 1),   # low       54-69
            make_doc(120, hours_ago=24 * 2),   # in_range  70-180
            make_doc(200, hours_ago=24 * 3),   # high      181-250
            make_doc(300, hours_ago=24 * 4),   # very_high > 250
        ]

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(readings)
            result = glucose_service.get_estimated_a1c(PATIENT_ID)

        tir = result["time_in_range"]
        assert tir is not None
        assert tir["very_low"]  == 20.0
        assert tir["low"]       == 20.0
        assert tir["in_range"]  == 20.0
        assert tir["high"]      == 20.0
        assert tir["very_high"] == 20.0


# ==========================================
# get_readings / get_latest
# ==========================================

class TestGetReadings:

    def test_readings_sorted_newest_first(self, client):
        """Readings are returned sorted by measuredAt descending."""
        from app.services.glucose_service import glucose_service

        older = make_doc(100, hours_ago=5)
        newer = make_doc(160, hours_ago=1)

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([older, newer])
            result = glucose_service.get_readings(PATIENT_ID)

        assert result[0]["value"] == 160
        assert result[1]["value"] == 100

    def test_readings_respects_limit(self, client):
        """limit parameter caps the number of returned readings."""
        from app.services.glucose_service import glucose_service

        docs = [make_doc(100 + i, hours_ago=i) for i in range(10)]
        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = glucose_service.get_readings(PATIENT_ID, limit=3)

        assert len(result) == 3

    def test_readings_includes_id(self, client):
        """Each returned reading includes the Firestore document id."""
        from app.services.glucose_service import glucose_service

        doc = make_doc(120)
        doc.id = "doc_abc"

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([doc])
            result = glucose_service.get_readings(PATIENT_ID)

        assert result[0]["id"] == "doc_abc"

    def test_get_latest_returns_newest(self, client):
        """get_latest returns the reading with the most recent measuredAt."""
        from app.services.glucose_service import glucose_service

        older = make_doc(100, hours_ago=10)
        newer = make_doc(180, hours_ago=1)

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([older, newer])
            result = glucose_service.get_latest(PATIENT_ID)

        assert result["value"] == 180

    def test_get_latest_returns_none_when_empty(self, client):
        """get_latest returns None when there are no readings."""
        from app.services.glucose_service import glucose_service

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([])
            result = glucose_service.get_latest(PATIENT_ID)

        assert result is None


# ==========================================
# update_reading
# ==========================================

class TestUpdateReading:

    def test_update_manual_reading_success(self, client):
        """Manual reading owned by the user is updated successfully."""
        from app.services.glucose_service import glucose_service

        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {
            "userId": PATIENT_ID, "value": 120, "source": "manual",
        }

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            mock_db.collection.return_value.document.return_value.update.return_value = None
            result = glucose_service.update_reading(PATIENT_ID, "reading_001", 150)

        assert result is not None
        assert result["value"] == 150

    def test_update_csv_reading_returns_none(self, client):
        """CSV/CGM readings cannot be edited — returns None."""
        from app.services.glucose_service import glucose_service

        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {
            "userId": PATIENT_ID, "value": 120, "source": "csv_cgm",
        }

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            result = glucose_service.update_reading(PATIENT_ID, "reading_001", 150)

        assert result is None

    def test_update_wrong_user_returns_none(self, client):
        """Reading owned by a different user cannot be updated."""
        from app.services.glucose_service import glucose_service

        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {
            "userId": "other_patient", "value": 120, "source": "manual",
        }

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            result = glucose_service.update_reading(PATIENT_ID, "reading_001", 150)

        assert result is None

    def test_update_nonexistent_reading_returns_none(self, client):
        """Non-existent reading returns None."""
        from app.services.glucose_service import glucose_service

        doc = MagicMock()
        doc.exists = False

        with patch.object(glucose_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            result = glucose_service.update_reading(PATIENT_ID, "nonexistent", 150)

        assert result is None


# ==========================================
# create_reading
# ==========================================

def _make_create_db(doc_id="reading_new_001"):
    """
    Build a db mock that handles all three collections used in create_reading:
      glucose_readings → new doc_ref
      users            → patient name lookup
      predictions      → _fill_prediction_actuals (returns empty stream)
    """
    mock_db = MagicMock()
    doc_ref = MagicMock()
    doc_ref.id = doc_id

    patient_doc = MagicMock()
    patient_doc.exists = True
    patient_doc.to_dict.return_value = {"firstName": "Test", "lastName": "User"}

    def collection_se(name):
        coll = MagicMock()
        if name == "glucose_readings":
            coll.document.return_value = doc_ref
        elif name == "users":
            coll.document.return_value.get.return_value = patient_doc
        else:                                    # predictions
            coll.where.return_value.where.return_value.stream.return_value = iter([])
        return coll

    mock_db.collection.side_effect = collection_se
    return mock_db, doc_ref


class TestCreateReading:

    def test_create_returns_document_with_id(self, client):
        """create_reading saves to Firestore and returns doc with generated id."""
        from app.services.glucose_service import glucose_service
        from app.models.glucose_reading import GlucoseCreate

        data = GlucoseCreate(value=120, measuredAt=datetime.now(timezone.utc))
        mock_db, doc_ref = _make_create_db("reading_abc")

        with patch.object(glucose_service, "db", mock_db), \
             patch("app.services.family_service.send_emergency_notification"):
            result = glucose_service.create_reading(PATIENT_ID, data)

        assert result["id"] == "reading_abc"
        assert result["value"] == 120
        assert result["source"] == "manual"
        doc_ref.set.assert_called_once()

    def test_create_normal_glucose_no_notification(self, client):
        """Normal glucose (70–300) does not trigger emergency notification."""
        from app.services.glucose_service import glucose_service
        from app.models.glucose_reading import GlucoseCreate

        data = GlucoseCreate(value=120, measuredAt=datetime.now(timezone.utc))
        mock_db, _ = _make_create_db()

        with patch.object(glucose_service, "db", mock_db), \
             patch("app.services.family_service.send_emergency_notification") as mock_notify:
            glucose_service.create_reading(PATIENT_ID, data)

        mock_notify.assert_not_called()

    def test_create_low_glucose_triggers_notification(self, client):
        """Glucose < 70 triggers emergency notification with correct value."""
        from app.services.glucose_service import glucose_service
        from app.models.glucose_reading import GlucoseCreate

        data = GlucoseCreate(value=55, measuredAt=datetime.now(timezone.utc))
        mock_db, _ = _make_create_db()

        with patch.object(glucose_service, "db", mock_db), \
             patch("app.services.family_service.send_emergency_notification") as mock_notify:
            result = glucose_service.create_reading(PATIENT_ID, data)

        assert result["value"] == 55
        mock_notify.assert_called_once()
        _, kwargs = mock_notify.call_args
        assert kwargs.get("glucose_value") == 55

    def test_create_high_glucose_triggers_notification(self, client):
        """Glucose > 300 triggers emergency notification with correct value."""
        from app.services.glucose_service import glucose_service
        from app.models.glucose_reading import GlucoseCreate

        data = GlucoseCreate(value=350, measuredAt=datetime.now(timezone.utc))
        mock_db, _ = _make_create_db()

        with patch.object(glucose_service, "db", mock_db), \
             patch("app.services.family_service.send_emergency_notification") as mock_notify:
            result = glucose_service.create_reading(PATIENT_ID, data)

        assert result["value"] == 350
        mock_notify.assert_called_once()

    def test_create_boundary_300_no_notification(self, client):
        """Glucose exactly 300 is NOT above DANGEROUS_HIGH → no notification."""
        from app.services.glucose_service import glucose_service
        from app.models.glucose_reading import GlucoseCreate

        data = GlucoseCreate(value=300, measuredAt=datetime.now(timezone.utc))
        mock_db, _ = _make_create_db()

        with patch.object(glucose_service, "db", mock_db), \
             patch("app.services.family_service.send_emergency_notification") as mock_notify:
            glucose_service.create_reading(PATIENT_ID, data)

        mock_notify.assert_not_called()

    def test_create_notification_failure_doesnt_crash(self, client):
        """Notification failure is caught silently — result is still returned."""
        from app.services.glucose_service import glucose_service
        from app.models.glucose_reading import GlucoseCreate

        data = GlucoseCreate(value=55, measuredAt=datetime.now(timezone.utc))
        mock_db, _ = _make_create_db()

        with patch.object(glucose_service, "db", mock_db), \
             patch("app.services.family_service.send_emergency_notification",
                   side_effect=Exception("Network error")):
            result = glucose_service.create_reading(PATIENT_ID, data)

        assert result["value"] == 55    # still returns correctly


# ==========================================
# batch_import_readings
# ==========================================

def _make_batch_db(existing_timestamps=None):
    """
    Build a db mock for batch_import_readings.
    existing_timestamps: list of datetime objects already in Firestore.
    """
    mock_db = MagicMock()

    existing_docs = []
    for ts in (existing_timestamps or []):
        doc = MagicMock()
        doc.to_dict.return_value = {"measuredAt": ts}
        existing_docs.append(doc)

    mock_db.collection.return_value.where.return_value.stream.return_value = iter(existing_docs)
    batch_mock = MagicMock()
    mock_db.batch.return_value = batch_mock
    mock_db.collection.return_value.document.return_value = MagicMock()
    return mock_db, batch_mock


class TestBatchImportReadings:

    def test_import_all_readings_when_db_empty(self, client):
        """All readings imported when Firestore has no existing data."""
        from app.services.glucose_service import glucose_service

        mock_db, batch = _make_batch_db()
        readings = [
            {"value": 120, "measuredAt": datetime.now(timezone.utc) - timedelta(hours=2)},
            {"value": 140, "measuredAt": datetime.now(timezone.utc) - timedelta(hours=1)},
        ]

        with patch.object(glucose_service, "db", mock_db):
            imported, skipped = glucose_service.batch_import_readings(PATIENT_ID, readings)

        assert imported == 2
        assert skipped == 0
        batch.commit.assert_called_once()

    def test_import_skips_readings_older_than_latest(self, client):
        """Readings at or before the latest stored timestamp are skipped."""
        from app.services.glucose_service import glucose_service

        existing_ts = datetime.now(timezone.utc) - timedelta(hours=2)
        mock_db, batch = _make_batch_db(existing_timestamps=[existing_ts])

        readings = [
            {"value": 100, "measuredAt": existing_ts - timedelta(hours=1)},  # older → skip
            {"value": 130, "measuredAt": datetime.now(timezone.utc)},         # newer → import
        ]

        with patch.object(glucose_service, "db", mock_db):
            imported, skipped = glucose_service.batch_import_readings(PATIENT_ID, readings)

        assert imported == 1
        assert skipped == 1

    def test_import_empty_list_returns_zero(self, client):
        """Empty readings list returns (0, 0) without writing to Firestore."""
        from app.services.glucose_service import glucose_service

        mock_db, batch = _make_batch_db()

        with patch.object(glucose_service, "db", mock_db):
            imported, skipped = glucose_service.batch_import_readings(PATIENT_ID, [])

        assert imported == 0
        assert skipped == 0
        batch.commit.assert_not_called()

    def test_import_prevents_intra_batch_duplicates(self, client):
        """Two readings at the same minute — only the first is imported."""
        from app.services.glucose_service import glucose_service

        mock_db, _ = _make_batch_db()
        same_ts = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        readings = [
            {"value": 120, "measuredAt": same_ts},
            {"value": 125, "measuredAt": same_ts},   # same minute → duplicate
        ]

        with patch.object(glucose_service, "db", mock_db):
            imported, skipped = glucose_service.batch_import_readings(PATIENT_ID, readings)

        assert imported == 1

    def test_import_all_skipped_when_all_old(self, client):
        """When all readings are older than latest, imported=0 and all are skipped."""
        from app.services.glucose_service import glucose_service

        latest_ts = datetime.now(timezone.utc)
        mock_db, batch = _make_batch_db(existing_timestamps=[latest_ts])

        old_readings = [
            {"value": 100, "measuredAt": latest_ts - timedelta(hours=3)},
            {"value": 110, "measuredAt": latest_ts - timedelta(hours=2)},
        ]

        with patch.object(glucose_service, "db", mock_db):
            imported, skipped = glucose_service.batch_import_readings(PATIENT_ID, old_readings)

        assert imported == 0
        assert skipped == 2
        batch.commit.assert_not_called()
