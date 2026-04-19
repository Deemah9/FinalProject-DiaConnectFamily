"""
Pre-training script for the glucose prediction LSTM.

Generates synthetic glucose data for 100 virtual patients (30 days each),
trains a base LSTM model, and saves the weights to models/base_model.keras.

Run once from the backend directory:
    python scripts/pretrain_lstm.py

The saved model is then loaded and fine-tuned per patient at prediction time.
"""

import os
import sys
import numpy as np
from pathlib import Path

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

BACKEND_DIR = Path(__file__).parent.parent
MODELS_DIR = BACKEND_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)
MODEL_PATH = str(MODELS_DIR / "base_model.keras")

# Must match prediction_service.py constants
SEQUENCE_LENGTH = 5
N_FEATURES = 5          # glucose, hour, carbs_2h, activity_2h, sleep
GLUCOSE_MIN = 40.0
GLUCOSE_MAX = 400.0

N_PATIENTS = 100
HOURS_PER_PATIENT = 24 * 30   # 30 days per patient → 720 readings
EPOCHS = 60
BATCH_SIZE = 256


# ==========================================
# Synthetic Patient Generator
# ==========================================

def generate_patient(seed: int) -> np.ndarray:
    """
    Simulate one virtual patient for HOURS_PER_PATIENT hours.
    Returns array shape (HOURS_PER_PATIENT, 5):
      [glucose, hour_of_day, carbs_2h, activity_2h, sleep_hours]
    """
    rng = np.random.default_rng(seed)

    # Each virtual patient has slightly different physiology
    base_glucose        = rng.uniform(85, 145)    # fasting baseline
    carb_sensitivity    = rng.uniform(0.4, 1.2)   # mg/dL per gram of carbs
    exercise_effect     = rng.uniform(0.8, 2.0)   # mg/dL per minute of activity
    reversion_rate      = rng.uniform(0.08, 0.20) # how fast glucose reverts to base
    noise_std           = rng.uniform(2.0, 6.0)   # measurement noise

    n = HOURS_PER_PATIENT
    glucose       = np.zeros(n, dtype=np.float32)
    carbs_2h      = np.zeros(n, dtype=np.float32)
    activity_2h   = np.zeros(n, dtype=np.float32)
    sleep_h       = np.full(n, 7.0, dtype=np.float32)

    glucose[0] = base_glucose + rng.normal(0, 5)

    # Meal carbs and timing per day (randomised per patient day)
    for hour in range(1, n):
        h = hour % 24   # hour of day 0-23

        # ── Circadian / dawn phenomenon (peaks ~7am) ──────────────────────
        circadian = 6 * np.sin(2 * np.pi * (h - 5) / 24)

        # ── Meal effect ───────────────────────────────────────────────────
        meal_carbs = 0.0
        if h in [7, 8] and rng.random() < 0.90:            # breakfast
            meal_carbs = rng.uniform(25, 65)
        elif h in [12, 13] and rng.random() < 0.85:        # lunch
            meal_carbs = rng.uniform(40, 90)
        elif h in [18, 19] and rng.random() < 0.90:        # dinner
            meal_carbs = rng.uniform(30, 80)
        elif h in [10, 15] and rng.random() < 0.30:        # snack
            meal_carbs = rng.uniform(10, 30)

        meal_spike = meal_carbs * carb_sensitivity
        carbs_2h[hour] = meal_carbs

        # ── Exercise effect ───────────────────────────────────────────────
        act_min = 0.0
        if h in [6, 7, 16, 17] and rng.random() < 0.25:
            act_min = rng.uniform(20, 60)
        activity_2h[hour] = act_min
        activity_drop = act_min * exercise_effect

        # ── Sleep hours (set once per morning) ───────────────────────────
        if h == 7:
            sleep_h[hour] = rng.uniform(5.0, 9.0)
        else:
            sleep_h[hour] = sleep_h[hour - 1]

        # ── Previous glucose decay toward baseline ────────────────────────
        prev = glucose[hour - 1]
        reversion = reversion_rate * (base_glucose + circadian - prev)

        # ── Combine ───────────────────────────────────────────────────────
        noise = rng.normal(0, noise_std)
        glucose[hour] = prev + reversion + meal_spike - activity_drop + noise
        glucose[hour] = float(np.clip(glucose[hour], GLUCOSE_MIN, GLUCOSE_MAX))

    hours_of_day = (np.arange(n) % 24).astype(np.float32)
    return np.stack([glucose, hours_of_day, carbs_2h, activity_2h, sleep_h], axis=1)


# ==========================================
# Build Training Sequences
# ==========================================

def build_sequences(data: np.ndarray):
    """
    Normalise features and build (X, y) pairs with sliding window.
    Fixed glucose range (GLUCOSE_MIN–GLUCOSE_MAX) matches prediction_service.py.
    """
    g_norm  = (data[:, 0] - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN)
    h_norm  = data[:, 1] / 24.0
    c_norm  = np.clip(data[:, 2] / 150.0, 0.0, 1.0)
    a_norm  = np.clip(data[:, 3] / 120.0, 0.0, 1.0)
    s_norm  = np.clip(data[:, 4] / 12.0,  0.0, 1.0)
    scaled  = np.stack([g_norm, h_norm, c_norm, a_norm, s_norm], axis=1)

    X, y = [], []
    for i in range(len(data) - SEQUENCE_LENGTH):
        X.append(scaled[i : i + SEQUENCE_LENGTH])
        y.append(g_norm[i + SEQUENCE_LENGTH])

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


# ==========================================
# Main
# ==========================================

def main():
    import tensorflow as tf
    tf.random.set_seed(42)
    np.random.seed(42)

    print(f"Generating synthetic data for {N_PATIENTS} virtual patients …")
    all_X, all_y = [], []

    for i in range(N_PATIENTS):
        data   = generate_patient(seed=i)
        X, y   = build_sequences(data)
        all_X.append(X)
        all_y.append(y)
        if (i + 1) % 20 == 0:
            print(f"  {i + 1}/{N_PATIENTS} patients done")

    X_train = np.concatenate(all_X, axis=0)
    y_train = np.concatenate(all_y, axis=0)

    # Shuffle
    idx = np.random.permutation(len(X_train))
    X_train, y_train = X_train[idx], y_train[idx]

    total = len(X_train)
    print(f"\nTotal training samples : {total:,}")
    print(f"Input shape            : {X_train.shape}")

    # ── Model ──────────────────────────────────────────────────────────────
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(64, input_shape=(SEQUENCE_LENGTH, N_FEATURES)),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(1),
    ], name="glucose_lstm")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=["mae"],
    )
    model.summary()

    # ── Train ──────────────────────────────────────────────────────────────
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=8, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=4, min_lr=1e-5
        ),
    ]

    print("\nTraining …")
    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_split=0.1,
        callbacks=callbacks,
        verbose=1,
    )

    # ── Save ───────────────────────────────────────────────────────────────
    model.save(MODEL_PATH)

    final_mae   = history.history["val_mae"][-1]
    mg_dl_error = final_mae * (GLUCOSE_MAX - GLUCOSE_MIN)
    print(f"\n✅  Base model saved → {MODEL_PATH}")
    print(f"    Validation MAE : {final_mae:.4f} ≈ {mg_dl_error:.1f} mg/dL")


if __name__ == "__main__":
    main()
