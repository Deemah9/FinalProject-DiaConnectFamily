"""
Shared fixtures and helpers for all tests.
Uses mocking to avoid hitting the real Firestore database.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.utils.security import create_access_token


# ==========================================
# Token Helpers
# ==========================================

def make_token(user_id: str, role: str) -> str:
    """Generate a real JWT for a fake user."""
    return create_access_token({"sub": user_id, "role": role})


def auth_headers(user_id: str, role: str) -> dict:
    """Return Authorization headers for a given user."""
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


# ==========================================
# Mock User for Firestore auth check
# ==========================================

def mock_active_user():
    """Returns a mock User object that passes the isActive check."""
    user = MagicMock()
    user.is_active = True
    return user


# ==========================================
# App Client Fixture
# ==========================================

@pytest.fixture
def client():
    """
    FastAPI TestClient with Firestore and User.get_by_id mocked.
    Prevents any real network calls during tests.
    """
    with patch("app.models.user.User.get_by_id", return_value=mock_active_user()):
        from app.main import app
        with TestClient(app) as c:
            yield c
