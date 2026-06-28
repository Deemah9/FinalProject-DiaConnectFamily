"""
Unit tests for AlertService methods (direct service testing).
Tests actual service logic with mocked Firestore via patch.object on db.
Covers: get_alerts, mark_as_read, mark_all_as_read, delete_by_reading_id.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

PATIENT_ID = "patient_alert_svc_001"


def make_alert_doc(value=250, alert_type="high", read=False, days_ago=0):
    doc = MagicMock()
    doc.id = f"alert_{value}_{days_ago}"
    created = datetime.now(timezone.utc) - timedelta(days=days_ago)
    doc.to_dict.return_value = {
        "userId": PATIENT_ID,
        "type": alert_type,
        "value": value,
        "readingId": f"reading_{value}",
        "createdAt": created,
        "read": read,
    }
    doc.reference = MagicMock()
    return doc


# ==========================================
# get_alerts
# ==========================================

class TestGetAlerts:

    def test_get_alerts_returns_newest_first(self, client):
        """Alerts are sorted by createdAt descending (newest first)."""
        from app.services.alert_service import alert_service

        older = make_alert_doc(200, days_ago=2)
        newer = make_alert_doc(55, "low", days_ago=0)

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([older, newer])
            result = alert_service.get_alerts(PATIENT_ID)

        assert len(result) == 2
        assert result[0]["value"] == 55   # newer first
        assert result[1]["value"] == 200

    def test_get_alerts_deletes_alerts_older_than_7_days(self, client):
        """Alerts older than 7 days are deleted and excluded from results."""
        from app.services.alert_service import alert_service

        old    = make_alert_doc(300, days_ago=10)   # > 7 days → deleted
        recent = make_alert_doc(200, days_ago=1)    # < 7 days → kept

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([old, recent])
            result = alert_service.get_alerts(PATIENT_ID)

        assert len(result) == 1
        assert result[0]["value"] == 200
        old.reference.delete.assert_called_once()

    def test_get_alerts_respects_limit(self, client):
        """limit parameter caps the number of returned alerts."""
        from app.services.alert_service import alert_service

        docs = [make_alert_doc(100 + i, days_ago=i) for i in range(8)]
        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)
            result = alert_service.get_alerts(PATIENT_ID, limit=3)

        assert len(result) == 3

    def test_get_alerts_empty_returns_empty_list(self, client):
        """No alerts returns empty list without raising an exception."""
        from app.services.alert_service import alert_service

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([])
            result = alert_service.get_alerts(PATIENT_ID)

        assert result == []

    def test_get_alerts_includes_id(self, client):
        """Each returned alert includes the Firestore document id."""
        from app.services.alert_service import alert_service

        doc = make_alert_doc(250)
        doc.id = "alert_xyz"

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([doc])
            result = alert_service.get_alerts(PATIENT_ID)

        assert result[0]["id"] == "alert_xyz"

    def test_get_alerts_defaults_read_to_false(self, client):
        """Alert without 'read' field defaults to False."""
        from app.services.alert_service import alert_service

        doc = make_alert_doc(200)
        data = doc.to_dict.return_value
        data.pop("read", None)   # remove read field

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([doc])
            result = alert_service.get_alerts(PATIENT_ID)

        assert result[0]["read"] is False


# ==========================================
# mark_as_read
# ==========================================

class TestMarkAsRead:

    def test_mark_as_read_success(self, client):
        """mark_as_read returns True when alert exists and belongs to user."""
        from app.services.alert_service import alert_service

        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {"userId": PATIENT_ID, "read": False}

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            result = alert_service.mark_as_read("alert_001", PATIENT_ID)

        assert result is True
        mock_db.collection.return_value.document.return_value.update.assert_called_once_with({"read": True})

    def test_mark_as_read_wrong_user_returns_false(self, client):
        """mark_as_read returns False when alert belongs to a different user."""
        from app.services.alert_service import alert_service

        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {"userId": "other_user"}

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            result = alert_service.mark_as_read("alert_001", PATIENT_ID)

        assert result is False

    def test_mark_as_read_nonexistent_returns_false(self, client):
        """mark_as_read returns False when alert does not exist."""
        from app.services.alert_service import alert_service

        doc = MagicMock()
        doc.exists = False

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            result = alert_service.mark_as_read("nonexistent", PATIENT_ID)

        assert result is False


# ==========================================
# mark_all_as_read
# ==========================================

class TestMarkAllAsRead:

    def test_mark_all_as_read_updates_unread(self, client):
        """All unread alerts are marked as read."""
        from app.services.alert_service import alert_service

        alert1 = make_alert_doc(200, read=False)
        alert2 = make_alert_doc(55, "low", read=False)

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([alert1, alert2])
            alert_service.mark_all_as_read(PATIENT_ID)

        alert1.reference.update.assert_called_once_with({"read": True})
        alert2.reference.update.assert_called_once_with({"read": True})

    def test_mark_all_as_read_skips_already_read(self, client):
        """Alerts already marked as read are not updated again."""
        from app.services.alert_service import alert_service

        already_read = make_alert_doc(200, read=True)

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([already_read])
            alert_service.mark_all_as_read(PATIENT_ID)

        already_read.reference.update.assert_not_called()


# ==========================================
# delete_by_reading_id
# ==========================================

class TestDeleteByReadingId:

    def test_delete_by_reading_id_removes_alert(self, client):
        """delete_by_reading_id deletes all alerts linked to a reading."""
        from app.services.alert_service import alert_service

        alert_doc = make_alert_doc(300)

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([alert_doc])
            alert_service.delete_by_reading_id("reading_300")

        alert_doc.reference.delete.assert_called_once()

    def test_delete_by_reading_id_no_alerts_no_error(self, client):
        """delete_by_reading_id does nothing when no alerts match — no exception."""
        from app.services.alert_service import alert_service

        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.where.return_value.stream.return_value = iter([])
            alert_service.delete_by_reading_id("reading_nonexistent")
