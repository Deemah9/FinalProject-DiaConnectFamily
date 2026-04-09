from typing import Optional
from pydantic import BaseModel


class GenerateCodeResponse(BaseModel):
    code: str
    expires_in_days: int


class JoinRequest(BaseModel):
    code: str


class JoinResponse(BaseModel):
    message: str
    patient_name: str
    patient_id: str


class PatientSummary(BaseModel):
    patient_id: str
    patient_name: str
    linked_at: Optional[str] = None


class ViewRequest(BaseModel):
    code: str


class GlucoseItem(BaseModel):
    id: str
    value: float
    unit: str
    measuredAt: Optional[str] = None
    source: str


class ViewResponse(BaseModel):
    patient_id: str
    patient_name: str
    readings: list[GlucoseItem]
