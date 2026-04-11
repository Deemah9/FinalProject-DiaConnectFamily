from fastapi import FastAPI
from app.routes import auth
from app.routes import user_routes
from app.routes import glucose
from app.routes import daily_logs
from app.routes import alerts
from fastapi.middleware.cors import CORSMiddleware

# ==========================================
# FastAPI Application
# ==========================================

app = FastAPI(
    title="DiaConnect Family API",
    description="Backend API for Type 2 Diabetes management platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8081",
        "exp://localhost:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ==========================================
# Include Routers
# ==========================================

# Include authentication routes
app.include_router(auth.router)
app.include_router(user_routes.router)
app.include_router(glucose.router)
app.include_router(daily_logs.router)
app.include_router(alerts.router)


# ==========================================
# Root Endpoints
# ==========================================


@app.get("/")
def read_root():
    """
    Root endpoint - API information.
    """
    return {
        "message": "DiaConnect Family API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "DiaConnect Family Backend"
    }
