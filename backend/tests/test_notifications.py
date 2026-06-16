"""
Tests for emergency glucose notifications.
Verifies that push notifications are triggered correctly
when a patient logs a dangerous glucose reading.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from tests.conftest import auth_headers


PATIENT_ID = "patient_001"
FAMILY_ID = "family_001"
EXPO_TOKEN = "ExponentPushToken[test_token_abc]"


def make_link_doc():
    doc = MagicMock()
    doc.to_dict.return_value = {
        "family_member_id": FAMILY_ID,
        "patient_id": PATIENT_ID,
    }
    return doc


def make_patient_doc_no_token():
    """Patient doc with no push token — so patient self-notification is skipped."""
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {
        "firstName": "Deema",
        "lastName": "Nimer",
        "pushToken": "",
        "language": "en",
    }
    return doc


def make_patient_doc_not_exists():
    """Patient doc that doesn't exist — skips patient notification entirely."""
    doc = MagicMock()
    doc.exists = False
    return doc


def make_family_user_doc(token=EXPO_TOKEN):
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {
        "firstName": "Ma",
        "lastName": "Ma",
        "pushToken": token,
        "language": "en",
    }
    return doc


# ==========================================
# Emergency Notification Tests
# ==========================================

class TestEmergencyNotifications:

    @patch("app.services.family_service.urllib.request.urlopen")
    @patch("app.services.family_service.db")
    def test_low_glucose_triggers_notification(self, mock_db, mock_urlopen):
        """Glucose < 70 triggers emergency push notification to family members."""
        link_doc = make_link_doc()
        patient_doc = make_patient_doc_no_token()
        family_user = make_family_user_doc()

        # Patient doc (no token) → family doc (has token)
        mock_db.collection.return_value.document.return_value.get.side_effect = [
            patient_doc, family_user
        ]
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([link_doc])

        from app.services.family_service import send_emergency_notification
        send_emergency_notification(
            patient_id=PATIENT_ID,
            patient_name="Deema Nimer",
            glucose_value=55,
        )

        mock_urlopen.assert_called_once()
        import json
        body = json.loads(mock_urlopen.call_args[0][0].data.decode())
        assert body[0]["to"] == EXPO_TOKEN
        assert "LOW" in body[0]["body"]
        assert "55" in body[0]["body"]

    @patch("app.services.family_service.urllib.request.urlopen")
    @patch("app.services.family_service.db")
    def test_high_glucose_triggers_notification(self, mock_db, mock_urlopen):
        """Glucose > 300 triggers emergency push notification."""
        link_doc = make_link_doc()
        patient_doc = make_patient_doc_no_token()
        family_user = make_family_user_doc()

        mock_db.collection.return_value.document.return_value.get.side_effect = [
            patient_doc, family_user
        ]
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([link_doc])

        from app.services.family_service import send_emergency_notification
        send_emergency_notification(
            patient_id=PATIENT_ID,
            patient_name="Deema Nimer",
            glucose_value=350,
        )

        mock_urlopen.assert_called_once()
        import json
        body = json.loads(mock_urlopen.call_args[0][0].data.decode())
        assert "HIGH" in body[0]["body"]
        assert "350" in body[0]["body"]

    @patch("app.services.family_service.urllib.request.urlopen")
    @patch("app.services.family_service.db")
    def test_no_notification_for_normal_glucose(self, mock_db, mock_urlopen):
        """Normal glucose (70-300): patient has no token, no family → no notification."""
        patient_doc = make_patient_doc_no_token()
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([])

        from app.services.family_service import send_emergency_notification
        send_emergency_notification(
            patient_id=PATIENT_ID,
            patient_name="Deema Nimer",
            glucose_value=120,
        )

        mock_urlopen.assert_not_called()

    @patch("app.services.family_service.urllib.request.urlopen")
    @patch("app.services.family_service.db")
    def test_no_notification_when_no_family_members(self, mock_db, mock_urlopen):
        """No push notification sent when patient has no token and no family members."""
        patient_doc = make_patient_doc_no_token()
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([])

        from app.services.family_service import send_emergency_notification
        send_emergency_notification(
            patient_id=PATIENT_ID,
            patient_name="Deema Nimer",
            glucose_value=55,
        )

        mock_urlopen.assert_not_called()

    @patch("app.services.family_service.urllib.request.urlopen")
    @patch("app.services.family_service.db")
    def test_no_notification_when_no_push_token(self, mock_db, mock_urlopen):
        """No push notification sent when family member has no registered push token."""
        link_doc = make_link_doc()
        family_user_no_token = MagicMock()
        family_user_no_token.exists = True
        family_user_no_token.to_dict.return_value = {
            "firstName": "Ma",
            "lastName": "Ma",
            "pushToken": "",  # No token
        }

        mock_db.collection.return_value.where.return_value.stream.return_value = iter([link_doc])
        mock_db.collection.return_value.document.return_value.get.return_value = family_user_no_token

        from app.services.family_service import send_emergency_notification
        send_emergency_notification(
            patient_id=PATIENT_ID,
            patient_name="Deema Nimer",
            glucose_value=55,
        )

        mock_urlopen.assert_not_called()

    @patch("app.services.family_service.urllib.request.urlopen")
    @patch("app.services.family_service.db")
    def test_notification_failure_does_not_crash(self, mock_db, mock_urlopen):
        """If Expo Push API fails, no exception is raised (silent failure)."""
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        link_doc = make_link_doc()
        family_user = make_family_user_doc()

        mock_db.collection.return_value.where.return_value.stream.return_value = iter([link_doc])
        mock_db.collection.return_value.document.return_value.get.return_value = family_user

        from app.services.family_service import send_emergency_notification

        # Should not raise any exception
        try:
            send_emergency_notification(
                patient_id=PATIENT_ID,
                patient_name="Deema Nimer",
                glucose_value=55,
            )
        except Exception as e:
            assert False, f"send_emergency_notification raised an exception: {e}"
