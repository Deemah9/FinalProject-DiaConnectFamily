from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional
from app.models.base_event import BaseEvent


# ==========================================
# Reference Data (internal IDs)
# ==========================================

CONDITION_IDS = [
    "hypertension",
    "kidney_disease",
    "heart_disease",
    "dyslipidemia",
    "obesity",
    "neuropathy",
    "condition_other",
]

FAST_INSULIN_IDS = [
    "insulin_humalog",
    "insulin_novorapid",
    "insulin_apidra",
    "insulin_fiasp",
]

SLOW_INSULIN_IDS = [
    "insulin_lantus",
    "insulin_tresiba",
    "insulin_toujeo",
    "insulin_basaglar",
    "insulin_levemir",
]

ALL_INSULIN_IDS = FAST_INSULIN_IDS + SLOW_INSULIN_IDS


# ==========================================
# Basal Insulin (stored in profile)
# ==========================================

class BasalInsulin(BaseModel):
    type: str = Field(..., description="Slow insulin type ID (e.g. insulin_lantus)")
    dose: float = Field(..., ge=1, le=200, description="Daily dose in units")
    time: str = Field(..., description="Injection time HH:MM (24h)")

    @validator("type")
    def validate_type(cls, v):
        if v not in SLOW_INSULIN_IDS:
            raise ValueError(f"Invalid slow insulin type: {v}")
        return v

    @validator("time")
    def validate_time(cls, v):
        parts = v.split(":")
        if len(parts) != 2:
            raise ValueError("time must be HH:MM")
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("Invalid time value")
        return v


# ==========================================
# Health Info (stored in users/{uid}.health)
# ==========================================

class HealthInfoUpdate(BaseModel):
    conditions: list[str] = Field(
        default_factory=list,
        description="List of chronic condition IDs"
    )
    basal_insulin: Optional[BasalInsulin] = None
    insulin_sensitivity: Optional[float] = Field(
        None, ge=5, le=200,
        description="ISF: how many mg/dL one unit of fast insulin lowers glucose"
    )

    @validator("conditions", each_item=True)
    def validate_conditions(cls, v):
        if v not in CONDITION_IDS:
            raise ValueError(f"Invalid condition ID: {v}")
        return v


class HealthInfoResponse(BaseModel):
    conditions: list[str]
    basal_insulin: Optional[BasalInsulin]
    insulin_sensitivity: float


# ==========================================
# Bolus (Fast) Insulin Dose — Daily Log
# ==========================================

class InsulinDoseCreate(BaseEvent):
    insulin_type: str = Field(default="fast", description="Insulin type")
    units: float = Field(..., ge=0.5, le=100, description="Dose in units")


class InsulinDoseResponse(BaseModel):
    id: str
    insulin_type: str
    units: float
    timestamp: datetime
    createdAt: datetime
