from fastapi import APIRouter, Depends
from app.middleware.dependencies import get_current_user
from app.services.notification_service import (
    get_notifications,
    mark_all_read,
    get_unread_count,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
def fetch_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    return get_notifications(user_id)


@router.get("/unread-count")
def fetch_unread_count(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    return {"unread_count": get_unread_count(user_id)}


@router.patch("/read-all")
def read_all_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    mark_all_read(user_id)
    return {"success": True}
