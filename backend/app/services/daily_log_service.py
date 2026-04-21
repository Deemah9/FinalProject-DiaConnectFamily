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
    # Delete Helpers
    # ==========================================

    def _delete_doc(
        self, collection: str, user_id: str, doc_id: str
    ) -> bool:
        """
        Generic ownership-checked delete for any daily log collection.
        Returns True if deleted, False if not found or not owned by user.
        """
        doc_ref = self.db.collection(collection).document(doc_id)
        doc = doc_ref.get()

        if not doc.exists:
            return False

        if doc.to_dict().get("userId") != user_id:
            return False

        doc_ref.delete()
        return True

    def delete_meal(self, user_id: str, meal_id: str) -> bool:
        return self._delete_doc("meals", user_id, meal_id)

    def delete_activity(self, user_id: str, activity_id: str) -> bool:
        return self._delete_doc("activities", user_id, activity_id)

    def delete_sleep(self, user_id: str, sleep_id: str) -> bool:
        return self._delete_doc("sleep_logs", user_id, sleep_id)

    # ==========================================
    # Get Today's Summary (last 24 hours)
    # ==========================================

    def get_today(self, user_id: str) -> dict:
        """
        Retrieve all events from the last 24 hours for a specific user.
        Uses timestamp-based filtering instead of date-based for accuracy.
        This ensures events like late-night meals appear in the
        correct context.
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

    # ==========================================
    # Get Logs by Specific Date
    # ==========================================

    def get_by_date(self, user_id: str, date_str: str) -> dict:
        """
        Retrieve all events for a specific local date (YYYY-MM-DD).
        Fetches all user docs and filters in Python to avoid composite index.
        """
        try:
            y, m, d = map(int, date_str.split("-"))
        except Exception:
            return {"meals": [], "activities": [], "sleep": []}

        day_start = datetime(y, m, d, 0, 0, 0, tzinfo=timezone.utc)
        day_end   = datetime(y, m, d, 23, 59, 59, 999999, tzinfo=timezone.utc)

        def in_range(doc_data: dict) -> bool:
            ts = doc_data.get("timestamp")
            if ts is None:
                return False
            if hasattr(ts, "tzinfo"):
                ts = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
            else:
                return False
            return day_start <= ts <= day_end

        meals = []
        for doc in self.db.collection("meals").where("userId", "==", user_id).stream():
            data = doc.to_dict()
            if in_range(data):
                data["id"] = doc.id
                meals.append(data)

        activities = []
        for doc in self.db.collection("activities").where("userId", "==", user_id).stream():
            data = doc.to_dict()
            if in_range(data):
                data["id"] = doc.id
                activities.append(data)

        sleep = []
        for doc in self.db.collection("sleep_logs").where("userId", "==", user_id).stream():
            data = doc.to_dict()
            if in_range(data):
                data["id"] = doc.id
                sleep.append(data)

        return {"meals": meals, "activities": activities, "sleep": sleep}

    # ==========================================
    # Get Period Summary
    # ==========================================

    def get_summary(self, user_id: str, days: int = 7) -> dict:
        """
        Return aggregated stats for meals, activities, and sleep
        over the last N days. Date filtering is done in Python to
        avoid composite Firestore index requirements.
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)

        def fetch(collection: str) -> list:
            result = []
            for doc in self.db.collection(collection) \
                    .where("userId", "==", user_id) \
                    .stream():
                data = doc.to_dict()
                ts = data.get("timestamp")
                if ts is None:
                    continue
                if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts >= since:
                    result.append(data)
            return result

        meals = fetch("meals")
        activities = fetch("activities")
        sleep_logs = fetch("sleep_logs")

        carbs_vals = [m["carbs"] for m in meals if "carbs" in m]
        activity_mins = [
            a["duration_minutes"] for a in activities
            if "duration_minutes" in a
        ]
        sleep_vals = [
            s["sleep_hours"] for s in sleep_logs
            if "sleep_hours" in s
        ]

        return {
            "meals_count": len(meals),
            "avg_carbs": (
                round(sum(carbs_vals) / len(carbs_vals), 1)
                if carbs_vals else None
            ),
            "activities_count": len(activities),
            "total_activity_minutes": sum(activity_mins),
            "sleep_count": len(sleep_logs),
            "avg_sleep_hours": (
                round(sum(sleep_vals) / len(sleep_vals), 1)
                if sleep_vals else None
            ),
            "days": days,
        }


# Single instance to be used across the app
daily_log_service = DailyLogService()
