"""
TC02-TC06 — Core Feature Tests
TC02: Add glucose reading
TC03: View glucose history
TC04: Add emergency contact
TC05: Set reminder
TC06: Upload CSV file
All Firestore and service calls are mocked — no real database is touched.
"""

import io
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from tests.conftest import auth_headers


def recent_timestamp() -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()


PATIENT_ID = "patient_core_001"
FAMILY_ID = "family_core_001"


# ==========================================
# TC02 — Add Glucose Reading
# ==========================================

class TestAddGlucoseReading:

    @patch("app.services.alert_service.alert_service.evaluate_and_store")
    @patch("app.services.glucose_service.glucose_service.create_reading")
    def test_add_normal_glucose_reading(self, mock_create, mock_alert, client):
        """TC02: Patient adds a normal glucose reading — saved and returned."""
        mock_create.return_value = {
            "id": "reading_001",
            "value": 120,
            "unit": "mg/dL",
            "measuredAt": recent_timestamp(),
            "createdAt": recent_timestamp(),
            "source": "manual",
        }
        mock_alert.return_value = None

        res = client.post(
            "/glucose/",
            json={"value": 120, "measuredAt": recent_timestamp()},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 201
        data = res.json()
        assert data["value"] == 120
        assert data["source"] == "manual"
        mock_create.assert_called_once()

    @patch("app.services.alert_service.alert_service.evaluate_and_store")
    @patch("app.services.glucose_service.glucose_service.create_reading")
    def test_add_low_glucose_triggers_alert_check(self, mock_create, mock_alert, client):
        """TC02: Low glucose (< 70) still saves and triggers alert evaluation."""
        mock_create.return_value = {
            "id": "reading_low",
            "value": 55,
            "unit": "mg/dL",
            "measuredAt": recent_timestamp(),
            "createdAt": recent_timestamp(),
            "source": "manual",
        }
        mock_alert.return_value = None

        res = client.post(
            "/glucose/",
            json={"value": 55, "measuredAt": recent_timestamp()},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 201
        assert res.json()["value"] == 55
        mock_alert.assert_called_once()

    @patch("app.services.alert_service.alert_service.evaluate_and_store")
    @patch("app.services.glucose_service.glucose_service.create_reading")
    def test_add_high_glucose_triggers_alert_check(self, mock_create, mock_alert, client):
        """TC02: High glucose (> 300) saves and triggers alert evaluation."""
        mock_create.return_value = {
            "id": "reading_high",
            "value": 350,
            "unit": "mg/dL",
            "measuredAt": recent_timestamp(),
            "createdAt": recent_timestamp(),
            "source": "manual",
        }
        mock_alert.return_value = None

        res = client.post(
            "/glucose/",
            json={"value": 350, "measuredAt": recent_timestamp()},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 201
        mock_alert.assert_called_once()

    def test_family_member_cannot_add_glucose(self, client):
        """TC02: Family member is forbidden from adding glucose readings."""
        res = client.post(
            "/glucose/",
            json={"value": 120, "measuredAt": recent_timestamp()},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_add_glucose_requires_auth(self, client):
        """TC02: Adding glucose without a token returns 403."""
        res = client.post("/glucose/", json={"value": 120, "measuredAt": recent_timestamp()})
        assert res.status_code == 403


# ==========================================
# TC03 — View Glucose History
# ==========================================

class TestViewGlucoseHistory:

    @patch("app.services.glucose_service.glucose_service.get_readings")
    def test_patient_gets_glucose_history(self, mock_get, client):
        """TC03: Patient retrieves their glucose reading history."""
        mock_get.return_value = [
            {
                "id": "r1",
                "value": 100,
                "unit": "mg/dL",
                "measuredAt": recent_timestamp(),
                "createdAt": recent_timestamp(),
                "source": "manual",
            },
            {
                "id": "r2",
                "value": 140,
                "unit": "mg/dL",
                "measuredAt": recent_timestamp(),
                "createdAt": recent_timestamp(),
                "source": "manual",
            },
        ]

        res = client.get(
            "/glucose/",
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["value"] == 100

    @patch("app.services.glucose_service.glucose_service.get_readings")
    def test_glucose_history_empty_returns_empty_list(self, mock_get, client):
        """TC03: No readings yet returns an empty list (not an error)."""
        mock_get.return_value = []

        res = client.get(
            "/glucose/",
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        assert res.json() == []

    @patch("app.services.glucose_service.glucose_service.get_latest")
    def test_get_latest_reading(self, mock_latest, client):
        """TC03: Latest glucose reading is returned correctly."""
        mock_latest.return_value = {
            "id": "latest_001",
            "value": 130,
            "unit": "mg/dL",
            "measuredAt": recent_timestamp(),
            "createdAt": recent_timestamp(),
            "source": "manual",
        }

        res = client.get(
            "/glucose/latest",
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        assert res.json()["value"] == 130

    @patch("app.services.glucose_service.glucose_service.get_latest")
    def test_get_latest_returns_404_when_no_readings(self, mock_latest, client):
        """TC03: 404 returned when patient has no readings yet."""
        mock_latest.return_value = None

        res = client.get(
            "/glucose/latest",
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 404

    def test_glucose_history_requires_auth(self, client):
        """TC03: Accessing history without a token returns 403."""
        res = client.get("/glucose/")
        assert res.status_code == 403


# ==========================================
# TC04 — Add Emergency Contact
# ==========================================

class TestEmergencyContacts:

    @patch("app.routes.user_routes.db")
    def test_save_emergency_contacts(self, mock_db, client):
        """TC04: Patient saves emergency contacts — stored and returned."""
        mock_db.collection.return_value.document.return_value.update.return_value = None

        contacts = [
            {"id": "c1", "name": "Mama", "phone": "+970599111111"},
            {"id": "c2", "name": "Baba", "phone": "+970599222222"},
        ]

        res = client.put(
            "/users/me/emergency-contacts",
            json={"contacts": contacts},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        data = res.json()
        assert len(data["contacts"]) == 2
        assert data["contacts"][0]["name"] == "Mama"

    @patch("app.routes.user_routes.db")
    def test_get_emergency_contacts(self, mock_db, client):
        """TC04: Patient retrieves their saved emergency contacts."""
        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {
            "emergencyContacts": [
                {"id": "c1", "name": "Mama", "phone": "+970599111111"},
            ]
        }
        mock_db.collection.return_value.document.return_value.get.return_value = user_doc

        res = client.get(
            "/users/me/emergency-contacts",
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        assert len(res.json()["contacts"]) == 1
        assert res.json()["contacts"][0]["name"] == "Mama"

    @patch("app.routes.user_routes.db")
    def test_save_empty_emergency_contacts(self, mock_db, client):
        """TC04: Saving empty contacts list clears the contacts."""
        mock_db.collection.return_value.document.return_value.update.return_value = None

        res = client.put(
            "/users/me/emergency-contacts",
            json={"contacts": []},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        assert res.json()["contacts"] == []

    def test_emergency_contacts_requires_auth(self, client):
        """TC04: Accessing emergency contacts without token returns 403."""
        res = client.get("/users/me/emergency-contacts")
        assert res.status_code == 403


# ==========================================
# TC05 — Set Reminder
# ==========================================

class TestReminderSettings:

    @patch("app.routes.user_routes.db")
    def test_set_reminder_with_times(self, mock_db, client):
        """TC05: Patient saves reminder settings with specific times."""
        mock_db.collection.return_value.document.return_value.update.return_value = None

        res = client.put(
            "/users/me/reminders",
            json={"enabled": True, "times": ["08:00", "14:00", "20:00"]},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is True
        assert "08:00" in data["times"]
        assert len(data["times"]) == 3

    @patch("app.routes.user_routes.db")
    def test_disable_reminders(self, mock_db, client):
        """TC05: Patient disables reminders — enabled flag is False."""
        mock_db.collection.return_value.document.return_value.update.return_value = None

        res = client.put(
            "/users/me/reminders",
            json={"enabled": False, "times": []},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        assert res.json()["enabled"] is False

    @patch("app.routes.user_routes.db")
    def test_get_reminder_settings(self, mock_db, client):
        """TC05: Patient retrieves their reminder settings."""
        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {
            "reminderSettings": {"enabled": True, "times": ["08:00", "20:00"]}
        }
        mock_db.collection.return_value.document.return_value.get.return_value = user_doc

        res = client.get(
            "/users/me/reminders",
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is True
        assert "08:00" in data["times"]

    def test_reminder_settings_requires_auth(self, client):
        """TC05: Accessing reminders without token returns 403."""
        res = client.get("/users/me/reminders")
        assert res.status_code == 403


# ==========================================
# TC06 — Upload CSV File
# ==========================================

VALID_CSV = (
    "Device,Device Serial Number,Device Timestamp,Record Type,Historic Glucose mg/dL,Scan Glucose mg/dL\n"
    "Metadata row\n"
    "FreeStyle LibreLink,ABC123,01-01-2025 08:00,0,120,,\n"
    "FreeStyle LibreLink,ABC123,01-01-2025 08:15,0,115,,\n"
    "FreeStyle LibreLink,ABC123,01-01-2025 09:00,1,,130,\n"
)


class TestCSVImport:

    @patch("app.services.glucose_service.glucose_service.batch_import_readings")
    def test_upload_valid_csv(self, mock_batch, client):
        """TC06: Patient uploads a valid CSV — readings are imported."""
        mock_batch.return_value = (3, 0)

        csv_bytes = VALID_CSV.encode("utf-8")
        res = client.post(
            "/glucose/import-csv",
            files={"file": ("glucose.csv", io.BytesIO(csv_bytes), "text/csv")},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        data = res.json()
        assert "imported_count" in data
        assert data["imported_count"] >= 0

    def test_upload_csv_family_member_forbidden(self, client):
        """TC06: Family member cannot upload CSV — only patients can."""
        csv_bytes = VALID_CSV.encode("utf-8")
        res = client.post(
            "/glucose/import-csv",
            files={"file": ("glucose.csv", io.BytesIO(csv_bytes), "text/csv")},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_upload_csv_requires_auth(self, client):
        """TC06: Uploading CSV without token returns 403."""
        csv_bytes = VALID_CSV.encode("utf-8")
        res = client.post(
            "/glucose/import-csv",
            files={"file": ("glucose.csv", io.BytesIO(csv_bytes), "text/csv")},
        )
        assert res.status_code == 403

    @patch("app.services.glucose_service.glucose_service.batch_import_readings")
    def test_upload_csv_with_invalid_rows_skipped(self, mock_batch, client):
        """TC06: Rows with bad data are skipped, valid rows are imported."""
        mock_batch.return_value = (1, 2)

        bad_csv = (
            "Device,Serial,Timestamp,RecordType,Historic,Scan\n"
            "Metadata row\n"
            "FreeStyle,X,01-01-2025 08:00,0,120,,\n"
            "FreeStyle,X,BADDATE,0,120,,\n"
            "FreeStyle,X,01-01-2025 09:00,6,,,\n"
        )
        csv_bytes = bad_csv.encode("utf-8")
        res = client.post(
            "/glucose/import-csv",
            files={"file": ("glucose.csv", io.BytesIO(csv_bytes), "text/csv")},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        data = res.json()
        assert "skipped_count" in data

    @patch("app.services.glucose_service.glucose_service.batch_import_readings")
    def test_upload_empty_csv_returns_zero(self, mock_batch, client):
        """TC06: Empty CSV (only headers) returns imported_count = 0."""
        mock_batch.return_value = (0, 0)

        empty_csv = (
            "Device,Serial,Timestamp,RecordType,Historic,Scan\n"
            "Metadata row\n"
        )
        csv_bytes = empty_csv.encode("utf-8")
        res = client.post(
            "/glucose/import-csv",
            files={"file": ("glucose.csv", io.BytesIO(csv_bytes), "text/csv")},
            headers=auth_headers(PATIENT_ID, "patient"),
        )

        assert res.status_code == 200
        assert res.json()["imported_count"] == 0
