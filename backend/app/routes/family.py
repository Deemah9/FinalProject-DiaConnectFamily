from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import require_role
from app.models.family_link import DailyLogsResponse, GenerateCodeResponse, JoinRequest, JoinResponse, PatientSummary, ViewRequest, ViewResponse
import app.services.family_service as family_service

router = APIRouter(prefix="/family", tags=["Family Connection"])


@router.post("/view", response_model=ViewResponse)
def view_patient_data(body: ViewRequest):
    """
    No authentication required.
    Family member enters pairing code → receives patient name + glucose readings.
    Code is reusable within its validity period.
    """
    result = family_service.view_with_code(code=body.code)
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.post("/generate-code", response_model=GenerateCodeResponse)
def generate_code(current_user: dict = Depends(require_role("patient"))):
    """Patient generates a new 6-character pairing code (valid 7 days)."""
    result = family_service.generate_code(patient_id=current_user["sub"])
    return result


@router.post("/join", response_model=JoinResponse)
def join_with_code(
    body: JoinRequest,
    current_user: dict = Depends(require_role("family_member"))
):
    """Family member joins using a pairing code."""
    result = family_service.join_with_code(
        family_member_id=current_user["sub"],
        code=body.code
    )
    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/patients", response_model=list[PatientSummary])
def get_patients(current_user: dict = Depends(require_role("family_member"))):
    """Get all patients linked to the current family member."""
    return family_service.get_patients(family_member_id=current_user["sub"])


@router.get("/patient/{patient_id}/daily-logs", response_model=DailyLogsResponse)
def get_patient_daily_logs(
    patient_id: str,
    days: int = 7,
    current_user: dict = Depends(require_role("family_member"))
):
    """Get daily logs (meals, activities, sleep) for a linked patient."""
    days = max(1, min(days, 30))
    result = family_service.get_patient_daily_logs(
        family_member_id=current_user["sub"],
        patient_id=patient_id,
        days=days,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not linked to this patient"
        )
    return result


@router.get("/patient/{patient_id}/glucose")
def get_patient_glucose(
    patient_id: str,
    limit: int = 50,
    current_user: dict = Depends(require_role("family_member"))
):
    """Get glucose readings for a linked patient."""
    limit = max(1, min(limit, 200))
    readings = family_service.get_patient_glucose(
        family_member_id=current_user["sub"],
        patient_id=patient_id,
        limit=limit
    )
    if readings is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not linked to this patient"
        )
    return readings
