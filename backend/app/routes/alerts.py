from fastapi import APIRouter, Depends
from app.middleware.dependencies import get_current_user
from app.models.alert import AlertResponse
from app.services.alert_service import alert_service


router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ==========================================
# GET /alerts
# ==========================================

@router.get("/", response_model=list[AlertResponse])
def get_alerts(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve recent glucose alerts for the current user.
    Ordered by createdAt descending (most recent first).
    limit: max number of alerts to return (default 20, max 100).
    Available to both patients and family members.
    """
    limit = max(1, min(limit, 100))
    return alert_service.get_alerts(
        user_id=current_user["sub"], limit=limit
    )
