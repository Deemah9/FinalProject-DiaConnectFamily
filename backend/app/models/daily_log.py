from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.base_event import BaseEvent


# ==========================================
# Meal Models
# ==========================================

class MealCreate(BaseEvent):
    """
    Schema for logging a meal event.
    carbs is required as it directly impacts glucose levels.
    foods and notes are optional — only logged when abnormal.
    """
    carbs: int = Field(..., ge=0, le=500,
                       description="Carbohydrate amount in grams")
    foods: Optional[str] = Field(None,
                                 description="Food description (optional)")
    meal_type: Optional[str] = Field(None,
                                     description="Meal type: breakfast, lunch, dinner, snack")
    notes: Optional[str] = Field(None,
                                 description="Additional notes (optional)")


class MealResponse(BaseModel):
    """
    Response shape returned after a meal is logged.
    Excludes userId for security.
    """
    id: str
    carbs: int
    foods: Optional[str]
    meal_type: Optional[str] = None
    notes: Optional[str]
    timestamp: datetime
    createdAt: datetime


# ==========================================
# Activity Models
# ==========================================

class ActivityCreate(BaseEvent):
    """
    Schema for logging an activity event.
    type describes the activity (e.g. walking, cycling).
    duration_minutes is required to assess glucose impact.
    """
    type: str = Field(...,
                      description="Type of activity (e.g. walking, cycling)")
    duration_minutes: int = Field(..., ge=0, le=1440,
                                  description="Duration in minutes (max 24 hours)")
    notes: Optional[str] = Field(None,
                                 description="Additional notes (optional)")


class ActivityResponse(BaseModel):
    """
    Response shape returned after an activity is logged.
    Excludes userId for security.
    """
    id: str
    type: str
    duration_minutes: int
    notes: Optional[str]
    timestamp: datetime
    createdAt: datetime


# ==========================================
# Sleep Models
# ==========================================

class SleepCreate(BaseEvent):
    """
    Schema for logging a sleep event.
    Only logged when sleep differs from the baseline in lifestyle profile.
    sleep_hours uses float to support values like 6.5 hours.
    """
    sleep_hours: float = Field(..., ge=0, le=24,
                               description="Sleep duration in hours")
    notes: Optional[str] = Field(None,
                                 description="Additional notes (optional)")


class SleepResponse(BaseModel):
    """
    Response shape returned after a sleep event is logged.
    Excludes userId for security.
    """
    id: str
    sleep_hours: float
    notes: Optional[str]
    timestamp: datetime
    createdAt: datetime


# ==========================================
# Today's Summary Response
# ==========================================

class TodaySummaryResponse(BaseModel):
    """
    Combined response for GET /daily-logs/today.
    Returns all meals, activities, and sleep logs from the last 24 hours.
    """
    meals: list[MealResponse]
    activities: list[ActivityResponse]
    sleep: list[SleepResponse]


# ==========================================
# Period Summary Response
# ==========================================

class PeriodSummaryResponse(BaseModel):
    """
    Aggregated summary for GET /daily-logs/summary?days=7/14/30.
    meals_count: number of meal logs in the period.
    avg_carbs: average carbs per meal (None if no meals).
    activities_count: number of activity logs in the period.
    total_activity_minutes: total exercise minutes in the period.
    sleep_count: number of sleep logs in the period.
    avg_sleep_hours: average sleep hours per log (None if no logs).
    days: the filter window used.
    """
    meals_count: int
    avg_carbs: Optional[float]
    activities_count: int
    total_activity_minutes: int
    sleep_count: int
    avg_sleep_hours: Optional[float]
    days: int
