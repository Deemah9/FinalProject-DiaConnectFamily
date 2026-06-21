from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.routes import auth
from app.routes import user_routes
from app.routes import glucose
from app.routes import daily_logs
from app.routes import alerts
from app.routes import family
from app.routes import prediction
from app.routes import libreview
from app.routes import health
from app.routes import notifications
from app.services.reminder_service import (
    send_glucose_reminders,
    REMINDER_INTERVAL_HOURS,
)

AUTO_PREDICTION_INTERVAL_MINUTES = 30


def run_auto_predictions():
    """
    Background job: run glucose prediction for every patient who has
    recent readings (<6 h old). Sends push + saves notification if the
    predicted or current value is out of range (high/low/patch_error).
    Rate-limiting inside PredictionService prevents notification spam.
    """
    import threading
    from app.config.firebase import db as _db
    from app.services.prediction_service import prediction_service
    from datetime import datetime, timezone, timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)

    try:
        users = _db.collection("users").where("role", "==", "patient").stream()
    except Exception as exc:
        print(f"[AutoPredict] Failed to fetch users: {exc}")
        return

    for user_doc in users:
        user_id = user_doc.id
        data = user_doc.to_dict()

        # Check for a recent reading before launching a heavy LSTM job
        try:
            recent = (
                _db.collection("glucose_readings")
                .where("userId", "==", user_id)
                .order_by("measuredAt", direction="DESCENDING")
                .limit(1)
                .stream()
            )
            latest = next((d.to_dict() for d in recent), None)
            if not latest:
                continue
            ts = latest.get("measuredAt")
            if ts and hasattr(ts, "tzinfo"):
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts < cutoff:
                    continue   # data too stale — skip to avoid pattern-only runs
        except Exception:
            continue

        first = data.get("firstName", "")
        last = data.get("lastName", "")
        patient_name = f"{first} {last}".strip() or "Patient"
        lang = data.get("language", "ar")

        def _predict(uid=user_id, name=patient_name, lng=lang):
            try:
                prediction_service.predict(user_id=uid, patient_name=name, hours=1, lang=lng)
                print(f"[AutoPredict] ✅ {uid}")
            except Exception as e:
                print(f"[AutoPredict] ⚠️ {uid}: {e}")

        threading.Thread(target=_predict, daemon=True).start()

# ==========================================
# Scheduler
# ==========================================

_scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _scheduler.add_job(
        send_glucose_reminders,
        "interval",
        hours=REMINDER_INTERVAL_HOURS,
        id="glucose_reminder",
        replace_existing=True,
    )
    _scheduler.add_job(
        run_auto_predictions,
        "interval",
        minutes=AUTO_PREDICTION_INTERVAL_MINUTES,
        id="auto_prediction",
        replace_existing=True,
    )
    _scheduler.start()
    print(
        f"[Scheduler] Glucose reminder job started "
        f"(every {REMINDER_INTERVAL_HOURS}h)"
    )
    print(
        f"[Scheduler] Auto-prediction job started "
        f"(every {AUTO_PREDICTION_INTERVAL_MINUTES} min)"
    )
    yield
    _scheduler.shutdown(wait=False)
    print("[Scheduler] Shutdown")

# ==========================================
# FastAPI Application
# ==========================================

app = FastAPI(
    title="DiaConnect Family API",
    description="Backend API for Type 2 Diabetes management platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Include Routers
# ==========================================

app.include_router(auth.router)
app.include_router(user_routes.router)
app.include_router(glucose.router)
app.include_router(daily_logs.router)
app.include_router(alerts.router)
app.include_router(family.router)
app.include_router(prediction.router)
app.include_router(libreview.router)
app.include_router(health.router)
app.include_router(notifications.router)


# ==========================================
# Root Endpoints
# ==========================================


@app.get("/")
def read_root():
    return {
        "message": "DiaConnect Family API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DiaConnect Family Backend",
    }
