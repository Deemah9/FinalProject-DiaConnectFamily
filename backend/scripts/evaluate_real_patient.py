"""
Evaluate prediction accuracy on a real patient's Firestore data.

Usage (from backend directory):
    python scripts/evaluate_real_patient.py <user_id>

What it does:
  1. Fetches all glucose readings + lifestyle context from Firestore
  2. Splits 80% train / 20% test
  3. Fine-tunes the base LSTM on the training portion
  4. Predicts each point in the test portion using a rolling window
  5. Reports MAE, RMSE, and clinical accuracy thresholds
  6. Saves a predicted-vs-actual plot to scripts/eval_output/
"""

import os
import sys
import numpy as np
from pathlib import Path

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config.firebase import initialize_firebase
from app.services.prediction_service import (
    PredictionService,
    SEQUENCE_LENGTH,
    N_FEATURES,
    GLUCOSE_MIN,
    GLUCOSE_MAX,
    AUGMENT_COPIES,
    FINETUNE_EPOCHS,
    FINETUNE_LR,
)

OUTPUT_DIR = Path(__file__).parent / "eval_output"
OUTPUT_DIR.mkdir(exist_ok=True)

MIN_TEST_POINTS = 5


def finetune_model(base_model, feature_matrix: np.ndarray):
    """Fine-tune base model on a feature matrix — mirrors prediction_service._predict_lstm."""
    import tensorflow as tf

    svc    = PredictionService.__new__(PredictionService)
    scaled = svc._normalise(feature_matrix)

    X, y = [], []
    for i in range(len(scaled) - SEQUENCE_LENGTH):
        X.append(scaled[i : i + SEQUENCE_LENGTH])
        y.append(scaled[i + SEQUENCE_LENGTH, 0])
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    split       = max(1, int(len(X) * 0.8))
    X_train_raw = X[:split]
    y_train_raw = y[:split]

    X_aug = [X_train_raw]
    y_aug = [y_train_raw]
    for _ in range(AUGMENT_COPIES - 1):
        noise = np.random.normal(0, 0.01, X_train_raw.shape).astype(np.float32)
        X_aug.append(X_train_raw + noise)
        y_aug.append(y_train_raw)
    X_train = np.concatenate(X_aug)
    y_train = np.concatenate(y_aug)

    raw_w = np.exp(np.linspace(0, 3, len(X_train_raw))).astype(np.float32)
    aug_w = np.concatenate([raw_w] * AUGMENT_COPIES)
    aug_w = aug_w / aug_w.mean()

    import tensorflow as tf
    model = tf.keras.models.clone_model(base_model)
    model.build((None, SEQUENCE_LENGTH, N_FEATURES))
    model.set_weights(base_model.get_weights())
    model.layers[0].trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=FINETUNE_LR),
        loss="mse",
    )
    model.fit(X_train, y_train, sample_weight=aug_w,
              epochs=FINETUNE_EPOCHS, batch_size=8, verbose=0)
    return model, svc


def predict_one(model, svc, feature_matrix: np.ndarray) -> float:
    """Predict the next glucose value given the full feature matrix available so far."""
    scaled = svc._normalise(feature_matrix)
    seq    = scaled[-SEQUENCE_LENGTH:]
    inp    = seq.reshape(1, SEQUENCE_LENGTH, N_FEATURES)
    norm   = float(np.clip(model.predict(inp, verbose=0)[0][0], 0.0, 1.0))
    return norm * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/evaluate_real_patient.py <user_id>")
        sys.exit(1)

    user_id = sys.argv[1]
    print(f"\nEvaluating model for user: {user_id}")

    initialize_firebase()
    svc = PredictionService()

    # ── Fetch data ──────────────────────────────────────────────────────────
    print("Fetching glucose readings from Firestore …")
    raw_readings = svc._fetch_readings(user_id)

    if not raw_readings:
        print("❌  No glucose readings found for this user.")
        sys.exit(1)

    profile  = svc._fetch_lifestyle_profile(user_id)
    log_ctx  = svc._fetch_daily_log_context(user_id)
    sleep_bl = profile["sleep_hours_baseline"]

    cleaned = svc._remove_outliers(raw_readings)

    rows = []
    for r in cleaned:
        hour, c30, c2h, activity, sleep = svc._context_for_reading(r, log_ctx, sleep_bl)
        rows.append([r["value"], hour, c30, c2h, activity, sleep])

    feature_matrix = np.array(rows, dtype=np.float32)
    n              = len(feature_matrix)

    print(f"Total readings after cleaning : {n}")

    min_needed = SEQUENCE_LENGTH + 1 + MIN_TEST_POINTS
    if n < min_needed:
        print(f"❌  Need at least {min_needed} readings for evaluation (have {n}).")
        sys.exit(1)

    # ── Split 80 / 20 ───────────────────────────────────────────────────────
    split      = max(SEQUENCE_LENGTH + 1, int(n * 0.8))
    train_mat  = feature_matrix[:split]
    test_mat   = feature_matrix[split:]
    n_test     = len(test_mat)

    print(f"Train readings : {split}  |  Test readings : {n_test}")

    # ── Load base model ──────────────────────────────────────────────────────
    print("Loading base model and fine-tuning …")
    import tensorflow as tf
    tf.random.set_seed(42)
    np.random.seed(42)

    svc2       = PredictionService.__new__(PredictionService)
    base_model = svc2._get_base_model()
    model, svc_norm = finetune_model(base_model, train_mat)
    print("Fine-tuning done.")

    # ── Rolling prediction over test set ────────────────────────────────────
    print(f"Predicting {n_test} test points …")
    actuals    = []
    predicted  = []

    for i in range(n_test):
        # history = all train readings + test readings seen so far
        history = np.vstack([train_mat, test_mat[:i]]) if i > 0 else train_mat
        if len(history) < SEQUENCE_LENGTH:
            continue
        pred = predict_one(model, svc_norm, history)
        actual = float(test_mat[i, 0])
        predicted.append(pred)
        actuals.append(actual)

    actuals   = np.array(actuals)
    predicted = np.array(predicted)
    errors    = np.abs(actuals - predicted)

    mae  = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((actuals - predicted) ** 2)))
    w15  = float(np.mean(errors <= 15) * 100)
    w20  = float(np.mean(errors <= 20) * 100)
    w30  = float(np.mean(errors <= 30) * 100)

    # ── Print results ────────────────────────────────────────────────────────
    print("\n" + "═" * 48)
    print("  Evaluation Results (Real Patient Data)")
    print("═" * 48)
    print(f"  User ID          : {user_id}")
    print(f"  Total readings   : {n}")
    print(f"  Test points      : {len(actuals)}")
    print(f"  MAE              : {mae:.1f} mg/dL")
    print(f"  RMSE             : {rmse:.1f} mg/dL")
    print(f"  Within ±15 mg/dL : {w15:.1f} %   ← ISO 15197 standard")
    print(f"  Within ±20 mg/dL : {w20:.1f} %")
    print(f"  Within ±30 mg/dL : {w30:.1f} %")
    print("═" * 48)

    # ── Plot ─────────────────────────────────────────────────────────────────
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8),
                                        gridspec_kw={"height_ratios": [3, 1]})
        fig.suptitle(
            f"Glucose Prediction Accuracy — Real Patient\n"
            f"MAE: {mae:.1f} mg/dL  |  RMSE: {rmse:.1f} mg/dL  |  "
            f"Within ±15: {w15:.1f}%",
            fontsize=13, fontweight="bold"
        )

        # Top plot: predicted vs actual
        x = np.arange(len(actuals))
        ax1.plot(x, actuals,   color="#1A6FA8", linewidth=2, label="Actual")
        ax1.plot(x, predicted, color="#E05C2A", linewidth=1.5,
                 linestyle="--", label="Predicted")
        ax1.fill_between(x,
                         predicted - 15, predicted + 15,
                         alpha=0.12, color="#E05C2A", label="±15 mg/dL band")
        ax1.axhline(70,  color="#EF4444", linewidth=0.8, linestyle=":")
        ax1.axhline(180, color="#F59E0B", linewidth=0.8, linestyle=":")
        ax1.set_ylabel("Glucose (mg/dL)", fontsize=11)
        ax1.legend(loc="upper right", fontsize=9)
        ax1.grid(True, alpha=0.3)

        # Bottom plot: absolute error per point
        colors = ["#22C55E" if e <= 15 else "#F59E0B" if e <= 20 else "#EF4444"
                  for e in errors[:len(actuals)]]
        ax2.bar(x, errors[:len(actuals)], color=colors, width=0.8)
        ax2.axhline(15, color="#22C55E", linewidth=1.2, linestyle="--", label="15 mg/dL")
        ax2.axhline(20, color="#F59E0B", linewidth=1.2, linestyle="--", label="20 mg/dL")
        ax2.set_ylabel("Abs Error (mg/dL)", fontsize=11)
        ax2.set_xlabel("Test Reading Index", fontsize=11)
        green  = mpatches.Patch(color="#22C55E", label=f"≤15 mg/dL ({w15:.0f}%)")
        yellow = mpatches.Patch(color="#F59E0B", label=f"15–20 mg/dL")
        red    = mpatches.Patch(color="#EF4444", label=f">20 mg/dL")
        ax2.legend(handles=[green, yellow, red], fontsize=9, loc="upper right")
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()
        out_path = OUTPUT_DIR / f"eval_{user_id[:8]}.png"
        plt.savefig(out_path, dpi=150, bbox_inches="tight")
        print(f"\n  Plot saved → {out_path}")
        plt.show()

    except ImportError:
        print("\n  (Install matplotlib to generate plot: pip install matplotlib)")


if __name__ == "__main__":
    main()
