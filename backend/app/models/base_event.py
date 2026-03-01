from pydantic import BaseModel, validator
from datetime import datetime, timezone


# ==========================================
# Base Event Model
# ==========================================

class BaseEvent(BaseModel):
    """
    Shared base model for all daily log events.
    Provides common timestamp validation to avoid repetition.
    All event models (Meal, Activity, Sleep) inherit from this class.
    """
    timestamp: datetime

    @validator("timestamp")
    def validate_not_future(cls, v):
        """Reject events with a future timestamp — logically invalid."""
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v > datetime.now(timezone.utc):
            raise ValueError("timestamp cannot be in the future")
        return v
