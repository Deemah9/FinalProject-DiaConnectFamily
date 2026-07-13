"""
TC15 — GET /glucose/predict  (patient prediction)
TC16 — GET /glucose/predict/family  (family member prediction)
TC17 — GET /glucose/predict/accuracy  (accuracy calculation)
"""

from unittest.mock import MagicMock, patch
from tests.conftest import auth_headers

PATIENT_ID = "patient_pred_001"
FAMILY_ID  = "family_pred_001"


def make_prediction_result(hours=2, mode="real_time"):
    return {
        "predicted_value": 145.0,
        "hours": hours,
        "trend": "stable",
        "alert_type": None,
        "probability": 80,
        "prob_up": 20,
        "prob_down": 10,
        "advice": {"patient": "Your glucose is stable.", "family": "Patient is stable."},
        "readings_used": 12,
        "message": None,
        "data_stale": False,
        "hours_since_last_reading": 1.5,
        "prediction_mode": mode,
        "pattern_prediction": None,
        "comparison_to_pattern": "within_normal",
    }


# ==========================================
# TC15 — Patient Prediction
# ==========================================

class TestPatientPrediction:

    @patch("app.routes.prediction.db")
    @patch("app.services.prediction_service.prediction_service.predict")
    def test_predict_returns_valid_response(self, mock_predict, mock_db, client):
        """TC15: Patient requests a 2-hour prediction — returns predicted value and trend."""
        mock_predict.return_value = make_prediction_result(hours=2)

        patient_doc = MagicMock()
        patient_doc.exists = True
        patient_doc.to_dict.return_value = {"firstName": "Deema", "lastName": "Nimer"}
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc

        res = client.get(
            "/glucose/predict?hours=2&lang=en",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["predicted_value"] == 145.0
        assert data["trend"] == "stable"
        assert data["prediction_mode"] == "real_time"

    @patch("app.routes.prediction.db")
    @patch("app.services.prediction_service.prediction_service.predict")
    def test_predict_1_hour_accepted(self, mock_predict, mock_db, client):
        """TC15: Minimum valid hours value (1) is accepted."""
        mock_predict.return_value = make_prediction_result(hours=1)

        patient_doc = MagicMock()
        patient_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc

        res = client.get(
            "/glucose/predict?hours=1",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200

    @patch("app.routes.prediction.db")
    @patch("app.services.prediction_service.prediction_service.predict")
    def test_predict_24_hours_accepted(self, mock_predict, mock_db, client):
        """TC15: Maximum valid hours value (24) is accepted."""
        mock_predict.return_value = make_prediction_result(hours=24, mode="pattern")

        patient_doc = MagicMock()
        patient_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc

        res = client.get(
            "/glucose/predict?hours=24",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200

    def test_predict_hours_0_returns_400(self, client):
        """TC15: hours=0 is below minimum — returns 400."""
        res = client.get(
            "/glucose/predict?hours=0",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 400
        assert "hours" in res.json()["detail"]

    def test_predict_hours_25_returns_400(self, client):
        """TC15: hours=25 exceeds maximum — returns 400."""
        res = client.get(
            "/glucose/predict?hours=25",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 400
        assert "hours" in res.json()["detail"]

    def test_predict_family_member_forbidden(self, client):
        """TC15: /predict is restricted to patients — family member gets 403."""
        res = client.get(
            "/glucose/predict?hours=1",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_predict_requires_auth(self, client):
        """TC15: Prediction without token returns 403."""
        res = client.get("/glucose/predict?hours=1")
        assert res.status_code == 403


# ==========================================
# TC16 — Family Member Prediction
# ==========================================

class TestFamilyPrediction:

    @patch("app.routes.prediction.db")
    @patch("app.services.prediction_service.prediction_service.predict")
    def test_family_predict_linked_patient(self, mock_predict, mock_db, client):
        """TC16: Family member requests prediction for a linked patient — succeeds."""
        mock_predict.return_value = make_prediction_result(hours=1)

        link_doc = MagicMock()
        patient_doc = MagicMock()
        patient_doc.exists = True
        patient_doc.to_dict.return_value = {"firstName": "Deema", "lastName": "Nimer"}

        mock_db.collection.return_value.where.return_value.where.return_value.stream.return_value = iter([link_doc])
        mock_db.collection.return_value.document.return_value.get.return_value = patient_doc

        res = client.get(
            f"/glucose/predict/family?patient_id={PATIENT_ID}&hours=1&lang=en",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 200
        assert res.json()["predicted_value"] == 145.0

    @patch("app.routes.prediction.db")
    def test_family_predict_not_linked_returns_403(self, mock_db, client):
        """TC16: Family member gets 403 when not linked to the requested patient."""
        mock_db.collection.return_value.where.return_value.where.return_value.stream.return_value = iter([])

        res = client.get(
            f"/glucose/predict/family?patient_id={PATIENT_ID}&hours=1",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_patient_cannot_use_family_predict_route(self, client):
        """TC16: /predict/family is restricted to family_member role."""
        res = client.get(
            f"/glucose/predict/family?patient_id={PATIENT_ID}&hours=1",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 403

    def test_family_predict_invalid_hours_returns_400(self, client):
        """TC16: Invalid hours in family prediction also returns 400."""
        res = client.get(
            f"/glucose/predict/family?patient_id={PATIENT_ID}&hours=0",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 400

    def test_family_predict_requires_auth(self, client):
        """TC16: Family prediction without token returns 403."""
        res = client.get(f"/glucose/predict/family?patient_id={PATIENT_ID}&hours=1")
        assert res.status_code == 403


# ==========================================
# TC17 — Prediction Accuracy
# ==========================================

class TestPredictionAccuracy:

    @patch("app.routes.prediction.db")
    def test_accuracy_returns_mae_when_data_exists(self, mock_db, client):
        """TC17: MAE is calculated correctly from stored predictions."""
        pred_doc = MagicMock()
        pred_doc.to_dict.return_value = {
            "userId": PATIENT_ID,
            "predictedValue": 150.0,
            "actualValue": 140.0,
            "hours": 2,
        }
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([pred_doc])

        res = client.get(
            "/glucose/predict/accuracy",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["evaluated_predictions"] == 1
        assert data["mae_mg_dl"] == 10.0

    @patch("app.routes.prediction.db")
    def test_accuracy_within_20_percent_calculation(self, mock_db, client):
        """TC17: Predictions within ±20 mg/dL are counted correctly."""
        docs = []
        for predicted, actual in [(150, 160), (120, 130), (200, 185)]:
            doc = MagicMock()
            doc.to_dict.return_value = {
                "userId": PATIENT_ID,
                "predictedValue": float(predicted),
                "actualValue": float(actual),
                "hours": 1,
            }
            docs.append(doc)

        mock_db.collection.return_value.where.return_value.stream.return_value = iter(docs)

        res = client.get(
            "/glucose/predict/accuracy",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["evaluated_predictions"] == 3
        assert data["within_20_mg_dl_pct"] == 100.0  # all within 20 mg/dL

    @patch("app.routes.prediction.db")
    def test_accuracy_skips_predictions_without_actual(self, mock_db, client):
        """TC17: Predictions without actualValue are excluded from MAE calculation."""
        doc_with_actual = MagicMock()
        doc_with_actual.to_dict.return_value = {
            "userId": PATIENT_ID,
            "predictedValue": 150.0,
            "actualValue": 140.0,
            "hours": 1,
        }
        doc_without_actual = MagicMock()
        doc_without_actual.to_dict.return_value = {
            "userId": PATIENT_ID,
            "predictedValue": 180.0,
            "actualValue": None,
            "hours": 2,
        }
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([
            doc_with_actual, doc_without_actual
        ])

        res = client.get(
            "/glucose/predict/accuracy",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        assert res.json()["evaluated_predictions"] == 1

    @patch("app.routes.prediction.db")
    def test_accuracy_no_data_returns_message(self, mock_db, client):
        """TC17: No evaluated predictions returns message with None MAE."""
        mock_db.collection.return_value.where.return_value.stream.return_value = iter([])

        res = client.get(
            "/glucose/predict/accuracy",
            headers=auth_headers(PATIENT_ID, "patient"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["evaluated_predictions"] == 0
        assert data["mae_mg_dl"] is None

    def test_accuracy_family_member_forbidden(self, client):
        """TC17: Family member cannot access the accuracy endpoint."""
        res = client.get(
            "/glucose/predict/accuracy",
            headers=auth_headers(FAMILY_ID, "family_member"),
        )
        assert res.status_code == 403

    def test_accuracy_requires_auth(self, client):
        """TC17: Accuracy without token returns 403."""
        res = client.get("/glucose/predict/accuracy")
        assert res.status_code == 403
