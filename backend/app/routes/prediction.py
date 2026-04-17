from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import get_current_user, require_role
from app.models.prediction import PredictionResponse
from app.services.prediction_service import prediction_service
from app.config.firebase import db


router = APIRouter(prefix="/glucose", tags=["Prediction"])


# ==========================================
# GET /glucose/predict
# ==========================================

@router.get("/predict", response_model=PredictionResponse)
def predict_glucose(
    hours: int = 1,
    lang: str = "ar",
    current_user: dict = Depends(require_role("patient")),
):
    """
    Predict the patient's next glucose reading using an LSTM model
    trained on their own historical data.

    hours: prediction horizon in hours (default 1, extensible to 2, 4, 24...).
    lang: language for AI advice (ar, en, he). Default: ar.
    Requires minimum 15 readings — returns a message if insufficient.
    Detects patch malfunctions and generates AI advice via Groq (LLaMA)
    for both the patient and linked family members.
    """
    if hours < 1 or hours > 24:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="hours must be between 1 and 24",
        )

    if lang not in ("ar", "en", "he"):
        lang = "ar"

    user_id = current_user["sub"]

    # Fetch patient name for AI advice
    patient_name = "المريض"
    try:
        doc = db.collection("users").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            patient_name = f"{data.get('firstName', '')} {data.get('lastName', '')}".strip() or "المريض"
    except Exception:
        pass

    result = prediction_service.predict(
        user_id=user_id,
        patient_name=patient_name,
        hours=hours,
        lang=lang,
    )

    return PredictionResponse(**result)
