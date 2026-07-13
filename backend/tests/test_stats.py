"""
TC11 — GET /glucose/stats (statistics per time window)
TC12 — GET /glucose/a1c  (estimated HbA1c)
TC13 — PATCH /glucose/{id} (update manual reading)
TC14 — DELETE /glucose/{id} (deletion permanently disabled)
"""

from datetime import datetime, timezone
from unittest.mock import patch
from tests.conftest import auth_headers

PATIENT_ID = "patient_stats_001"
FAMILY_ID  = "family_stats_001"


def recent_ts():
    return datetime.now(timezone.utc).isoformat()


# ==========================================
# TC11 — Glucose Statistics
# ==========================================

class TestGlucoseStats:

    @patch("app.services.glucose_service.glucose_service.calculate_stats")
    def test_stats_7_days(self, mock_stats, client):
        """TC11: 7-day window returns valid stats structure."""
        mock_stats.return_value = {
            "count": 10, "average": 130.5, "min": 80, "max": 200,
            "time_in_range": 70.0, "days": 7,
        }
        res = client.get("/glucose/stats?days=7", headers=auth_headers(PATIENT_ID, "patient"))

        assert res.status_code == 200
        data = res.json()
        assert data["days"] == 7
        assert data["count"] == 10
        assert data["average"] == 130.5
        assert "time_in_range" in data

    @patch("app.services.glucose_service.glucose_service.calculate_stats")
    def test_stats_14_days(self, mock_stats, client):
        """TC11: 14-day window is a valid input."""
        mock_stats.return_value = {
            "count": 25, "average": 140.0, "min": 70, "max": 220,
            "time_in_range": 65.0, "days": 14,
        }
        res = client.get("/glucose/stats?days=14", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 200
        assert res.json()["days"] == 14

    @patch("app.services.glucose_service.glucose_service.calculate_stats")
    def test_stats_30_days(self, mock_stats, client):
        """TC11: 30-day window is a valid input."""
        mock_stats.return_value = {
            "count": 60, "average": 135.0, "min": 65, "max": 250,
            "time_in_range": 60.0, "days": 30,
        }
        res = client.get("/glucose/stats?days=30", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 200
        assert res.json()["days"] == 30

    def test_stats_invalid_days_returns_400(self, client):
        """TC11: days=15 is not 7/14/30 — returns 400."""
        res = client.get("/glucose/stats?days=15", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 400
        assert "days" in res.json()["detail"]

    def test_stats_days_1_invalid(self, client):
        """TC11: days=1 is not an accepted window — returns 400."""
        res = client.get("/glucose/stats?days=1", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 400

    @patch("app.services.glucose_service.glucose_service.calculate_stats")
    def test_stats_no_readings_returns_zeroed_structure(self, mock_stats, client):
        """TC11: No readings in window returns zeroed structure, not an error."""
        mock_stats.return_value = {
            "count": 0, "average": None, "min": None, "max": None,
            "time_in_range": None, "days": 7,
        }
        res = client.get("/glucose/stats?days=7", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 200
        assert res.json()["count"] == 0
        assert res.json()["average"] is None

    def test_stats_requires_auth(self, client):
        """TC11: Stats without token returns 403."""
        res = client.get("/glucose/stats")
        assert res.status_code == 403


# ==========================================
# TC12 — Estimated A1C
# ==========================================

class TestEstimatedA1C:

    @patch("app.services.glucose_service.glucose_service.get_estimated_a1c")
    def test_a1c_returns_estimate(self, mock_a1c, client):
        """TC12: Returns estimated A1C with TIR breakdown when data is sufficient."""
        mock_a1c.return_value = {
            "estimated_a1c": 7.2,
            "average_glucose": 154.0,
            "readings_count": 45,
            "days_covered": 30,
            "is_reliable": True,
            "time_in_range": {
                "very_low": 1.0, "low": 4.0, "in_range": 65.0,
                "high": 20.0, "very_high": 10.0,
            },
        }
        res = client.get("/glucose/a1c", headers=auth_headers(PATIENT_ID, "patient"))

        assert res.status_code == 200
        data = res.json()
        assert data["estimated_a1c"] == 7.2
        assert data["is_reliable"] is True
        assert "time_in_range" in data
        assert data["time_in_range"]["in_range"] == 65.0

    @patch("app.services.glucose_service.glucose_service.get_estimated_a1c")
    def test_a1c_no_readings_not_reliable(self, mock_a1c, client):
        """TC12: No readings → is_reliable=False, estimated_a1c=None."""
        mock_a1c.return_value = {
            "estimated_a1c": None,
            "average_glucose": None,
            "readings_count": 0,
            "days_covered": 0,
            "is_reliable": False,
            "time_in_range": None,
        }
        res = client.get("/glucose/a1c", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 200
        assert res.json()["is_reliable"] is False
        assert res.json()["estimated_a1c"] is None

    @patch("app.services.glucose_service.glucose_service.get_estimated_a1c")
    def test_a1c_less_than_14_days_not_reliable(self, mock_a1c, client):
        """TC12: Less than 14 days of data → is_reliable=False."""
        mock_a1c.return_value = {
            "estimated_a1c": 6.8,
            "average_glucose": 140.0,
            "readings_count": 10,
            "days_covered": 5,
            "is_reliable": False,
            "time_in_range": {
                "very_low": 0.0, "low": 5.0, "in_range": 70.0,
                "high": 20.0, "very_high": 5.0,
            },
        }
        res = client.get("/glucose/a1c", headers=auth_headers(PATIENT_ID, "patient"))
        assert res.status_code == 200
        assert res.json()["is_reliable"] is False

    def test_a1c_family_member_forbidden(self, client):
        """TC12: Family member cannot access the A1C endpoint."""
        res = client.get("/glucose/a1c", headers=auth_headers(FAMILY_ID, "family_member"))
        assert res.status_code == 403

    def test_a1c_requires_auth(self, client):
        """TC12: A1C without token returns 403."""
        res = client.get("/glucose/a1c")
        assert res.status_code == 403


# ==========================================
# TC13 — Update Glucose Reading
# ==========================================

class TestUpdateGlucoseReading:

    @patch("app.services.glucose_service.glucose_service.update_reading")
    def test_update_manual_reading_success(self, mock_update, client):
        """TC13: Patient updates a manual reading — returns updated value."""
        mock_update.return_value = {
            "id": "reading_001",
            "value": 150,
            "unit": "mg/dL",
            "measuredAt": recent_ts(),
            "createdAt": recent_ts(),
            "source": "manual",
        }
        res = client.patch(
            "/glucose/reading_001",
            json={"value": 150},
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        assert res.json()["value"] == 150
        assert res.json()["source"] == "manual"

    @patch("app.services.glucose_service.glucose_service.update_reading")
    def test_update_csv_reading_returns_403(self, mock_update, client):
        """TC13: CSV/CGM readings cannot be edited — returns 403."""
        mock_update.return_value = None
        res = client.patch(
            "/glucose/csv_reading_001",
            json={"value": 130},
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 403

    def test_update_invalid_value_returns_422(self, client):
        """TC13: Negative value is rejected with 422."""
        res = client.patch(
            "/glucose/reading_001",
            json={"value": -10},
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 422

    def test_update_zero_value_returns_422(self, client):
        """TC13: Zero value is rejected with 422."""
        res = client.patch(
            "/glucose/reading_001",
            json={"value": 0},
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 422

    def test_update_family_member_forbidden(self, client):
        """TC13: Family member cannot update glucose readings."""
        res = client.patch(
            "/glucose/reading_001",
            json={"value": 120},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_update_requires_auth(self, client):
        """TC13: Update without token returns 403."""
        res = client.patch("/glucose/reading_001", json={"value": 120})
        assert res.status_code == 403


# ==========================================
# TC14 — Delete Glucose Reading (disabled)
# ==========================================

class TestDeleteGlucoseReading:

    def test_delete_reading_always_returns_403(self, client):
        """TC14: Deletion of glucose readings is permanently disabled — returns 403."""
        res = client.delete(
            "/glucose/reading_001",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 403

    def test_delete_without_auth_also_returns_403(self, client):
        """TC14: Even unauthenticated delete requests return 403."""
        res = client.delete("/glucose/reading_001")
        assert res.status_code == 403

    def test_delete_family_member_also_returns_403(self, client):
        """TC14: Family member cannot delete readings either."""
        res = client.delete(
            "/glucose/reading_001",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403
