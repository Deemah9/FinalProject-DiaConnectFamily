from pydantic import BaseModel, Field, validator
from datetime import datetime, timezone, timedelta
from typing import Literal


# ==========================================
# Input Schema (from client)
# ==========================================

class GlucoseCreate(BaseModel):
    """
    Schema for creating a new glucose reading.
    Client sends only value and measuredAt.
    Server adds userId, createdAt, and source.
    """
    value: int = Field(..., ge=40, le=600,
                       description="Glucose value in mg/dL (must be between 40 and 600)")
    measuredAt: datetime = Field(...,
                                 description="Timestamp when the reading was taken")

    @validator("measuredAt")
    def validate_not_future(cls, v):
        """
        Reject readings with a future timestamp — medically invalid.
        Handles both naive and timezone-aware datetimes.
        """
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        if v > datetime.now(timezone.utc) + timedelta(minutes=2):
            raise ValueError("measuredAt cannot be in the future")
        return v


# ==========================================
# Internal Document Model (Firestore shape)
# ==========================================

class GlucoseDocument(BaseModel):
    """
    Represents the full document structure stored in Firestore.
    Used internally — never exposed directly to the client.
    """
    userId: str
    value: int
    measuredAt: datetime
    source: Literal["manual", "libreview", "csv"]
    createdAt: datetime


# ==========================================
# Response Model (returned to client)
# ==========================================

class GlucoseResponse(BaseModel):
    """
    Response shape returned to the client after a glucose operation.
    Excludes sensitive fields like userId.
    Immutable record — no updatedAt field.
    """
    id: str
    value: int
    measuredAt: datetime
    source: Literal["manual", "libreview", "csv"]
    createdAt: datetime

# ==========================================
# Stats Response Model
# ==========================================


class GlucoseStatsResponse(BaseModel):
    """
    Response shape for glucose statistics endpoint.
    Returns None for average, min, max, time_in_range if no readings exist.
    time_in_range: percentage of readings between 70–180 mg/dL (standard target range).
    days: the filter window used (7, 14, or 30).
    """
    count: int
    average: float | None
    min: int | None
    max: int | None
    time_in_range: float | None
    days: int
