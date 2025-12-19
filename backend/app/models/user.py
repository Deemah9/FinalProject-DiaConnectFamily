"""
User model definition.

This model represents a system user in the backend.
It is aligned with the Firestore 'users' collection
and serves as the base model for authentication and authorization.
"""

from datetime import datetime, timezone


class User:
    """
    User domain model.

    This class defines the core user fields required
    for authentication and role-based access control.
    """

    def __init__(
        self,
        user_id: str,
        email: str,
        role: str,
        is_active: bool = True,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ):
        self.user_id = user_id
        self.email = email
        self.role = role  # "patient" or "family_member"
        self.is_active = is_active
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)

        # NOTE:
        # Additional medical and lifestyle fields
        # (e.g., diabetesType, medicalHistory, lifestyleHabits)
        # will be added in future iterations based on DATABASE_SCHEMA.

    def to_dict(self) -> dict:
        """
        Convert the User object to a dictionary
        suitable for storing in Firestore.
        """
        return {
            "userId": self.user_id,
            "email": self.email,
            "role": self.role,
            "isActive": self.is_active,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }

    @staticmethod
    def from_dict(data: dict) -> "User":
        """
        Create a User object from a Firestore document dictionary.
        """
        return User(
            user_id=data.get("userId"),
            email=data.get("email"),
            role=data.get("role"),
            is_active=data.get("isActive", True),
            created_at=data.get("createdAt"),
            updated_at=data.get("updatedAt"),
        )
