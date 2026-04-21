from pydantic import BaseModel
from datetime import datetime
from typing import Literal


# ==========================================
# Alert Response Model
# ==========================================

class AlertResponse(BaseModel):
    """
    Response shape for a glucose alert.
    type: 'high' if glucose > 180, 'low' if glucose < 70.
    value: the glucose reading that triggered the alert.
    readingId: the ID of the glucose reading that caused it.
    createdAt: when the alert was stored.
    read: whether the family member has marked this alert as read.
    """
    id: str
    type: Literal["high", "low"]
    value: int
    readingId: str
    createdAt: datetime
    read: bool = False
