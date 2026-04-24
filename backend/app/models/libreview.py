from pydantic import BaseModel, EmailStr


# ==========================================
# Request Model
# ==========================================

class SyncRequest(BaseModel):
    """
    Credentials the patient sends to trigger a LibreView sync.
    These are used only for the duration of the request —
    they are never stored anywhere in the backend.
    """
    email: EmailStr
    password: str


# ==========================================
# Response Model
# ==========================================

class SyncResponse(BaseModel):
    """
    Result returned after a LibreView sync attempt.

    imported_count : number of new readings saved to Firestore.
    skipped_count  : readings that already existed (deduplication).
    source         : always "libreview" so the caller can verify.
    """
    imported_count: int
    skipped_count: int
    source: str = "libreview"
