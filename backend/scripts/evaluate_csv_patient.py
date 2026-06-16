"""
Evaluate prediction accuracy on a FreeStyle LibreView CSV export.

Usage (from backend directory):
    python scripts/evaluate_csv_patient.py <path_to_csv_file>

Example:
    python scripts/evaluate_csv_patient.py "C:/Users/ddway/Downloads/فايزنمر_glucose.csv"

What it does:
  1. Parses Historic Glucose readings (Record Type 0) from the CSV
  2. Splits 80% train / 20% test
  3. Fine-tunes the base LSTM on the training portion
  4. Predicts each point in the test portion using a rolling window
  5. Reports MAE, RMSE, and clinical accuracy thresholds
  6. Saves a predicted-vs-actual plot to scripts/eval_output/
"""

import os
import sys
import csv
import numpy as np
from pathlib import Path
from datetime import datetime

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

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


# ==========================================
# Parse LibreView CSV
# ==========================================

def parse_libreview_csv(csv_path: str) -> list[dict]:
    """
    Parse a FreeStyle LibreView CSV export.
    Returns list of dicts with keys: timestamp (datetime), value (float)
    Only Record Type 0 (Historic Glucose) is used.
    """
    readings = []
    with open(csv_path, encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()

    # Find the header row (contains "Device Timestamp")
    header_idx = None
    for i, line in enumerate(lines):
        if "Device Timestamp" in line or "Device,Serial" in line:
            # The actual column headers are on the NEXT line if this is metadata
            # LibreView format: row 0 = metadata, row 1 = column headers
            header_idx = i
            break

    if header_idx is None:
        raise ValueError("Could not find header row in CSV file.")

    # Use csv.DictReader starting from the header row
    content = "".join(lines[header_idx:])
    reader = csv.DictReader(content.splitlines())

    # Detect timestamp column name
    fieldnames = reader.fieldnames or []
    ts_col = next((f for f in fieldnames if "Timestamp" in f or "timestamp" in f), None)
    type_col = next((f for f in fieldnames if "Record Type" in f), None)
    hist_col = next((f for f in fieldnames if "Historic Glucose" in f), None)

    if not ts_col or not type_col or not hist_col:
        raise ValueError(
            f"Expected columns not found.\n"
            f"  Found: {fieldnames}\n"
            f"  Need: Device Timestamp, Record Type, Historic Glucose mg/dL"
        )

    for row in reader:
        # Only use Historic Glucose (Record Type 0)
        rec_type = row.get(type_col, "").strip()
        if rec_type != "0":
            continue

        ts_str = row.get(ts_col, "").strip()
        val_str = row.get(hist_col, "").strip()

        if not ts_str or not val_str:
            continue

        # Parse timestamp — LibreView format: DD-MM-YYYY HH:MM
        try:
            ts = datetime.strptime(ts_str, "%d-%m-%Y %H:%M")
        except ValueError:
            # Try ISO format as fallback
            try:
                ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M")
            except ValueError:
                continue

        try:
            value = float(val_str)
        except ValueError:
            continue

        if value < GLUCOSE_MIN or value > GLUCOSE_MAX:
            continue

        readings.append({"timestamp": ts, "value": value})

    # Sort chronologically
    readings.sort(key=lambda r: r["timestamp"])
    return readings


# ==========================================
# Build Feature Matrix (glucose + hour only; zeros for missing context)
# ==========================================

def build_feature_matrix(readings: list[dict]) -> np.ndarray:
    """
    Build (N, 6) feature matrix matching prediction_service.py's format.
    Since we have no meal/activity/sleep logs from the CSV, those features are 0.
    This reflects a "cold start" scenario — no lifestyle context.
    """
    rows = []
    for r in readings:
        glucose = r["value"]
        hour    = float(r["timestamp"].hour) + float(r["timestamp"].minute) / 60.0
        rows.append([glucose, hour, 0.0, 0.0, 0.0, 7.0])   # defaults: no carbs/activity, sleep=7h
    return np.array(rows, dtype=np.float32)


# ==========================================
# Fine-tune (mirrors prediction_service._predict_lstm)
# ==========================================

def finetune_model(base_model, feature_matrix: np.ndarray):
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

    X_aug, y_aug = [X_train_raw], [y_train_raw]
    for _ in range(AUGMENT_COPIES - 1):
        noise = np.random.normal(0, 0.01, X_train_raw.shape).astype(np.float32)
        X_aug.append(X_train_raw + noise)
        y_aug.append(y_train_raw)
    X_train = np.concatenate(X_aug)
    y_train = np.concatenate(y_aug)

    raw_w = np.exp(np.linspace(0, 3, len(X_train_raw))).astype(np.float32)
    aug_w = np.concatenate([raw_w] * AUGMENT_COPIES)
    aug_w = aug_w / aug_w.mean()

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
    scaled = svc._normalise(feature_matrix)
    seq    = scaled[-SEQUENCE_LENGTH:]
    inp    = seq.reshape(1, SEQUENCE_LENGTH, N_FEATURES)
    norm   = float(np.clip(model.predict(inp, verbose=0)[0][0], 0.0, 1.0))
    return norm * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN


# ==========================================
# Main
# ==========================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/evaluate_csv_patient.py <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not Path(csv_path).exists():
        print(f"❌  File not found: {csv_path}")
        sys.exit(1)

    print(f"\nParsing CSV: {csv_path}")
    readings = parse_libreview_csv(csv_path)

    if not readings:
        print("❌  No Historic Glucose readings found (Record Type 0).")
        sys.exit(1)

    n = len(readings)
    date_start = readings[0]["timestamp"].strftime("%Y-%m-%d")
    date_end   = readings[-1]["timestamp"].strftime("%Y-%m-%d")
    print(f"Found {n} readings  ({date_start} → {date_end})")

    min_needed = SEQUENCE_LENGTH + 1 + 5
    if n < min_needed:
        print(f"❌  Need at least {min_needed} readings (have {n}).")
        sys.exit(1)

    feature_matrix = build_feature_matrix(readings)

    # 80 / 20 split
    split     = max(SEQUENCE_LENGTH + 1, int(n * 0.8))
    train_mat = feature_matrix[:split]
    test_mat  = feature_matrix[split:]
    n_test    = len(test_mat)
    print(f"Train: {split} readings  |  Test: {n_test} readings")

    # Load and fine-tune base model
    import tensorflow as tf
    tf.random.set_seed(42)
    np.random.seed(42)

    print("Loading base model and fine-tuning …")
    svc2       = PredictionService.__new__(PredictionService)
    base_model = svc2._get_base_model()
    model, svc_norm = finetune_model(base_model, train_mat)
    print("Fine-tuning complete.")

    # Rolling prediction over test set
    print(f"Predicting {n_test} test points …")
    actuals   = []
    predicted = []

    for i in range(n_test):
        history = np.vstack([train_mat, test_mat[:i]]) if i > 0 else train_mat
        if len(history) < SEQUENCE_LENGTH:
            continue
        pred   = predict_one(model, svc_norm, history)
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

    # Print results
    print("\n" + "═" * 52)
    print("  Evaluation Results — Real Patient CSV")
    print("═" * 52)
    print(f"  CSV file         : {Path(csv_path).name}")
    print(f"  Date range       : {date_start} → {date_end}")
    print(f"  Total readings   : {n}")
    print(f"  Test points      : {len(actuals)}")
    print(f"  MAE              : {mae:.1f} mg/dL")
    print(f"  RMSE             : {rmse:.1f} mg/dL")
    print(f"  Within ±15 mg/dL : {w15:.1f} %   ← ISO 15197 standard")
    print(f"  Within ±20 mg/dL : {w20:.1f} %")
    print(f"  Within ±30 mg/dL : {w30:.1f} %")
    print("═" * 52)
    print("\n  Note: carbs/activity/sleep not available in CSV export.")
    print("  These features default to 0 — real app accuracy will be")
    print("  higher when lifestyle logs are present.")

    # Plot
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8),
                                        gridspec_kw={"height_ratios": [3, 1]})
        fig.suptitle(
            f"Glucose Prediction Accuracy — Real Patient (CSV)\n"
            f"MAE: {mae:.1f} mg/dL  |  RMSE: {rmse:.1f} mg/dL  |  "
            f"Within ±15: {w15:.1f}%\n"
            f"({date_start} → {date_end}, {n} readings, {n_test} test points)",
            fontsize=11, fontweight="bold"
        )

        x = np.arange(len(actuals))

        # Get test timestamps for x-axis labels
        test_readings = readings[split:split + len(actuals)]
        ts_labels = [r["timestamp"].strftime("%m-%d") for r in test_readings]
        tick_step = max(1, len(x) // 10)
        tick_x    = x[::tick_step]
        tick_lbl  = [ts_labels[i] for i in tick_x]

        ax1.plot(x, actuals,   color="#1A6FA8", linewidth=1.5, label="Actual")
        ax1.plot(x, predicted, color="#E05C2A", linewidth=1.2,
                 linestyle="--", alpha=0.85, label="Predicted")
        ax1.fill_between(x, predicted - 15, predicted + 15,
                         alpha=0.10, color="#E05C2A", label="±15 mg/dL band")
        ax1.axhline(70,  color="#EF4444", linewidth=0.8, linestyle=":", alpha=0.7)
        ax1.axhline(180, color="#F59E0B", linewidth=0.8, linestyle=":", alpha=0.7)
        ax1.set_xticks(tick_x)
        ax1.set_xticklabels(tick_lbl, fontsize=8)
        ax1.set_ylabel("Glucose (mg/dL)", fontsize=11)
        ax1.legend(loc="upper right", fontsize=9)
        ax1.grid(True, alpha=0.25)

        colors = ["#22C55E" if e <= 15 else "#F59E0B" if e <= 20 else "#EF4444"
                  for e in errors[:len(actuals)]]
        ax2.bar(x, errors[:len(actuals)], color=colors, width=0.8)
        ax2.axhline(15, color="#22C55E", linewidth=1.2, linestyle="--")
        ax2.axhline(20, color="#F59E0B", linewidth=1.2, linestyle="--")
        ax2.set_xticks(tick_x)
        ax2.set_xticklabels(tick_lbl, fontsize=8)
        ax2.set_ylabel("Abs Error (mg/dL)", fontsize=11)
        ax2.set_xlabel("Date", fontsize=11)

        green  = mpatches.Patch(color="#22C55E", label=f"≤15 mg/dL ({w15:.0f}%)")
        yellow = mpatches.Patch(color="#F59E0B", label=f"15–20 mg/dL")
        red    = mpatches.Patch(color="#EF4444", label=f">20 mg/dL")
        ax2.legend(handles=[green, yellow, red], fontsize=9, loc="upper right")
        ax2.grid(True, alpha=0.25)

        plt.tight_layout()
        fname    = Path(csv_path).stem.replace(" ", "_")[:20]
        out_path = OUTPUT_DIR / f"eval_csv_{fname}.png"
        plt.savefig(out_path, dpi=150, bbox_inches="tight")
        print(f"\n  Plot saved → {out_path}")
        plt.show()

    except ImportError:
        print("\n  (Install matplotlib to generate plot: pip install matplotlib)")


if __name__ == "__main__":
    main()
