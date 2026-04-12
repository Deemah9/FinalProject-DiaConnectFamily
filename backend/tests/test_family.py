"""
Tests for Family Connection feature.
Covers: pairing flow, access control, family member management, daily logs.
All Firestore calls are mocked — no real database is touched.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from tests.conftest import auth_headers


PATIENT_ID = "patient_001"
FAMILY_ID = "family_001"
OTHER_PATIENT_ID = "patient_999"
LINK_ID = "link_abc123"


# ==========================================
# Helpers — build Firestore mock documents
# ==========================================

def make_code_doc(code="ABC123", used=False, expired=False):
    doc = MagicMock()
    doc.id = "code_doc_id"
    expires_at = datetime.now(timezone.utc) + (timedelta(days=-1) if expired else timedelta(days=7))
    doc.to_dict.return_value = {
        "code": code,
        "patient_id": PATIENT_ID,
        "used": used,
        "expires_at": expires_at,
    }
    return doc


def make_link_doc(family_member_id=FAMILY_ID, patient_id=PATIENT_ID):
    doc = MagicMock()
    doc.id = LINK_ID
    doc.to_dict.return_value = {
        "family_member_id": family_member_id,
        "patient_id": patient_id,
        "patient_name": "Deema Nimer",
        "linked_at": datetime.now(timezone.utc),
    }
    return doc


def make_glucose_doc(value=120):
    doc = MagicMock()
    doc.id = "glucose_doc_id"
    doc.to_dict.return_value = {
        "value": value,
        "unit": "mg/dL",
        "measuredAt": datetime.now(timezone.utc),
        "source": "manual",
    }
    return doc


# ==========================================
# 1. Pairing Flow Tests
# ==========================================

class TestPairingFlow:

    @patch("app.services.family_service.db")
    def test_generate_code_success(self, mock_db, client):
        """Patient generates a pairing code — old unused codes are deleted first."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        # No old codes to delete
        mock_collection.where.return_value.where.return_value.stream.return_value = iter([])
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([])
        mock_collection.add.return_value = (None, MagicMock())

        res = client.post(
            "/family/generate-code",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        data = res.json()
        assert "code" in data
        assert len(data["code"]) == 6
        assert data["expires_in_days"] == 7

    @patch("app.services.family_service.db")
    def test_generate_code_deletes_old_unused_codes(self, mock_db, client):
        """Generating a new code deletes the previous unused code."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        old_code_doc = MagicMock()
        old_code_doc.reference = MagicMock()

        # Return one old unused code
        mock_collection.where.return_value.where.return_value.stream.return_value = iter([old_code_doc])
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([])
        mock_collection.add.return_value = (None, MagicMock())

        res = client.post(
            "/family/generate-code",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        old_code_doc.reference.delete.assert_called_once()

    @patch("app.services.family_service.db")
    def test_join_with_valid_code(self, mock_db, client):
        """Family member joins with a valid code — link is created."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        code_doc = make_code_doc()

        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([code_doc])
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.side_effect = None

        # No existing link
        no_link = iter([])
        call_count = 0

        def stream_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return iter([code_doc])
            return iter([])  # no existing link

        mock_collection.where.return_value.where.return_value.limit.return_value.stream.side_effect = stream_side_effect

        # Patient doc for name lookup
        patient_doc = MagicMock()
        patient_doc.exists = True
        patient_doc.to_dict.return_value = {"firstName": "Deema", "lastName": "Nimer"}
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc

        mock_collection.add.return_value = (None, MagicMock())
        mock_collection.document.return_value.update.return_value = None

        res = client.post(
            "/family/join",
            json={"code": "ABC123"},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 200
        assert res.json()["message"] == "Linked successfully"

    @patch("app.services.family_service.db")
    def test_join_with_invalid_code(self, mock_db, client):
        """Family member joins with a wrong code — returns error."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([])

        res = client.post(
            "/family/join",
            json={"code": "WRONG1"},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 400
        assert "Invalid" in res.json()["detail"]

    @patch("app.services.family_service.db")
    def test_join_with_expired_code(self, mock_db, client):
        """Family member joins with an expired code — returns error."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        expired_doc = make_code_doc(expired=True)
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([expired_doc])

        res = client.post(
            "/family/join",
            json={"code": "ABC123"},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 400
        assert "expired" in res.json()["detail"].lower()

    @patch("app.services.family_service.db")
    def test_join_already_linked(self, mock_db, client):
        """Family member tries to join the same patient twice — returns error."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        code_doc = make_code_doc()
        existing_link = make_link_doc()
        call_count = 0

        def stream_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return iter([code_doc])
            return iter([existing_link])

        mock_collection.where.return_value.where.return_value.limit.return_value.stream.side_effect = stream_side_effect

        res = client.post(
            "/family/join",
            json={"code": "ABC123"},
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 400
        assert "Already linked" in res.json()["detail"]


# ==========================================
# 2. Access Control Tests
# ==========================================

class TestAccessControl:

    def test_patient_cannot_access_family_patients_list(self, client):
        """Patient role cannot call GET /family/patients (family_member only)."""
        res = client.get(
            "/family/patients",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 403

    def test_family_member_cannot_generate_code(self, client):
        """Family member cannot generate a pairing code (patient only)."""
        res = client.post(
            "/family/generate-code",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    @patch("app.services.family_service.db")
    def test_family_member_cannot_view_unlinked_patient_glucose(self, mock_db, client):
        """Family member gets 403 when accessing a patient they are not linked to."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        # No link found
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([])

        res = client.get(
            f"/family/patient/{OTHER_PATIENT_ID}/glucose",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    @patch("app.services.family_service.db")
    def test_family_member_cannot_view_unlinked_patient_daily_logs(self, mock_db, client):
        """Family member gets 403 when accessing daily logs of an unlinked patient."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value.where.return_value.limit.return_value.stream.return_value = iter([])

        res = client.get(
            f"/family/patient/{OTHER_PATIENT_ID}/daily-logs",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    @patch("app.services.family_service.db")
    def test_family_member_can_view_linked_patient_glucose(self, mock_db, client):
        """Family member gets glucose readings for a linked patient."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        link_doc = make_link_doc()
        glucose_doc = make_glucose_doc(value=120)
        call_count = 0

        def stream_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return iter([link_doc])   # link exists
            return iter([glucose_doc])    # glucose readings

        mock_collection.where.return_value.where.return_value.limit.return_value.stream.side_effect = stream_side_effect
        mock_collection.where.return_value.where.return_value.order_by.return_value.limit.return_value.stream.return_value = iter([glucose_doc])

        res = client.get(
            f"/family/patient/{PATIENT_ID}/glucose",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 200
        assert isinstance(res.json(), list)


# ==========================================
# 3. Family Member Management Tests
# ==========================================

class TestFamilyMemberManagement:

    @patch("app.services.family_service.db")
    def test_patient_gets_family_members_list(self, mock_db, client):
        """Patient retrieves list of linked family members."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        link_doc = MagicMock()
        link_doc.id = LINK_ID
        link_doc.to_dict.return_value = {
            "family_member_id": FAMILY_ID,
            "patient_id": PATIENT_ID,
            "linked_at": datetime.now(timezone.utc),
        }
        mock_collection.where.return_value.stream.return_value = iter([link_doc])

        user_doc = MagicMock()
        user_doc.exists = True
        user_doc.to_dict.return_value = {"firstName": "Ma", "lastName": "Ma"}
        mock_db.collection.return_value.document.return_value.get.return_value = user_doc

        res = client.get(
            "/family/my-members",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        members = res.json()
        assert len(members) == 1
        assert members[0]["link_id"] == LINK_ID

    @patch("app.services.family_service.db")
    def test_patient_removes_family_member(self, mock_db, client):
        """Patient successfully removes a linked family member."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        link_doc = MagicMock()
        link_doc.exists = True
        link_doc.to_dict.return_value = {"patient_id": PATIENT_ID}
        link_doc.reference = MagicMock()

        mock_db.collection.return_value.document.return_value.get.return_value = link_doc

        res = client.delete(
            f"/family/members/{LINK_ID}",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 204

    @patch("app.services.family_service.db")
    def test_patient_cannot_remove_other_patients_link(self, mock_db, client):
        """Patient cannot remove a link that belongs to another patient."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        link_doc = MagicMock()
        link_doc.exists = True
        # Link belongs to OTHER_PATIENT_ID, not PATIENT_ID
        link_doc.to_dict.return_value = {"patient_id": OTHER_PATIENT_ID}
        mock_db.collection.return_value.document.return_value.get.return_value = link_doc

        res = client.delete(
            f"/family/members/{LINK_ID}",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 404

    @patch("app.services.family_service.db")
    def test_remove_nonexistent_link(self, mock_db, client):
        """Removing a link that does not exist returns 404."""
        link_doc = MagicMock()
        link_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = link_doc

        res = client.delete(
            f"/family/members/nonexistent_id",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 404


# ==========================================
# 4. Daily Logs Tests
# ==========================================

class TestDailyLogs:

    @patch("app.services.family_service.db")
    def test_family_member_gets_daily_logs(self, mock_db, client):
        """Family member retrieves daily logs (meals, activities, sleep) for linked patient."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        link_doc = make_link_doc()
        meal_doc = MagicMock()
        meal_doc.id = "meal_1"
        meal_doc.to_dict.return_value = {
            "userId": PATIENT_ID,
            "foods": "Rice",
            "carbs": 45,
            "timestamp": datetime.now(timezone.utc),
            "createdAt": datetime.now(timezone.utc),
        }

        call_count = 0

        def stream_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return iter([link_doc])    # link check
            elif call_count == 2:
                return iter([meal_doc])    # meals
            else:
                return iter([])            # activities + sleep empty

        mock_collection.where.return_value.where.return_value.limit.return_value.stream.side_effect = stream_side_effect
        mock_collection.where.return_value.where.return_value.stream.side_effect = stream_side_effect

        res = client.get(
            f"/family/patient/{PATIENT_ID}/daily-logs",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 200
        data = res.json()
        assert "meals" in data
        assert "activities" in data
        assert "sleep" in data

    @patch("app.services.family_service.db")
    def test_daily_logs_empty_returns_empty_arrays(self, mock_db, client):
        """When patient has no logs, endpoint returns empty arrays (not an error)."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        link_doc = make_link_doc()
        call_count = 0

        def stream_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return iter([link_doc])
            return iter([])

        mock_collection.where.return_value.where.return_value.limit.return_value.stream.side_effect = stream_side_effect
        mock_collection.where.return_value.where.return_value.stream.side_effect = stream_side_effect

        res = client.get(
            f"/family/patient/{PATIENT_ID}/daily-logs",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["meals"] == []
        assert data["activities"] == []
        assert data["sleep"] == []
