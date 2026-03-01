from datetime import datetime, timezone, timedelta
from firebase_admin import firestore
from app.models.daily_log import MealCreate, ActivityCreate, SleepCreate


# ==========================================
# Daily Log Service
# ==========================================

class DailyLogService:
    """
    Service layer for daily log business logic.
    Handles all Firestore operations for meals, activities, and sleep logs.
    All events are timestamp-based (not date-based) for accurate AI analysis.
    """

    def __init__(self):
        self.db = firestore.client()

    # ==========================================
    # Add Meal
    # ==========================================

    def add_meal(self, user_id: str, data: MealCreate) -> dict:
        """
        Save a new meal event to Firestore.
        Returns the saved document including its generated ID.
        """
        doc_ref = self.db.collection("meals").document()

        meal = {
            "userId": user_id,
            "carbs": data.carbs,
            "foods": data.foods,
            "notes": data.notes,
            "timestamp": data.timestamp,
            "createdAt": datetime.now(timezone.utc)
        }

        doc_ref.set(meal)
        meal["id"] = doc_ref.id
        return meal

    # ==========================================
    # Add Activity
    # ==========================================

    def add_activity(self, user_id: str, data: ActivityCreate) -> dict:
        """
        Save a new activity event to Firestore.
        Returns the saved document including its generated ID.
        """
        doc_ref = self.db.collection("activities").document()

        activity = {
            "userId": user_id,
            "type": data.type,
            "duration_minutes": data.duration_minutes,
            "notes": data.notes,
            "timestamp": data.timestamp,
            "createdAt": datetime.now(timezone.utc)
        }

        doc_ref.set(activity)
        activity["id"] = doc_ref.id
        return activity

    # ==========================================
    # Add Sleep
    # ==========================================

    def add_sleep(self, user_id: str, data: SleepCreate) -> dict:
        """
        Save a new sleep event to Firestore.
        Only logged when sleep differs from the baseline lifestyle profile.
        Returns the saved document including its generated ID.
        """
        doc_ref = self.db.collection("sleep_logs").document()

        sleep = {
            "userId": user_id,
            "sleep_hours": data.sleep_hours,
            "notes": data.notes,
            "timestamp": data.timestamp,
            "createdAt": datetime.now(timezone.utc)
        }

        doc_ref.set(sleep)
        sleep["id"] = doc_ref.id
        return sleep

    # ==========================================
    # Get Today's Summary (last 24 hours)
    # ==========================================

    def get_today(self, user_id: str) -> dict:
        """
        Retrieve all events from the last 24 hours for a specific user.
        Uses timestamp-based filtering instead of date-based for accuracy.
        This ensures events like late-night meals appear in the correct context.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        # Fetch meals
        meals = []
        for doc in self.db.collection("meals") \
                .where("userId", "==", user_id) \
                .where("timestamp", ">=", since) \
                .stream():
            data = doc.to_dict()
            data["id"] = doc.id
            meals.append(data)

        # Fetch activities
        activities = []
        for doc in self.db.collection("activities") \
                .where("userId", "==", user_id) \
                .where("timestamp", ">=", since) \
                .stream():
            data = doc.to_dict()
            data["id"] = doc.id
            activities.append(data)

        # Fetch sleep logs
        sleep = []
        for doc in self.db.collection("sleep_logs") \
                .where("userId", "==", user_id) \
                .where("timestamp", ">=", since) \
                .stream():
            data = doc.to_dict()
            data["id"] = doc.id
            sleep.append(data)

        return {
            "meals": meals,
            "activities": activities,
            "sleep": sleep
        }


# Single instance to be used across the app
daily_log_service = DailyLogService()
