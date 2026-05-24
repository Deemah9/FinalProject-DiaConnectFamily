from fastapi import APIRouter, Depends, HTTPException
from app.middleware.dependencies import get_current_user
from app.services.notification_service import (
    get_notifications,
    mark_all_read,
    get_unread_count,
    delete_notification,
    delete_all_notifications,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
def fetch_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return get_notifications(user_id)


@router.get("/unread-count")
def fetch_unread_count(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return {"unread_count": get_unread_count(user_id)}


@router.patch("/read-all")
def read_all_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    mark_all_read(user_id)
    return {"success": True}


@router.delete("/clear-all")
def clear_all_notifications(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    count = delete_all_notifications(user_id)
    return {"deleted": count}


@router.delete("/{notif_id}")
def remove_notification(
    notif_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    deleted = delete_notification(user_id, notif_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}
