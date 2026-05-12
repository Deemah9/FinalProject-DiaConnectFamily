from pydantic import BaseModel
from typing import Optional


# ==========================================
# Advice Model
# ==========================================

class PredictionAdvice(BaseModel):
    """AI-generated advice for the patient and their family members."""
    patient: Optional[str] = None
    family:  Optional[str] = None


# ==========================================
# Pattern Prediction Model
# ==========================================

class PatternPrediction(BaseModel):
    """
    Historical pattern analysis for the current hour window.
    Derived from the last 30 days of readings within ±1.5 hours of now.
    Only included in the response when prediction_mode = 'pattern'
    (i.e. last reading was more than 24 hours ago).

    typical_min / typical_max : 25th / 75th percentile (interquartile range).
    confidence                : high (≥20 readings) / medium (10–19) / low (<10).
    variability               : stable (std ≤ 40) / unstable (std > 40).
    """
    available:    bool
    typical_avg:  Optional[int]  = None
    typical_min:  Optional[int]  = None
    typical_max:  Optional[int]  = None
    risk_level:   Optional[str]  = None   # low / normal / high / variable
    sample_count: int            = 0
    message:      Optional[str]  = None
    confidence:   Optional[str]  = None   # high / medium / low
    variability:  Optional[str]  = None   # stable / unstable


# ==========================================
# Prediction Response Model
# ==========================================

class PredictionResponse(BaseModel):
    """
    Response shape for GET /glucose/predict.

    prediction_mode:
        'real_time'  — fresh data (<6 h), LSTM prediction shown.
        'hybrid'     — data 6–24 h old, LSTM shown with staleness warning.
        'pattern'    — data >24 h old, pattern card shown instead of LSTM.
        'none'       — insufficient readings for any prediction.

    pattern_prediction:
        Populated only when prediction_mode = 'pattern'.

    comparison_to_pattern:
        How today's LSTM prediction compares to the historical average.
        'above_normal' / 'below_normal' / 'within_normal'.
        Included in real_time / hybrid modes (used by Groq for richer advice).
    """
    predicted_value:           Optional[float] = None
    hours:                     int             = 1
    trend:                     Optional[str]   = None
    alert_type:                Optional[str]   = None
    probability:               Optional[int]   = None
    prob_up:                   Optional[int]   = None
    prob_down:                 Optional[int]   = None
    advice:                    Optional[PredictionAdvice] = None
    readings_used:             int             = 0
    message:                   Optional[str]   = None
    data_stale:                bool            = False
    hours_since_last_reading:  Optional[float] = None
    prediction_mode:           str             = "none"
    pattern_prediction:        Optional[PatternPrediction] = None
    comparison_to_pattern:     Optional[str]   = None
