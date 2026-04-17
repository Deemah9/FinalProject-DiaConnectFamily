from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import get_current_user, require_role
from app.models.alert import AlertResponse
from app.services.alert_service import alert_service
from app.config.firebase import db


router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ==========================================
# GET /alerts  (patient)
# ==========================================

@router.get("/", response_model=list[AlertResponse])
def get_alerts(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve recent glucose alerts for the current patient."""
    limit = max(1, min(limit, 100))
    return alert_service.get_alerts(
        user_id=current_user["sub"], limit=limit
    )


# ==========================================
# GET /alerts/patient/{patient_id}  (family)
# ==========================================

@router.get("/patient/{patient_id}", response_model=list[AlertResponse])
def get_patient_alerts(
    patient_id: str,
    limit: int = 20,
    current_user: dict = Depends(require_role("family_member")),
):
    """Retrieve recent alerts for a linked patient (family member access)."""
    family_member_id = current_user["sub"]

    links = (
        db.collection("family_patient_links")
        .where("family_member_id", "==", family_member_id)
        .where("patient_id", "==", patient_id)
        .stream()
    )
    if not any(True for _ in links):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not linked to this patient",
        )

    limit = max(1, min(limit, 100))
    return alert_service.get_alerts(user_id=patient_id, limit=limit)
