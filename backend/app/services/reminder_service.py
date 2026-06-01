import json
import urllib.request
from datetime import datetime, timezone, timedelta
from app.config.firebase import db
from app.services.notification_service import save_notification

USERS_COLLECTION = "users"
GLUCOSE_COLLECTION = "glucose_readings"

REMINDER_INTERVAL_HOURS = 4


def _send_push(tokens: list[str], title: str, body: str, data: dict) -> None:
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "priority": "normal",
        }
        for token in tokens
    ]
    try:
        payload = json.dumps(messages).encode("utf-8")
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            method="POST",
        )
        response = urllib.request.urlopen(req, timeout=5)
        result = json.loads(response.read().decode("utf-8"))
        print(f"[Push] Expo API response: {json.dumps(result, ensure_ascii=False)}")
    except Exception as e:
        print(f"⚠️ Reminder push failed: {e}")


def send_glucose_reminders() -> None:
    """
    Runs every REMINDER_INTERVAL_HOURS hours.
    Sends a push notification to every patient who has a valid pushToken
    but has not logged a glucose reading in the last REMINDER_INTERVAL_HOURS hours.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=REMINDER_INTERVAL_HOURS)

    print(f"[Reminder] Running glucose reminder check at {now.isoformat()}")

    # Fetch all users with a pushToken that start with "ExponentPushToken["
    users_stream = db.collection(USERS_COLLECTION).stream()

    reminded = 0
    for user_doc in users_stream:
        udata = user_doc.to_dict()
        token = udata.get("pushToken", "")
        if not (token and token.startswith("ExponentPushToken[")):
            continue

        # Only remind patients (role == "patient"), not family members
        if udata.get("role") != "patient":
            continue

        user_id = user_doc.id

        # Check if the user has any reading in the last REMINDER_INTERVAL_HOURS hours
        recent = (
            db.collection(GLUCOSE_COLLECTION)
            .where("userId", "==", user_id)
            .where("measuredAt", ">=", cutoff)
            .limit(1)
            .stream()
        )
        has_recent = any(True for _ in recent)

        if has_recent:
            continue

        first_name = udata.get("firstName") or udata.get("first_name") or ""
        lang = udata.get("language", "ar")

        if lang == "en":
            title = "Glucose Reminder"
            body = (
                f"Hi {first_name}, you haven't logged a glucose reading "
                f"in over {REMINDER_INTERVAL_HOURS} hours. Please check now."
            )
        elif lang == "he":
            title = "תזכורת סוכר"
            body = (
                f"שלום {first_name}, לא רשמת קריאת סוכר "
                f"מזה יותר מ-{REMINDER_INTERVAL_HOURS} שעות. אנא בדוק עכשיו."
            )
        else:
            title = "تذكير قياس السكر"
            body = (
                f"مرحباً {first_name}، لم تقم بتسجيل قراءة سكر "
                f"منذ أكثر من {REMINDER_INTERVAL_HOURS} ساعات. يرجى القياس الآن."
            )

        _send_push([token], title, body, {"type": "glucose_reminder"})
        save_notification(
            user_id, "glucose_reminder", title, body,
            notif_key="glucose_reminder",
            notif_params={"name": first_name, "hours": REMINDER_INTERVAL_HOURS},
        )
        reminded += 1
        print(f"[Reminder] Sent to user {user_id}")

    print(f"[Reminder] Done — reminded {reminded} user(s)")
