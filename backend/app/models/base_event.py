from pydantic import BaseModel, validator
from datetime import datetime, timezone, timedelta


# ==========================================
# Base Event Model
# ==========================================

class BaseEvent(BaseModel):
    """
    Shared base model for all daily log events.
    Provides common timestamp validation to avoid repetition.
    Allows a 10-minute buffer to handle timezone differences.
    All event models (Meal, Activity, Sleep) inherit from this class.
    """
    timestamp: datetime

    @validator("timestamp")
    def validate_not_future(cls, v):
        """
        Reject events with a future timestamp — logically invalid.
        Converts timezone-aware timestamps to UTC correctly.
        Handles naive timestamps by assuming UTC.
        Allows a 10-minute buffer to handle client timezone differences.
        """
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)

        if v > datetime.now(timezone.utc) + timedelta(minutes=10):
            raise ValueError("timestamp cannot be in the future")

        return v
