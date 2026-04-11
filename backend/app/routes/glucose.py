from fastapi import APIRouter, Depends, HTTPException, status, Response
from app.middleware.dependencies import get_current_user, require_role
from app.models.glucose_reading import (
    GlucoseCreate, GlucoseResponse, GlucoseStatsResponse
)
from app.services.glucose_service import glucose_service
from app.services.alert_service import alert_service


router = APIRouter(prefix="/glucose", tags=["Glucose Readings"])


# ==========================================
# POST /glucose
# ==========================================

@router.post(
    "/",
    response_model=GlucoseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_glucose_reading(
    data: GlucoseCreate,
    current_user: dict = Depends(
        require_role("patient")
    )
):
    """
    Add a new glucose reading.
    Restricted to patients only.
    Source is automatically set to 'manual' by the server.
    Triggers an alert if the value is high (> 180) or low (< 70).
    """
    user_id = current_user["sub"]
    reading = glucose_service.create_reading(user_id=user_id, data=data)
    alert_service.evaluate_and_store(
        user_id=user_id,
        reading_id=reading["id"],
        value=reading["value"]
    )
    return reading


# ==========================================
# GET /glucose
# ==========================================

@router.get("/", response_model=list[GlucoseResponse])
async def get_glucose_readings(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve glucose readings for the current user.
    Available to both patients and family members.
    Results are ordered by measuredAt descending.
    limit: number of readings to return (default 50, max 200).
    """
    limit = max(1, min(limit, 200))
    return glucose_service.get_readings(
        user_id=current_user["sub"], limit=limit
    )


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
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate and return glucose statistics for the current user.
    days: filter window — must be 7, 14, or 30 (default 7).
    Returns count, average, min, max, time_in_range, and the days filter used.
    Returns zeroed structure if no readings exist in the window.
    """
    if days not in (7, 14, 30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="days must be 7, 14, or 30"
        )
    return glucose_service.calculate_stats(
        user_id=current_user["sub"], days=days
    )


# ==========================================
# DELETE /glucose/{id}
# ==========================================

@router.delete("/{reading_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_glucose_reading(
    reading_id: str,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Delete a glucose reading by ID.
    Restricted to patients only — a patient can only delete their own readings.
    Returns 404 if the reading does not exist or belongs to a different user.
    """
    deleted = glucose_service.delete_reading(
        user_id=current_user["sub"],
        reading_id=reading_id
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading not found or access denied"
        )

    # Remove any alerts that were triggered by this reading
    alert_service.delete_by_reading_id(reading_id=reading_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
