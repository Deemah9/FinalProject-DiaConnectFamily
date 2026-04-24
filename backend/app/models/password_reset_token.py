import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.config.firebase import db

COLLECTION = "password_reset_tokens"
TOKEN_EXPIRY_MINUTES = 60


class PasswordResetToken:

    @staticmethod
    def create(user_id: str, email: str) -> str:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY_MINUTES)

        db.collection(COLLECTION).add({
            "token": token,
            "userId": user_id,
            "email": email,
            "expiresAt": expires_at,
            "used": False,
        })

        return token

    @staticmethod
    def find_valid(token: str) -> Optional[dict]:
        results = (
            db.collection(COLLECTION)
            .where("token", "==", token)
            .where("used", "==", False)
            .limit(1)
            .get()
        )

        if not results:
            return None

        doc = results[0]
        data = doc.to_dict()
        data["docId"] = doc.id

        expires_at = data.get("expiresAt")
        if expires_at is None:
            return None

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) > expires_at:
            return None

        return data

    @staticmethod
    def mark_used(doc_id: str) -> None:
        db.collection(COLLECTION).document(doc_id).update({"used": True})
