"""
TC01 — Authentication Tests
Covers: registration, login success/failure, token validation.
All Firestore calls are mocked — no real database is touched.
"""

from unittest.mock import MagicMock, patch
from tests.conftest import auth_headers


PATIENT_ID = "patient_tc01"


def make_user_doc(email="patient@test.com", password_hash=None):
    from app.utils.security import hash_password
    doc = MagicMock()
    doc.id = PATIENT_ID
    doc.to_dict.return_value = {
        "email": email,
        "password": password_hash or hash_password("password123"),
        "role": "patient",
        "firstName": "Test",
        "lastName": "Patient",
        "is_active": True,
    }
    return doc


# ==========================================
# TC01-A — Registration Tests
# ==========================================

class TestRegistration:

    @patch("app.routes.auth.db")
    def test_register_patient_success(self, mock_db, client):
        """TC01: New patient registers successfully and receives JWT token."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        # No existing user with this email
        mock_collection.where.return_value.limit.return_value.get.return_value = []

        new_doc_ref = MagicMock()
        new_doc_ref.id = PATIENT_ID
        mock_collection.add.return_value = (None, new_doc_ref)

        res = client.post("/auth/register", json={
            "email": "newpatient@test.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "Patient",
            "role": "patient",
        })

        assert res.status_code == 201
        data = res.json()
        assert data["message"] == "User registered successfully"
        assert "accessToken" in data
        assert data["role"] == "patient"

    @patch("app.routes.auth.db")
    def test_register_family_member_success(self, mock_db, client):
        """TC01: New family member registers successfully."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value.limit.return_value.get.return_value = []

        new_doc_ref = MagicMock()
        new_doc_ref.id = "family_tc01"
        mock_collection.add.return_value = (None, new_doc_ref)

        res = client.post("/auth/register", json={
            "email": "newfamily@test.com",
            "password": "password123",
            "first_name": "Family",
            "last_name": "Member",
            "role": "family_member",
        })

        assert res.status_code == 201
        assert res.json()["role"] == "family_member"

    @patch("app.routes.auth.db")
    def test_register_duplicate_email_fails(self, mock_db, client):
        """TC01: Registering with an already-used email returns 400."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        # Simulate existing user
        existing = make_user_doc()
        mock_collection.where.return_value.limit.return_value.get.return_value = [existing]

        res = client.post("/auth/register", json={
            "email": "patient@test.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "Patient",
            "role": "patient",
        })

        assert res.status_code == 400
        assert "already registered" in res.json()["detail"].lower()

    def test_register_short_password_fails(self, client):
        """TC01: Password shorter than 6 characters is rejected."""
        res = client.post("/auth/register", json={
            "email": "test@test.com",
            "password": "123",
            "first_name": "Test",
            "last_name": "User",
            "role": "patient",
        })
        assert res.status_code == 400
        assert "6 characters" in res.json()["detail"]

    def test_register_invalid_role_fails(self, client):
        """TC01: Role other than 'patient' or 'family_member' is rejected."""
        res = client.post("/auth/register", json={
            "email": "test@test.com",
            "password": "password123",
            "first_name": "Test",
            "last_name": "User",
            "role": "admin",
        })
        assert res.status_code == 400
        assert "role" in res.json()["detail"].lower()


# ==========================================
# TC01-B — Login Tests
# ==========================================

class TestLogin:

    @patch("app.routes.auth.db")
    def test_login_success(self, mock_db, client):
        """TC01: Correct email and password returns 200 with JWT token."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        user_doc = make_user_doc()
        mock_collection.where.return_value.limit.return_value.get.return_value = [user_doc]

        res = client.post("/auth/login", json={
            "email": "patient@test.com",
            "password": "password123",
        })

        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "Login successful"
        assert "accessToken" in data
        assert len(data["accessToken"]) > 20

    @patch("app.routes.auth.db")
    def test_login_wrong_password(self, mock_db, client):
        """TC01: Wrong password returns 401 Unauthorized."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection

        user_doc = make_user_doc()
        mock_collection.where.return_value.limit.return_value.get.return_value = [user_doc]

        res = client.post("/auth/login", json={
            "email": "patient@test.com",
            "password": "wrongpassword",
        })

        assert res.status_code == 401
        assert "Invalid" in res.json()["detail"]

    @patch("app.routes.auth.db")
    def test_login_email_not_found(self, mock_db, client):
        """TC01: Email that doesn't exist returns 401 (no user enumeration)."""
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value.limit.return_value.get.return_value = []

        res = client.post("/auth/login", json={
            "email": "nobody@test.com",
            "password": "password123",
        })

        assert res.status_code == 401
        assert "Invalid" in res.json()["detail"]

    def test_login_no_token_returns_403(self, client):
        """TC01: Accessing protected endpoint without token returns 403."""
        res = client.get("/glucose/")
        assert res.status_code == 403

    def test_login_invalid_token_returns_401(self, client):
        """TC01: Invalid/tampered token is rejected."""
        res = client.get(
            "/glucose/",
            headers={"Authorization": "Bearer invalidtoken.abc.xyz"}
        )
        assert res.status_code == 401
