"""
Unit tests for PredictionService's model-cache / background-retrain policy.

_predict_lstm / _train_model / _background_retrain never touch Firestore
(they operate purely on an in-memory feature matrix + the in-process cache),
so these run against the real `prediction_service` singleton directly, with
`_train_model` mocked to avoid exercising real Keras training.
"""

import threading
import time
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.services.prediction_service import (
    prediction_service,
    RETRAIN_AFTER_NEW_READINGS,
    TRAINING_WINDOW_READINGS,
)

USER_ID = "cache_test_patient"


def _feature_matrix(n: int) -> np.ndarray:
    return np.array(
        [[120.0, float(h % 24), 0.0, 0.0, 0.0, 7.0] for h in range(n)],
        dtype=np.float32,
    )


def _seed_cache(trained_n_readings: int, training_in_progress: bool = False) -> MagicMock:
    model = MagicMock()
    model.predict.return_value = np.array([[0.5]])
    prediction_service._model_cache[USER_ID] = {
        "model": model,
        "sigma": 15.0,
        "trained_n_readings": trained_n_readings,
        "training_in_progress": training_in_progress,
    }
    return model


@pytest.fixture(autouse=True)
def _clean_cache():
    yield
    prediction_service._model_cache.pop(USER_ID, None)


class TestSubThreshold:
    def test_fewer_than_threshold_new_readings_reuses_cached_model(self):
        cached_model = _seed_cache(trained_n_readings=100)

        with patch.object(prediction_service, "_train_model") as mock_train, \
             patch.object(prediction_service, "_background_retrain") as mock_bg:
            fm = _feature_matrix(100 + RETRAIN_AFTER_NEW_READINGS - 1)  # one below threshold
            prediction_service._predict_lstm(fm, USER_ID, hours=1)

        mock_train.assert_not_called()
        mock_bg.assert_not_called()
        entry = prediction_service._model_cache[USER_ID]
        assert entry["model"] is cached_model
        assert entry["trained_n_readings"] == 100
        assert entry["training_in_progress"] is False


class TestThresholdCrossing:
    def test_crossing_threshold_spawns_exactly_one_background_retrain(self):
        _seed_cache(trained_n_readings=100)

        with patch.object(prediction_service, "_background_retrain") as mock_bg:
            fm = _feature_matrix(100 + RETRAIN_AFTER_NEW_READINGS)  # exactly at threshold

            barrier = threading.Barrier(5)

            def fire():
                barrier.wait(timeout=2)
                prediction_service._predict_lstm(fm, USER_ID, hours=1)

            callers = [threading.Thread(target=fire) for _ in range(5)]
            for t in callers:
                t.start()
            for t in callers:
                t.join(timeout=5)

            # _background_retrain runs on a separate daemon thread spawned inside
            # _predict_lstm; give it a brief, generous window to actually execute
            # the (mocked, effectively instant) call before asserting.
            time.sleep(0.3)

        assert mock_bg.call_count == 1
        assert prediction_service._model_cache[USER_ID]["training_in_progress"] is True


class TestBackgroundRetrain:
    def test_failed_retrain_leaves_old_model_intact(self):
        old_model = _seed_cache(trained_n_readings=100, training_in_progress=True)

        with patch.object(prediction_service, "_train_model", side_effect=RuntimeError("boom")):
            prediction_service._background_retrain(USER_ID, _feature_matrix(110), 110)

        entry = prediction_service._model_cache[USER_ID]
        assert entry["model"] is old_model
        assert entry["trained_n_readings"] == 100
        assert entry["training_in_progress"] is False

    def test_successful_retrain_replaces_cache_entry(self):
        _seed_cache(trained_n_readings=100, training_in_progress=True)
        new_model, new_sigma = MagicMock(), 12.0

        with patch.object(prediction_service, "_train_model", return_value=(new_model, new_sigma)):
            prediction_service._background_retrain(USER_ID, _feature_matrix(110), 110)

        entry = prediction_service._model_cache[USER_ID]
        assert entry["model"] is new_model
        assert entry["sigma"] == new_sigma
        assert entry["trained_n_readings"] == 110
        assert entry["training_in_progress"] is False


class TestTrainingWindowCap:
    def test_training_uses_capped_window_not_full_history(self):
        """
        A user with far more readings than TRAINING_WINDOW_READINGS should
        only have the most recent window fed into training — training cost
        must not keep growing forever with lifetime history size.
        """
        huge_n = TRAINING_WINDOW_READINGS + 500
        fm = _feature_matrix(huge_n)

        with patch.object(prediction_service, "_train_model") as mock_train:
            mock_train.return_value = (MagicMock(), 10.0)
            prediction_service._predict_lstm(fm, USER_ID, hours=1)

        mock_train.assert_called_once()
        passed_matrix = mock_train.call_args[0][0]
        assert passed_matrix.shape[0] == TRAINING_WINDOW_READINGS

    def test_full_history_still_used_for_retrain_threshold_bookkeeping(self):
        """`trained_n_readings` must reflect the TOTAL reading count, not the
        windowed training size, so the 10-new-readings threshold logic in
        _predict_lstm still works correctly."""
        huge_n = TRAINING_WINDOW_READINGS + 500
        fm = _feature_matrix(huge_n)

        with patch.object(prediction_service, "_train_model", return_value=(MagicMock(), 10.0)):
            prediction_service._predict_lstm(fm, USER_ID, hours=1)

        assert prediction_service._model_cache[USER_ID]["trained_n_readings"] == huge_n
