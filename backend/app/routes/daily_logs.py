from fastapi import APIRouter, Depends, status
from app.middleware.dependencies import get_current_user
from app.models.daily_log import (
    MealCreate, MealResponse,
    ActivityCreate, ActivityResponse,
    SleepCreate, SleepResponse,
    TodaySummaryResponse
)
from app.services.daily_log_service import daily_log_service


router = APIRouter(prefix="/daily-logs", tags=["Daily Logs"])


# ==========================================
# POST /daily-logs/meals
# ==========================================

@router.post("/meals", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
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

@router.post("/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
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

@router.post("/sleep", response_model=SleepResponse, status_code=status.HTTP_201_CREATED)
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
