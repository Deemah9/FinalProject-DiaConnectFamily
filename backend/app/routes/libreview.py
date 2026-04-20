from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import require_role
from app.models.libreview import SyncRequest, SyncResponse
from app.services import libreview_service
from app.services.glucose_service import glucose_service
from app.services.alert_service import alert_service


router = APIRouter(prefix="/libreview", tags=["LibreView Sync"])


# ==========================================
# POST /libreview/sync
# ==========================================

@router.post("/sync", response_model=SyncResponse)
def sync_libreview(
    body: SyncRequest,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Sync glucose readings from LibreView into DiaConnect Family.

    Flow:
      1. Login to LibreView with the patient's credentials.
      2. Fetch all linked patient connections.
      3. Fetch historical glucose readings (graph data).
      4. Save new readings to Firestore as source='libreview'.
      5. Skip any reading whose timestamp already exists (deduplication).
      6. Trigger alert evaluation for every new reading saved.

    Credentials are used only during this request and are never stored.

    Raises
    ------
    401 : wrong LibreView email or password.
    502 : LibreView API returned an unexpected error.
    504 : network timeout reaching LibreView.
    """
    user_id = current_user["sub"]

    # ── Step 1 & 2 & 3: connect to LibreView ─────────────────────
    try:
        readings = libreview_service.sync(
            email=body.email,
            password=body.password,
        )
    except ValueError as e:
        # ValueError = wrong credentials or API-level error
        msg = str(e).lower()
        if "incorrect" in msg or "invalid" in msg or "password" in msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Could not reach LibreView: {e}",
        )

    # ── Step 4 & 5: save to Firestore, skip duplicates ───────────
    imported = 0
    skipped = 0

    for r in readings:
        saved = glucose_service.create_reading_from_import(
            user_id=user_id,
            value=r["value"],
            measured_at=r["measuredAt"],
        )
        if saved:
            imported += 1
            # ── Step 6: alert evaluation ──────────────────────────
            alert_service.evaluate_and_store(
                user_id=user_id,
                reading_id=saved["id"],
                value=saved["value"],
            )
        else:
            skipped += 1

    return SyncResponse(
        imported_count=imported,
        skipped_count=skipped,
        source="libreview",
    )
