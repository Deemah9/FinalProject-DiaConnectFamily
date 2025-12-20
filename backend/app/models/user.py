"""
User model definition.

This model represents a system user in the backend.
It is aligned with the Firestore 'users' collection
and serves as the base model for authentication and authorization.
"""

from datetime import datetime, timezone
from typing import Optional
from app.config.firebase import db


class User:
    """
    User domain model.

    This class defines the core user fields required
    for authentication and role-based access control.
    """

    COLLECTION = 'users'

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

    @classmethod
    def create(cls, user_data: dict) -> Optional["User"]:
        """
        Create a new user in Firestore.

        Args:
            user_data: Dictionary with user information

        Returns:
            User object if successful, None otherwise
        """
        try:
            # Add timestamps
            user_data['createdAt'] = datetime.now(timezone.utc)
            user_data['updatedAt'] = datetime.now(timezone.utc)
            user_data['isActive'] = True

            # Save to Firestore
            user_ref = db.collection(
                cls.COLLECTION).document(user_data['userId'])
            user_ref.set(user_data)

            return cls.from_dict(user_data)

        except Exception as e:
            print(f"Error creating user: {e}")
            return None

    @classmethod
    def get_by_id(cls, user_id: str) -> Optional["User"]:
        """
        Get user by ID.

        Args:
            user_id: User ID

        Returns:
            User object if found, None otherwise
        """
        try:
            user_ref = db.collection(cls.COLLECTION).document(user_id)
            doc = user_ref.get()

            if doc.exists:
                return cls.from_dict(doc.to_dict())
            return None

        except Exception as e:
            print(f"Error getting user: {e}")
            return None

    @classmethod
    def get_by_email(cls, email: str) -> Optional["User"]:
        """
        Get user by email.

        Args:
            email: User email

        Returns:
            User object if found, None otherwise
        """
        try:
            users_ref = db.collection(cls.COLLECTION)
            query = users_ref.where('email', '==', email).limit(1)
            results = query.stream()

            for doc in results:
                return cls.from_dict(doc.to_dict())

            return None

        except Exception as e:
            print(f"Error getting user by email: {e}")
            return None

    def update(self, update_data: dict) -> bool:
        """
        Update user information.

        Args:
            update_data: Fields to update

        Returns:
            True if successful, False otherwise
        """
        try:
            update_data['updatedAt'] = datetime.now(timezone.utc)

            user_ref = db.collection(self.COLLECTION).document(self.user_id)
            user_ref.update(update_data)

            # Update local object
            for key, value in update_data.items():
                if hasattr(self, key):
                    setattr(self, key, value)

            return True

        except Exception as e:
            print(f"Error updating user: {e}")
            return False

    def delete(self) -> bool:
        """
        Soft delete user (set isActive to False).

        Returns:
            True if successful, False otherwise
        """
        try:
            user_ref = db.collection(self.COLLECTION).document(self.user_id)
            user_ref.update({
                'isActive': False,
                'updatedAt': datetime.now(timezone.utc)
            })

            self.is_active = False
            return True

        except Exception as e:
            print(f"Error deleting user: {e}")
            return False

    @classmethod
    def list_all(cls, limit: int = 100) -> list["User"]:
        """
        List all active users.

        Args:
            limit: Max number of users to return

        Returns:
            List of User objects
        """
        try:
            users_ref = db.collection(cls.COLLECTION)
            query = users_ref.where('isActive', '==', True).limit(limit)
            results = query.stream()

            return [cls.from_dict(doc.to_dict()) for doc in results]

        except Exception as e:
            print(f"Error listing users: {e}")
            return []

    def __repr__(self):
        return f"<User {self.user_id}: {self.email} ({self.role})>"
