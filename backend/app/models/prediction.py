from pydantic import BaseModel
from typing import Optional


# ==========================================
# Advice Model
# ==========================================

class PredictionAdvice(BaseModel):
    """
    AI-generated advice for both the patient and their family members.
    patient: what the patient should do.
    family: how the family can help.
    """
    patient: Optional[str] = None
    family: Optional[str] = None


# ==========================================
# Prediction Response Model
# ==========================================

class PredictionResponse(BaseModel):
    """
    Response shape for GET /glucose/predict.

    predicted_value: predicted glucose in mg/dL (None if insufficient data).
    hours: prediction horizon (default 1 hour).
    trend: direction of recent readings — 'rising', 'falling', or 'stable'.
    alert_type: 'low', 'high', 'patch_error', or None.
    advice: AI-generated advice for patient and family (None if no alert).
    readings_used: number of readings used to train the model.
    message: human-readable message when prediction is unavailable.
    """
    predicted_value: Optional[float] = None
    hours: int = 1
    trend: Optional[str] = None
    alert_type: Optional[str] = None
    probability: Optional[int] = None
    prob_up: Optional[int] = None
    prob_down: Optional[int] = None
    advice: Optional[PredictionAdvice] = None
    readings_used: int = 0
    message: Optional[str] = None
    data_stale: bool = False
    hours_since_last_reading: Optional[float] = None
