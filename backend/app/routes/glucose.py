from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import get_current_user, require_role
from app.models.glucose_reading import GlucoseCreate, GlucoseResponse, GlucoseStatsResponse
from app.services.glucose_service import glucose_service


router = APIRouter(prefix="/glucose", tags=["Glucose Readings"])


# ==========================================
# POST /glucose
# ==========================================

@router.post("/", response_model=GlucoseResponse, status_code=status.HTTP_201_CREATED)
async def add_glucose_reading(
    data: GlucoseCreate,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Add a new glucose reading.
    Restricted to patients only.
    Source is automatically set to 'manual' by the server.
    """
    return glucose_service.create_reading(
        user_id=current_user["sub"],
        data=data
    )


# ==========================================
# GET /glucose
# ==========================================

@router.get("/", response_model=list[GlucoseResponse])
async def get_glucose_readings(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all glucose readings for the current user.
    Available to both patients and family members.
    Results are ordered by measuredAt descending.
    """
    return glucose_service.get_readings(user_id=current_user["sub"])


# ==========================================
# GET /glucose/latest
# ==========================================

@router.get("/latest", response_model=GlucoseResponse)
async def get_latest_reading(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve the most recent glucose reading for the current user.
    Returns 404 if no readings exist.
    """
    reading = glucose_service.get_latest(user_id=current_user["sub"])

    if not reading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No glucose readings found"
        )

    return reading


# ==========================================
# GET /glucose/stats
# ==========================================

@router.get("/stats", response_model=GlucoseStatsResponse)
def get_glucose_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate and return basic glucose statistics for the current user.
    Returns count, average, min, and max values.
    Returns zeroed structure if no readings exist.
    """
    return glucose_service.calculate_stats(user_id=current_user["sub"])
