from datetime import datetime, timezone
from app.config.firebase import db

NOTIFICATIONS_COLLECTION = "notifications"


def save_notification(
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    glucose_value: int | None = None,
) -> None:
    db.collection(NOTIFICATIONS_COLLECTION).add({
        "userId": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "glucoseValue": glucose_value,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc),
    })


def get_notifications(user_id: str, limit: int = 50) -> list:
    docs = (
        db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", user_id)
        .order_by("createdAt", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        created = d.get("createdAt")
        result.append({
            "id": doc.id,
            "type": d.get("type"),
            "title": d.get("title"),
            "body": d.get("body"),
            "glucoseValue": d.get("glucoseValue"),
            "isRead": d.get("isRead", False),
            "createdAt": created.isoformat() if created else None,
        })
    return result


def mark_all_read(user_id: str) -> None:
    docs = (
        db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", user_id)
        .where("isRead", "==", False)
        .stream()
    )
    for doc in docs:
        doc.reference.update({"isRead": True})


def delete_all_notifications(user_id: str) -> int:
    docs = (
        db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", user_id)
        .stream()
    )
    count = 0
    for doc in docs:
        doc.reference.delete()
        count += 1
    return count


def delete_notification(user_id: str, notif_id: str) -> bool:
    doc_ref = db.collection(NOTIFICATIONS_COLLECTION).document(notif_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user_id:
        return False
    doc_ref.delete()
    return True


def get_unread_count(user_id: str) -> int:
    docs = (
        db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", user_id)
        .where("isRead", "==", False)
        .stream()
    )
    return sum(1 for _ in docs)
