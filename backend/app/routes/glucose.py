import csv
import io
from datetime import datetime, timezone, timedelta

from fastapi import (
    APIRouter, Depends, File, HTTPException, UploadFile, status, Response
)
from app.middleware.dependencies import get_current_user, require_role
from app.models.glucose_reading import (
    GlucoseCreate, GlucoseResponse, GlucoseStatsResponse
)
from app.services.glucose_service import glucose_service
from app.services.alert_service import alert_service


router = APIRouter(prefix="/glucose", tags=["Glucose Readings"])


# ==========================================
# POST /glucose
# ==========================================

@router.post(
    "/",
    response_model=GlucoseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_glucose_reading(
    data: GlucoseCreate,
    current_user: dict = Depends(
        require_role("patient")
    )
):
    """
    Add a new glucose reading.
    Restricted to patients only.
    Source is automatically set to 'manual' by the server.
    Triggers an alert if the value is high (> 180) or low (< 70).
    """
    user_id = current_user["sub"]
    reading = glucose_service.create_reading(user_id=user_id, data=data)
    alert_service.evaluate_and_store(
        user_id=user_id,
        reading_id=reading["id"],
        value=reading["value"]
    )
    return reading


# ==========================================
# GET /glucose
# ==========================================

@router.get("/", response_model=list[GlucoseResponse])
async def get_glucose_readings(
    limit: int = 500,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve glucose readings for the current user.
    Available to both patients and family members.
    Results are ordered by measuredAt descending.
    limit: number of readings to return (default 500, max 2000).
    """
    limit = max(1, min(limit, 2000))
    return glucose_service.get_readings(
        user_id=current_user["sub"], limit=limit
    )


# ==========================================
# GET /glucose/latest
# ==========================================

@router.get("/latest", response_model=GlucoseResponse)
async def get_latest_reading(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve the most recent glucose reading for the current user.
    Returns 404 if no readings exist.
    """
    reading = glucose_service.get_latest(user_id=current_user["sub"])

    if not reading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No glucose readings found"
        )

    return reading


# ==========================================
# GET /glucose/stats
# ==========================================

@router.get("/stats", response_model=GlucoseStatsResponse)
def get_glucose_stats(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate and return glucose statistics for the current user.
    days: filter window — must be 7, 14, or 30 (default 7).
    Returns count, average, min, max, time_in_range, and the days filter used.
    Returns zeroed structure if no readings exist in the window.
    """
    if days not in (7, 14, 30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="days must be 7, 14, or 30"
        )
    return glucose_service.calculate_stats(
        user_id=current_user["sub"], days=days
    )


# ==========================================
# DELETE /glucose/{id}
# ==========================================

@router.delete("/{reading_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_glucose_reading(
    reading_id: str,
    current_user: dict = Depends(require_role("patient"))
):
    """
    Delete a glucose reading by ID.
    Restricted to patients only — a patient can only delete their own readings.
    Returns 404 if the reading does not exist or belongs to a different user.
    """
    deleted = glucose_service.delete_reading(
        user_id=current_user["sub"],
        reading_id=reading_id
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading not found or access denied"
        )

    # Remove any alerts that were triggered by this reading
    alert_service.delete_by_reading_id(reading_id=reading_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# POST /glucose/import-csv
# ==========================================

@router.post("/import-csv")
async def import_glucose_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("patient")),
):
    """
    Import glucose readings from a FreeStyle LibreLink CSV export.

    Quota optimisation:
      - Only imports the last 90 days (older rows are silently skipped).
      - Type-0 CGM readings are downsampled to one per 30-minute slot;
        type-1 manual scans are all kept (they are far fewer).

    CSV format (skip first 2 rows):
      Col 2: Device Timestamp (DD-MM-YYYY HH:MM)
      Col 3: Record Type — 0=historic (15-min CGM), 1=scan, 6=alarm (skip)
      Col 4: Historic Glucose mg/dL (type 0)
      Col 5: Scan Glucose mg/dL (type 1)
    """
    user_id = current_user["sub"]
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    # Skip the first 2 rows (metadata + header)
    data_rows = rows[2:]

    # ── Parse + filter + downsample in memory ────────────────────
    candidates: list[dict] = []
    seen_buckets: set[datetime] = set()  # for type-0 30-min dedup
    too_old_count = 0  # rows outside 90-day window → count as skipped

    for row in data_rows:
        if len(row) < 5:
            continue

        record_type_raw = row[3].strip()
        if record_type_raw not in ("0", "1"):
            continue

        record_type = int(record_type_raw)
        if record_type == 0:
            raw_value = row[4].strip()
        else:
            raw_value = row[5].strip() if len(row) > 5 else ""

        if not raw_value:
            continue

        try:
            value_mgdl = int(round(float(raw_value)))
        except ValueError:
            continue

        if not (40 <= value_mgdl <= 600):
            continue

        timestamp_raw = row[2].strip()
        try:
            measured_at = datetime.strptime(timestamp_raw, "%d-%m-%Y %H:%M")
            measured_at = measured_at.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        # ── 90-day window ─────────────────────────────────────────
        if measured_at < cutoff:
            too_old_count += 1
            continue

        # ── Downsample type-0: one reading per 30-min slot ───────
        if record_type == 0:
            bucket = measured_at.replace(
                minute=(measured_at.minute // 30) * 30,
                second=0,
                microsecond=0,
            )
            if bucket in seen_buckets:
                continue
            seen_buckets.add(bucket)

        candidates.append({"value": value_mgdl, "measuredAt": measured_at})

    # ── Batch write (1 read + batched writes) ────────────────────
    imported, skipped = glucose_service.batch_import_readings(
        user_id=user_id,
        readings=candidates,
        source="csv",
    )

    return {
        "imported_count": imported,
        "skipped_count": skipped + too_old_count,
        "source": "csv",
    }
