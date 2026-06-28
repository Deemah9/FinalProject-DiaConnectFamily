"""
Evaluate the Pattern+LSTM seeding mode (v4 pattern mode).

Simulates the exact pipeline that runs when a user's data is stale (>24 h):
  Stage 1 — Pattern Analysis:
      Find readings in the last 30 days within ±1.5 h of the test point's
      time-of-day, apply recency weighting → weighted_avg = estimated_current.
  Stage 2 — LSTM seeded with estimated_current:
      Inject a synthetic "now" row using estimated_current, then run the
      fine-tuned LSTM forward from that seed to produce a predicted value.

Usage (from backend directory):
    python scripts/evaluate_pattern_mode.py <path_to_csv>

Example:
    python scripts/evaluate_pattern_mode.py "C:/Users/ddway/Downloads/فايزنمر_glucose_26-6-2026.csv"

What it does:
  1. Parses CSV (Historic Glucose, Record Type 0)
  2. Builds a sliding test window: for each test point T,
       - "history" = all readings from [T-30days .. T-25h]   (stale scenario)
       - Stage 1: pattern analysis on history → estimated_current
       - Stage 2: fine-tune LSTM on history, then seed with estimated_current → predicted
  3. Reports MAE, RMSE, ±15, ±20, ±30 mg/dL for both stages
  4. Saves comparison plot
"""

import os
import sys
import csv
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta

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
    PATTERN_DAYS,
    PATTERN_HOUR_WINDOW,
)

OUTPUT_DIR = Path(__file__).parent / "eval_output"
OUTPUT_DIR.mkdir(exist_ok=True)

STALE_HOURS   = 25      # simulate data gap (>MAX_STALE_HOURS = 24)
MIN_HISTORY   = SEQUENCE_LENGTH + 5
MIN_PATTERN_SAMPLES = 3
DEFAULT_SLEEP = 7.0


# ==========================================
# Parse LibreView CSV
# ==========================================

def parse_libreview_csv(csv_path: str) -> list[dict]:
    readings = []
    with open(csv_path, encoding="utf-8-sig", errors="replace") as f:
        lines = f.readlines()

    header_idx = None
    for i, line in enumerate(lines):
        if "Device Timestamp" in line or "Device,Serial" in line:
            header_idx = i
            break
    if header_idx is None:
        raise ValueError("Could not find header row in CSV file.")

    content = "".join(lines[header_idx:])
    reader  = csv.DictReader(content.splitlines())
    fnames  = reader.fieldnames or []

    ts_col   = next((f for f in fnames if "Timestamp"      in f), None)
    type_col = next((f for f in fnames if "Record Type"    in f), None)
    hist_col = next((f for f in fnames if "Historic Glucose" in f), None)

    if not ts_col or not type_col or not hist_col:
        raise ValueError(f"Expected columns not found. Found: {fnames}")

    for row in reader:
        if row.get(type_col, "").strip() != "0":
            continue
        ts_str  = row.get(ts_col,   "").strip()
        val_str = row.get(hist_col, "").strip()
        if not ts_str or not val_str:
            continue
        for fmt in ("%d-%m-%Y %H:%M", "%Y-%m-%d %H:%M"):
            try:
                ts = datetime.strptime(ts_str, fmt)
                break
            except ValueError:
                ts = None
        if ts is None:
            continue
        try:
            value = float(val_str)
        except ValueError:
            continue
        if GLUCOSE_MIN <= value <= GLUCOSE_MAX:
            readings.append({"timestamp": ts, "value": value})

    readings.sort(key=lambda r: r["timestamp"])
    return readings


# ==========================================
# Pattern Analysis (mirrors calculate_pattern_prediction)
# ==========================================

def hour_distance(h1: float, h2: float) -> float:
    d = abs(h1 - h2)
    return min(d, 24.0 - d)


def pattern_estimate(history: list[dict], target_ts: datetime) -> float | None:
    """
    Estimate glucose at target_ts using pattern analysis on history.
    Returns weighted average of readings within ±PATTERN_HOUR_WINDOW of
    target_ts's time-of-day, with recency weighting 1/(days_ago+1).
    Returns None if insufficient samples.
    """
    current_hour = target_ts.hour + target_ts.minute / 60.0
    cutoff       = target_ts - timedelta(days=PATTERN_DAYS)

    weighted_sum  = 0.0
    total_weight  = 0.0
    sample_count  = 0

    for r in history:
        ts = r["timestamp"]
        if ts < cutoff:
            continue
        r_hour = ts.hour + ts.minute / 60.0
        if hour_distance(r_hour, current_hour) > PATTERN_HOUR_WINDOW:
            continue
        days_ago = max(0.0, (target_ts - ts).total_seconds() / 86400)
        weight   = 1.0 / (days_ago + 1.0)
        weighted_sum  += r["value"] * weight
        total_weight  += weight
        sample_count  += 1

    if sample_count < MIN_PATTERN_SAMPLES or total_weight == 0:
        return None

    return weighted_sum / total_weight


# ==========================================
# Build Feature Matrix
# ==========================================

def build_feature_matrix(readings: list[dict]) -> np.ndarray:
    rows = []
    for r in readings:
        hour = r["timestamp"].hour + r["timestamp"].minute / 60.0
        rows.append([r["value"], hour, 0.0, 0.0, 0.0, DEFAULT_SLEEP])
    return np.array(rows, dtype=np.float32)


# ==========================================
# Fine-tune + Predict (mirrors _predict_lstm)
# ==========================================

def finetune_and_predict(
    base_model,
    svc: PredictionService,
    feature_matrix: np.ndarray,
    seed_matrix: np.ndarray,
    hours: int = 1,
):
    """
    Fine-tune base_model on feature_matrix, then predict using seed_matrix.
    Mirrors prediction_service._predict_lstm with seed_override.
    """
    import tensorflow as tf

    scaled = svc._normalise(feature_matrix)
    X, y = [], []
    for i in range(len(scaled) - SEQUENCE_LENGTH):
        X.append(scaled[i: i + SEQUENCE_LENGTH])
        y.append(scaled[i + SEQUENCE_LENGTH, 0])
    if len(X) == 0:
        return None

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    split       = max(1, int(len(X) * 0.8))
    X_raw_train = X[:split]
    y_raw_train = y[:split]

    X_aug, y_aug = [X_raw_train], [y_raw_train]
    for _ in range(AUGMENT_COPIES - 1):
        noise = np.random.normal(0, 0.01, X_raw_train.shape).astype(np.float32)
        X_aug.append(X_raw_train + noise)
        y_aug.append(y_raw_train)
    X_train = np.concatenate(X_aug)
    y_train = np.concatenate(y_aug)

    raw_w = np.exp(np.linspace(0, 3, len(X_raw_train))).astype(np.float32)
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

    # Predict with seed_override
    seed_scaled     = svc._normalise(seed_matrix)
    seq             = list(seed_scaled[-SEQUENCE_LENGTH:])
    last_hour_raw   = seed_matrix[-1, 1]
    last_context    = seed_scaled[-1, 2:].copy()

    predicted_norm = 0.0
    for step in range(hours):
        inp            = np.array(seq[-SEQUENCE_LENGTH:]).reshape(1, SEQUENCE_LENGTH, N_FEATURES)
        predicted_norm = float(np.clip(model.predict(inp, verbose=0)[0][0], 0.0, 1.0))
        next_hour      = ((last_hour_raw + step + 1) % 24) / 24.0
        next_row       = np.concatenate([[predicted_norm, next_hour], last_context])
        seq.append(next_row)

    return predicted_norm * (GLUCOSE_MAX - GLUCOSE_MIN) + GLUCOSE_MIN


# ==========================================
# Main
# ==========================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/evaluate_pattern_mode.py <path_to_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not Path(csv_path).exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    print(f"\nParsing CSV: {csv_path}")
    all_readings = parse_libreview_csv(csv_path)
    n = len(all_readings)
    if n == 0:
        print("No Historic Glucose readings found.")
        sys.exit(1)

    date_start = all_readings[0]["timestamp"].strftime("%Y-%m-%d")
    date_end   = all_readings[-1]["timestamp"].strftime("%Y-%m-%d")
    print(f"Found {n} readings  ({date_start} -> {date_end})")

    # Use last 20% as test candidates (same split as evaluate_csv_patient)
    split      = max(MIN_HISTORY, int(n * 0.8))
    test_pool  = all_readings[split:]
    print(f"Test pool: {len(test_pool)} readings (last 20%)")
    print(f"Stale gap simulated: {STALE_HOURS} h (> MAX_STALE_HOURS=24 h)\n")

    import tensorflow as tf
    tf.random.set_seed(42)
    np.random.seed(42)

    svc        = PredictionService.__new__(PredictionService)
    base_model = svc._get_base_model()

    actuals         = []
    pattern_preds   = []   # Stage 1 only: pattern estimate (no LSTM)
    seeded_preds    = []   # Stage 2: LSTM seeded with pattern estimate
    skipped_no_pat  = 0
    skipped_no_hist = 0

    print(f"Evaluating {len(test_pool)} test points …")
    for idx, test_r in enumerate(test_pool):
        target_ts  = test_r["timestamp"]
        actual_val = test_r["value"]

        # History = readings available when data is stale (>25 h gap)
        stale_cutoff = target_ts - timedelta(hours=STALE_HOURS)
        history = [r for r in all_readings if r["timestamp"] <= stale_cutoff]

        if len(history) < MIN_HISTORY:
            skipped_no_hist += 1
            continue

        # Stage 1: pattern estimate
        estimated = pattern_estimate(history, target_ts)
        if estimated is None:
            skipped_no_pat += 1
            continue

        # Stage 2: LSTM seeded with estimated_current
        feature_matrix = build_feature_matrix(history)
        target_hour    = target_ts.hour + target_ts.minute / 60.0
        virtual_row    = np.array(
            [[estimated, target_hour, 0.0, 0.0, 0.0, DEFAULT_SLEEP]],
            dtype=np.float32,
        )
        seed_matrix = np.vstack([feature_matrix, virtual_row])

        predicted = finetune_and_predict(base_model, svc, feature_matrix, seed_matrix, hours=1)
        if predicted is None:
            skipped_no_hist += 1
            continue

        predicted = float(np.clip(predicted, GLUCOSE_MIN, GLUCOSE_MAX))

        actuals.append(actual_val)
        pattern_preds.append(estimated)
        seeded_preds.append(predicted)

        if (idx + 1) % 50 == 0 or idx == len(test_pool) - 1:
            print(f"  [{idx+1}/{len(test_pool)}] "
                  f"actual={actual_val:.0f}  "
                  f"pattern_est={estimated:.0f}  "
                  f"lstm_pred={predicted:.0f}  "
                  f"err={abs(predicted-actual_val):.0f}")

    if not actuals:
        print("\nNo test points evaluated (check data range or stale gap).")
        sys.exit(1)

    print(f"\nSkipped — insufficient history : {skipped_no_hist}")
    print(f"Skipped — no pattern samples   : {skipped_no_pat}")

    actuals       = np.array(actuals)
    pattern_preds = np.array(pattern_preds)
    seeded_preds  = np.array(seeded_preds)

    def metrics(preds, label):
        errs = np.abs(actuals - preds)
        mae  = float(np.mean(errs))
        rmse = float(np.sqrt(np.mean((actuals - preds) ** 2)))
        w15  = float(np.mean(errs <= 15) * 100)
        w20  = float(np.mean(errs <= 20) * 100)
        w30  = float(np.mean(errs <= 30) * 100)
        print(f"\n  [{label}]")
        print(f"  MAE              : {mae:.1f} mg/dL")
        print(f"  RMSE             : {rmse:.1f} mg/dL")
        print(f"  Within +-15 mg/dL: {w15:.1f} %  (ISO 15197)")
        print(f"  Within +-20 mg/dL: {w20:.1f} %")
        print(f"  Within +-30 mg/dL: {w30:.1f} %")
        return mae, rmse, w15, w20, w30

    print("\n" + "=" * 54)
    print("  Evaluation Results — Pattern Mode (v4)")
    print("=" * 54)
    print(f"  CSV              : {Path(csv_path).name}")
    print(f"  Date range       : {date_start} -> {date_end}")
    print(f"  Total readings   : {n}")
    print(f"  Evaluated points : {len(actuals)}")

    m_pat = metrics(pattern_preds, "Stage 1 only: Pattern estimate (no LSTM)")
    m_seq = metrics(seeded_preds,  "Stage 2:      Pattern + LSTM seed (full pipeline)")

    print("\n  Improvement (Stage 2 vs Stage 1):")
    print(f"  MAE  : {m_pat[0]:.1f} -> {m_seq[0]:.1f}  ({m_pat[0]-m_seq[0]:+.1f})")
    print(f"  RMSE : {m_pat[1]:.1f} -> {m_seq[1]:.1f}  ({m_pat[1]-m_seq[1]:+.1f})")
    print(f"  +-15 : {m_pat[2]:.1f}% -> {m_seq[2]:.1f}%  ({m_seq[2]-m_pat[2]:+.1f}pp)")
    print(f"  +-30 : {m_pat[4]:.1f}% -> {m_seq[4]:.1f}%  ({m_seq[4]-m_pat[4]:+.1f}pp)")
    print("=" * 54)
    print("\n  Note: lifestyle features (carbs/activity/sleep) default to 0.")
    print("  Real app accuracy is higher when the user has logged lifestyle data.")

    # Plot
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches

        x = np.arange(len(actuals))

        fig, axes = plt.subplots(3, 1, figsize=(16, 11),
                                  gridspec_kw={"height_ratios": [3, 1, 1]})
        fig.suptitle(
            f"Pattern+LSTM Mode Accuracy\n"
            f"Stage1 Pattern: MAE={m_pat[0]:.1f} mg/dL  |  "
            f"Stage2 LSTM-Seeded: MAE={m_seq[0]:.1f} mg/dL  |  "
            f"Within +-15: {m_seq[2]:.1f}%\n"
            f"({date_start} -> {date_end},  {len(actuals)} stale-scenario test points)",
            fontsize=11, fontweight="bold",
        )

        ax1, ax2, ax3 = axes

        ax1.plot(x, actuals,       color="#1A6FA8", lw=1.5,  label="Actual")
        ax1.plot(x, pattern_preds, color="#9B59B6", lw=1.0,
                 linestyle=":",  alpha=0.8, label="Stage1: Pattern estimate")
        ax1.plot(x, seeded_preds,  color="#E05C2A", lw=1.2,
                 linestyle="--", alpha=0.9, label="Stage2: LSTM-Seeded")
        ax1.fill_between(x, seeded_preds - 15, seeded_preds + 15,
                         alpha=0.08, color="#E05C2A")
        ax1.axhline(70,  color="#EF4444", lw=0.8, linestyle=":", alpha=0.6)
        ax1.axhline(180, color="#F59E0B", lw=0.8, linestyle=":", alpha=0.6)
        ax1.set_ylabel("Glucose (mg/dL)", fontsize=10)
        ax1.legend(fontsize=9, loc="upper right")
        ax1.grid(True, alpha=0.2)

        def error_bars(ax, preds, label, color_good="#22C55E",
                       color_mid="#F59E0B", color_bad="#EF4444"):
            errs = np.abs(actuals - preds)
            colors = [color_good if e <= 15 else color_mid if e <= 20 else color_bad
                      for e in errs]
            ax.bar(x, errs, color=colors, width=0.8)
            ax.axhline(15, color=color_good, lw=1.2, linestyle="--")
            ax.axhline(20, color=color_mid,  lw=1.2, linestyle="--")
            ax.set_ylabel(f"|Error| {label}", fontsize=9)
            ax.grid(True, alpha=0.2)

        error_bars(ax2, pattern_preds, "(Stage1)")
        error_bars(ax3, seeded_preds,  "(Stage2)")

        green  = mpatches.Patch(color="#22C55E", label="<=15 mg/dL")
        yellow = mpatches.Patch(color="#F59E0B", label="15-20 mg/dL")
        red    = mpatches.Patch(color="#EF4444", label=">20 mg/dL")
        ax3.legend(handles=[green, yellow, red], fontsize=8, loc="upper right")
        ax3.set_xlabel("Test point index", fontsize=10)

        plt.tight_layout()
        fname    = Path(csv_path).stem.replace(" ", "_")[:20]
        out_path = OUTPUT_DIR / f"eval_pattern_{fname}.png"
        plt.savefig(out_path, dpi=150, bbox_inches="tight")
        print(f"\n  Plot saved -> {out_path}")
        plt.show()

    except ImportError:
        print("\n  (Install matplotlib for plot: pip install matplotlib)")


if __name__ == "__main__":
    main()
