"""
TC09 — Alert Evaluation Logic
TC10 — Alerts Endpoints (patient + family access)
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, patch as mock_patch
from tests.conftest import auth_headers

PATIENT_ID = "patient_alert_001"
FAMILY_ID  = "family_alert_001"


def make_alert(value=250, alert_type="high", read=False):
    return {
        "id": "alert_abc",
        "userId": PATIENT_ID,
        "type": alert_type,
        "value": value,
        "readingId": "reading_xyz",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "read": read,
    }


# ==========================================
# TC09 — Alert Evaluation Logic (Unit)
# Uses client fixture to ensure Firebase is initialized before patching.
# ==========================================

class TestAlertEvaluation:

    def test_high_glucose_creates_high_alert(self, client):
        """TC09: Value > 180 creates a 'high' alert record."""
        from app.services.alert_service import alert_service
        doc_ref = MagicMock()
        doc_ref.id = "alert_001"
        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value = doc_ref
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_001", 250)

        assert result is not None
        assert result["type"] == "high"
        assert result["value"] == 250
        doc_ref.set.assert_called_once()

    def test_low_glucose_creates_low_alert(self, client):
        """TC09: Value < 70 creates a 'low' alert record."""
        from app.services.alert_service import alert_service
        doc_ref = MagicMock()
        doc_ref.id = "alert_002"
        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value = doc_ref
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_002", 55)

        assert result is not None
        assert result["type"] == "low"
        assert result["value"] == 55

    def test_normal_glucose_no_alert(self, client):
        """TC09: Value in range (70–180) returns None — no alert stored."""
        from app.services.alert_service import alert_service
        with patch.object(alert_service, "db") as mock_db:
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_003", 120)

        assert result is None
        mock_db.collection.return_value.document.return_value.set.assert_not_called()

    def test_boundary_exactly_180_no_alert(self, client):
        """TC09: Value exactly 180 is within range — no alert."""
        from app.services.alert_service import alert_service
        with patch.object(alert_service, "db"):
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_004", 180)

        assert result is None

    def test_boundary_exactly_70_no_alert(self, client):
        """TC09: Value exactly 70 is within range — no alert."""
        from app.services.alert_service import alert_service
        with patch.object(alert_service, "db"):
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_005", 70)

        assert result is None

    def test_value_181_triggers_high(self, client):
        """TC09: Value 181 (just above 180) triggers high alert."""
        from app.services.alert_service import alert_service
        doc_ref = MagicMock()
        doc_ref.id = "alert_006"
        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value = doc_ref
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_006", 181)

        assert result is not None
        assert result["type"] == "high"

    def test_value_69_triggers_low(self, client):
        """TC09: Value 69 (just below 70) triggers low alert."""
        from app.services.alert_service import alert_service
        doc_ref = MagicMock()
        doc_ref.id = "alert_007"
        with patch.object(alert_service, "db") as mock_db:
            mock_db.collection.return_value.document.return_value = doc_ref
            result = alert_service.evaluate_and_store(PATIENT_ID, "reading_007", 69)

        assert result is not None
        assert result["type"] == "low"


# ==========================================
# TC10 — Alerts Endpoints
# ==========================================

class TestAlertsEndpoints:

    @patch("app.services.alert_service.alert_service.get_alerts")
    def test_patient_gets_alerts(self, mock_get, client):
        """TC10: Patient retrieves their alert list."""
        mock_get.return_value = [make_alert(250, "high")]

        res = client.get("/alerts/", headers=auth_headers(PATIENT_ID, "patient"))

        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["type"] == "high"
        assert data[0]["value"] == 250

    @patch("app.services.alert_service.alert_service.get_alerts")
    def test_patient_gets_empty_alerts(self, mock_get, client):
        """TC10: No alerts returns empty list (not error)."""
        mock_get.return_value = []

        res = client.get("/alerts/", headers=auth_headers(PATIENT_ID, "patient"))

        assert res.status_code == 200
        assert res.json() == []

    @patch("app.services.alert_service.alert_service.mark_all_as_read")
    def test_mark_all_alerts_read(self, mock_mark, client):
        """TC10: Marking all alerts as read returns ok:True."""
        mock_mark.return_value = None

        res = client.patch("/alerts/read-all", headers=auth_headers(PATIENT_ID, "patient"))

        assert res.status_code == 200
        assert res.json()["ok"] is True

    def test_alerts_requires_auth(self, client):
        """TC10: Accessing alerts without token returns 403."""
        res = client.get("/alerts/")
        assert res.status_code == 403

    @patch("app.routes.alerts.db")
    @patch("app.services.alert_service.alert_service.get_alerts")
    def test_family_member_gets_patient_alerts_when_linked(self, mock_get, mock_db, client):
        """TC10: Family member gets alerts for a linked patient."""
        mock_get.return_value = [make_alert(55, "low")]

        link_doc = MagicMock()
        mock_db.collection.return_value.where.return_value.where.return_value.stream.return_value = iter([link_doc])

        res = client.get(
            f"/alerts/patient/{PATIENT_ID}",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 200
        assert res.json()[0]["type"] == "low"

    @patch("app.routes.alerts.db")
    def test_family_member_blocked_when_not_linked(self, mock_db, client):
        """TC10: Family member gets 403 for alerts of an unlinked patient."""
        mock_db.collection.return_value.where.return_value.where.return_value.stream.return_value = iter([])

        res = client.get(
            f"/alerts/patient/{PATIENT_ID}",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_patient_cannot_access_family_alerts_route(self, client):
        """TC10: /alerts/patient/{id} is restricted to family_member role."""
        res = client.get(
            f"/alerts/patient/{PATIENT_ID}",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 403
