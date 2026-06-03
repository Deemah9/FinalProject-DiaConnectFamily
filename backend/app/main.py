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
    _scheduler.start()
    print(
        f"[Scheduler] Glucose reminder job started "
        f"(every {REMINDER_INTERVAL_HOURS}h)"
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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:19006",
        "http://localhost:19000",
        "exp://localhost:8081",
        "exp://localhost:19000",
    ],
    allow_credentials=True,
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
