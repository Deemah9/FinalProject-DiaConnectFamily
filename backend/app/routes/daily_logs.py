from fastapi import APIRouter, Depends, HTTPException, status, Response
from app.middleware.dependencies import get_current_user
from app.models.daily_log import (
    MealCreate, MealResponse,
    ActivityCreate, ActivityResponse,
    SleepCreate, SleepResponse,
    TodaySummaryResponse, PeriodSummaryResponse
)
from app.services.daily_log_service import daily_log_service


router = APIRouter(prefix="/daily-logs", tags=["Daily Logs"])


# ==========================================
# POST /daily-logs/meals
# ==========================================

@router.post(
    "/meals",
    response_model=MealResponse,
    status_code=status.HTTP_201_CREATED
)
def add_meal(
    data: MealCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a new meal event.
    Available to all authenticated users.
    Only log when meal differs from baseline lifestyle profile.
    """
    return daily_log_service.add_meal(
        user_id=current_user["sub"],
        data=data
    )


# ==========================================
# POST /daily-logs/activities
# ==========================================

@router.post(
    "/activities",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED
)
def add_activity(
    data: ActivityCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a new activity event.
    Available to all authenticated users.
    Only log when activity differs from baseline lifestyle profile.
    """
    return daily_log_service.add_activity(
        user_id=current_user["sub"],
        data=data
    )


# ==========================================
# POST /daily-logs/sleep
# ==========================================

@router.post(
    "/sleep",
    response_model=SleepResponse,
    status_code=status.HTTP_201_CREATED
)
def add_sleep(
    data: SleepCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a new sleep event.
    Available to all authenticated users.
    Only log when sleep differs from baseline lifestyle profile.
    """
    return daily_log_service.add_sleep(
        user_id=current_user["sub"],
        data=data
    )


# ==========================================
# GET /daily-logs/today
# ==========================================

@router.get("/today", response_model=TodaySummaryResponse)
def get_today(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all events from the last 24 hours for the current user.
    Returns meals, activities, and sleep logs combined.
    Uses timestamp-based filtering for medical accuracy.
    """
    return daily_log_service.get_today(user_id=current_user["sub"])


# ==========================================
# GET /daily-logs/summary
# ==========================================

@router.get("/summary", response_model=PeriodSummaryResponse)
def get_summary(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Return aggregated daily log stats for the current user.
    days: filter window — must be 7, 14, or 30 (default 7).
    Returns meal count, avg carbs, activity count,
    total activity minutes, sleep count, and avg sleep hours.
    """
    if days not in (7, 14, 30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="days must be 7, 14, or 30"
        )
    return daily_log_service.get_summary(
        user_id=current_user["sub"], days=days
    )


# ==========================================
# DELETE /daily-logs/meals/{id}
# ==========================================

@router.delete("/meals/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal(
    meal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a meal log by ID.
    User can only delete their own records.
    Returns 404 if not found or belongs to a different user.
    """
    deleted = daily_log_service.delete_meal(
        user_id=current_user["sub"],
        meal_id=meal_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found or access denied"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# DELETE /daily-logs/activities/{id}
# ==========================================

@router.delete(
    "/activities/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_activity(
    activity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an activity log by ID.
    User can only delete their own records.
    Returns 404 if not found or belongs to a different user.
    """
    deleted = daily_log_service.delete_activity(
        user_id=current_user["sub"],
        activity_id=activity_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found or access denied"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# DELETE /daily-logs/sleep/{id}
# ==========================================

@router.delete("/sleep/{sleep_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sleep(
    sleep_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a sleep log by ID.
    User can only delete their own records.
    Returns 404 if not found or belongs to a different user.
    """
    deleted = daily_log_service.delete_sleep(
        user_id=current_user["sub"],
        sleep_id=sleep_id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sleep log not found or access denied"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
