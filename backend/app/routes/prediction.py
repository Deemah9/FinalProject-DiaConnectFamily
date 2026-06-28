import math
from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.dependencies import get_current_user, require_role
from app.models.prediction import PredictionResponse
from app.services.prediction_service import prediction_service
from app.config.firebase import db


router = APIRouter(prefix="/glucose", tags=["Prediction"])


def _validate_params(hours: int, lang: str) -> str:
    if hours < 1 or hours > 24:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="hours must be between 1 and 24",
        )
    return lang if lang in ("ar", "en", "he") else "ar"


def _get_patient_name(user_id: str) -> str:
    try:
        doc = db.collection("users").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            return f"{data.get('firstName', '')} {data.get('lastName', '')}".strip() or "المريض"
    except Exception:
        pass
    return "المريض"


# ==========================================
# GET /glucose/predict  (patient)
# ==========================================

@router.get("/predict", response_model=PredictionResponse)
def predict_glucose(
    hours: int = 1,
    lang: str = "ar",
    current_user: dict = Depends(require_role("patient")),
):
    """
    Predict the patient's own glucose using a multi-variate LSTM model.
    Returns predicted value, trend, alert type, and AI advice for patient + family.
    """
    lang = _validate_params(hours, lang)
    user_id = current_user["sub"]
    result = prediction_service.predict(
        user_id=user_id,
        patient_name=_get_patient_name(user_id),
        hours=hours,
        lang=lang,
    )
    return PredictionResponse(**result)


# ==========================================
# GET /glucose/predict/family  (family member)
# ==========================================

@router.get("/predict/family", response_model=PredictionResponse)
def predict_glucose_for_family(
    patient_id: str,
    hours: int = 1,
    lang: str = "ar",
    current_user: dict = Depends(require_role("family_member")),
):
    """
    Allows a family member to fetch the glucose prediction for a linked patient.
    Returns the same result as /predict but uses advice.family for display.
    """
    lang = _validate_params(hours, lang)

    # Verify the family member is actually linked to this patient
    family_member_id = current_user["sub"]
    try:
        links = (
            db.collection("family_patient_links")
            .where("family_member_id", "==", family_member_id)
            .where("patient_id", "==", patient_id)
            .stream()
        )
        if not any(True for _ in links):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not linked to this patient",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify family link",
        )

    result = prediction_service.predict(
        user_id=patient_id,
        patient_name=_get_patient_name(patient_id),
        hours=hours,
        lang=lang,
    )
    return PredictionResponse(**result)


# ==========================================
# GET /glucose/predict/accuracy  (patient)
# ==========================================

@router.get("/predict/accuracy")
def get_prediction_accuracy(
    current_user: dict = Depends(require_role("patient")),
):
    """
    Calculate prediction accuracy for the current patient.
    Uses saved predictions where actualValue has been filled.
    Returns MAE and percentage of predictions within ±20 mg/dL.
    """
    user_id = current_user["sub"]

    docs = (
        db.collection("predictions")
        .where("userId", "==", user_id)
        .stream()
    )

    errors = []
    sq_errors = []
    for doc in docs:
        pred = doc.to_dict()
        predicted = pred.get("predictedValue")
        actual = pred.get("actualValue")
        if predicted is not None and actual is not None:
            e = abs(predicted - actual)
            errors.append(e)
            sq_errors.append((predicted - actual) ** 2)

    if not errors:
        return {
            "evaluated_predictions": 0,
            "mae_mg_dl": None,
            "rmse_mg_dl": None,
            "within_15_mg_dl_pct": None,
            "within_20_mg_dl_pct": None,
            "within_30_mg_dl_pct": None,
            "message": "No evaluated predictions yet.",
        }

    n = len(errors)
    mae      = round(sum(errors) / n, 1)
    rmse     = round(math.sqrt(sum(sq_errors) / n), 1)
    within15 = round(sum(1 for e in errors if e <= 15) / n * 100, 1)
    within20 = round(sum(1 for e in errors if e <= 20) / n * 100, 1)
    within30 = round(sum(1 for e in errors if e <= 30) / n * 100, 1)

    return {
        "evaluated_predictions": n,
        "mae_mg_dl":            mae,
        "rmse_mg_dl":           rmse,
        "within_15_mg_dl_pct":  within15,
        "within_20_mg_dl_pct":  within20,
        "within_30_mg_dl_pct":  within30,
        "message": f"Based on {n} evaluated prediction(s).",
    }
