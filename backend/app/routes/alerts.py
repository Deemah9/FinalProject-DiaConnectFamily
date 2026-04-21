from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import get_current_user, require_role
from app.models.alert import AlertResponse
from app.services.alert_service import alert_service
from app.config.firebase import db


router = APIRouter(prefix="/alerts", tags=["Alerts"])


def _verify_family_link(family_member_id: str, patient_id: str):
    links = (
        db.collection("family_patient_links")
        .where("family_member_id", "==", family_member_id)
        .where("patient_id", "==", patient_id)
        .stream()
    )
    if not any(True for _ in links):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not linked to this patient")


# ==========================================
# GET /alerts  (patient)
# ==========================================

@router.get("/", response_model=list[AlertResponse])
def get_alerts(limit: int = 20, current_user: dict = Depends(get_current_user)):
    limit = max(1, min(limit, 100))
    return alert_service.get_alerts(user_id=current_user["sub"], limit=limit)


# ==========================================
# GET /alerts/patient/{patient_id}  (family)
# ==========================================

@router.get("/patient/{patient_id}", response_model=list[AlertResponse])
def get_patient_alerts(
    patient_id: str,
    limit: int = 20,
    current_user: dict = Depends(require_role("family_member")),
):
    _verify_family_link(current_user["sub"], patient_id)
    limit = max(1, min(limit, 100))
    return alert_service.get_alerts(user_id=patient_id, limit=limit)


# ==========================================
# PATCH /alerts/patient/{patient_id}/{alert_id}/read  (family)
# ==========================================

@router.patch("/patient/{patient_id}/{alert_id}/read")
def mark_patient_alert_read(
    patient_id: str,
    alert_id: str,
    current_user: dict = Depends(require_role("family_member")),
):
    _verify_family_link(current_user["sub"], patient_id)
    success = alert_service.mark_as_read(alert_id, patient_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return {"ok": True}


# ==========================================
# PATCH /alerts/patient/{patient_id}/read-all  (family)
# ==========================================

@router.patch("/patient/{patient_id}/read-all")
def mark_all_patient_alerts_read(
    patient_id: str,
    current_user: dict = Depends(require_role("family_member")),
):
    _verify_family_link(current_user["sub"], patient_id)
    alert_service.mark_all_as_read(patient_id)
    return {"ok": True}
