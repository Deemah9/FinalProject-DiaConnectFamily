from fastapi import APIRouter, Depends, HTTPException, status, Response
from app.middleware.dependencies import get_current_user, require_role
from app.models.health import (
    HealthInfoUpdate, HealthInfoResponse,
    InsulinDoseCreate, InsulinDoseResponse,
    CONDITION_IDS, FAST_INSULIN_IDS, SLOW_INSULIN_IDS,
)
from app.services.health_service import health_service


router = APIRouter(prefix="/health", tags=["Health"])


# ==========================================
# GET /health/reference
# ==========================================

@router.get("/reference")
def get_reference_data():
    """
    Return all valid condition IDs and insulin type IDs.
    Used by the frontend to populate dropdown lists.
    """
    return {
        "conditions":         CONDITION_IDS,
        "fast_insulin_types": FAST_INSULIN_IDS,
        "slow_insulin_types": SLOW_INSULIN_IDS,
    }


# ==========================================
# GET /health/info
# ==========================================

@router.get("/info", response_model=HealthInfoResponse)
def get_health_info(
    current_user: dict = Depends(require_role("patient"))
):
    """
    Retrieve the patient's health profile (conditions + basal insulin + ISF).
    """
    return health_service.get_health_info(user_id=current_user["sub"])


# ==========================================
# PUT /health/info
# ==========================================

@router.put("/info", response_model=HealthInfoResponse)
def update_health_info(
    data: HealthInfoUpdate,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Create or update the patient's health profile.
    Replaces conditions and basal insulin entirely on each call.
    """
    return health_service.update_health_info(
        user_id=current_user["sub"], data=data
    )


# ==========================================
# POST /health/insulin
# ==========================================

@router.post(
    "/insulin",
    response_model=InsulinDoseResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_insulin_dose(
    data: InsulinDoseCreate,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Log a fast (bolus) insulin dose.
    Used by the prediction service to adjust glucose forecasts.
    Max 100 units per dose — entries above this are rejected.
    """
    return health_service.add_insulin_dose(
        user_id=current_user["sub"], data=data
    )


# ==========================================
# GET /health/insulin/today
# ==========================================

@router.get("/insulin/today", response_model=list[InsulinDoseResponse])
def get_insulin_today(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all fast insulin doses logged in the last 24 hours.
    Available to both patients and family members.
    """
    return health_service.get_doses_today(user_id=current_user["sub"])


# ==========================================
# GET /health/insulin/by-date
# ==========================================

@router.get("/insulin/by-date", response_model=list[InsulinDoseResponse])
def get_insulin_by_date(
    date: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve fast insulin doses for a specific date (YYYY-MM-DD).
    """
    return health_service.get_doses_by_date(
        user_id=current_user["sub"], date_str=date
    )


# ==========================================
# DELETE /health/insulin/{id}
# ==========================================

@router.delete("/insulin/{dose_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_insulin_dose(
    dose_id: str,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Delete a logged insulin dose by ID.
    Patient can only delete their own records.
    """
    deleted = health_service.delete_insulin_dose(
        user_id=current_user["sub"], dose_id=dose_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dose not found or access denied"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
