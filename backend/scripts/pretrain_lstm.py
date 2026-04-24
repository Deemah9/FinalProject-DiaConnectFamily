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
SEQUENCE_LENGTH = 12
N_FEATURES = 6          # glucose, hour, carbs_30min, carbs_2h, activity_2h, sleep
GLUCOSE_MIN = 40.0
GLUCOSE_MAX = 600.0

N_PATIENTS = 100
STEPS_PER_PATIENT = 24 * 30 * 2   # 30 days × 24h × 2 → reading every 30 min = 1440 steps
EPOCHS = 60
BATCH_SIZE = 256


# ==========================================
# Synthetic Patient Generator
# ==========================================

def generate_patient(seed: int) -> np.ndarray:
    """
    Simulate one virtual patient at 30-minute resolution for STEPS_PER_PATIENT steps.
    Returns array shape (STEPS_PER_PATIENT, 5):
      [glucose, hour_of_day, carbs_2h, activity_2h, sleep_hours]

    Using 30-min steps matches the real patient reading frequency so the
    frozen LSTM learns temporal patterns at the correct time scale.
    """
    rng = np.random.default_rng(seed)

    # Each virtual patient has slightly different physiology
    base_glucose        = rng.uniform(85, 400)    # fasting baseline — covers normal to severe hyperglycemia
    carb_sensitivity    = rng.uniform(0.3, 0.9)   # mg/dL per gram (per 30-min step)
    exercise_effect     = rng.uniform(0.4, 1.0)   # mg/dL per activity minute (per 30-min step)
    reversion_rate      = rng.uniform(0.04, 0.10) # per 30-min step (half of hourly rate)
    noise_std           = rng.uniform(1.5, 4.0)   # smaller per step at 30-min resolution

    n = STEPS_PER_PATIENT
    glucose      = np.zeros(n, dtype=np.float32)
    meal_at_step = np.zeros(n, dtype=np.float32)  # carbs eaten at each 30-min step
    activity_2h  = np.zeros(n, dtype=np.float32)
    sleep_h      = np.full(n, 7.0, dtype=np.float32)

    glucose[0] = base_glucose + rng.normal(0, 5)

    for step in range(1, n):
        # hour_of_day as float (0.0–23.5 in 0.5 increments)
        h_float = (step % 48) * 0.5      # 0.0, 0.5, 1.0 … 23.5

        # ── Circadian / dawn phenomenon (peaks ~7am) ──────────────────────
        circadian = 6 * np.sin(2 * np.pi * (h_float - 5) / 24)

        # ── Meal effect (one spike per meal window, 30-min slot) ──────────
        meal_carbs = 0.0
        slot = step % 48   # 30-min slot within the day (0–47)
        if slot in [14, 15] and rng.random() < 0.90:       # 7:00–8:00 breakfast
            meal_carbs = rng.uniform(25, 65)
        elif slot in [24, 25] and rng.random() < 0.85:     # 12:00–12:30 lunch
            meal_carbs = rng.uniform(40, 90)
        elif slot in [36, 37] and rng.random() < 0.90:     # 18:00–18:30 dinner
            meal_carbs = rng.uniform(30, 80)
        elif slot in [20, 30] and rng.random() < 0.30:     # 10:00 / 15:00 snack
            meal_carbs = rng.uniform(10, 30)

        meal_spike       = meal_carbs * carb_sensitivity
        meal_at_step[step] = meal_carbs

        # ── Exercise effect ───────────────────────────────────────────────
        act_min = 0.0
        if slot in [12, 13, 32, 33] and rng.random() < 0.25:   # 6–7 am / 4–5 pm
            act_min = rng.uniform(20, 60)
        activity_2h[step] = act_min
        activity_drop = act_min * exercise_effect

        # ── Sleep hours (set once per morning at 7:00) ───────────────────
        if slot == 14:
            sleep_h[step] = rng.uniform(5.0, 9.0)
        else:
            sleep_h[step] = sleep_h[step - 1]

        # ── Previous glucose decay toward baseline ────────────────────────
        prev      = glucose[step - 1]
        reversion = reversion_rate * (base_glucose + circadian - prev)

        # ── Combine ───────────────────────────────────────────────────────
        noise          = rng.normal(0, noise_std)
        glucose[step]  = prev + reversion + meal_spike - activity_drop + noise
        glucose[step]  = float(np.clip(glucose[step], GLUCOSE_MIN, GLUCOSE_MAX))

    # ── Split carbs into two time windows ────────────────────────────────
    # carbs_30min: meal eaten at this exact 30-min step (still absorbing → glucose rising)
    # carbs_2h:    sum of meals eaten 30 min–2 h ago (absorption mostly done)
    carbs_30min = meal_at_step.copy()
    carbs_2h    = np.zeros(n, dtype=np.float32)
    for i in range(1, n):
        carbs_2h[i] = meal_at_step[max(0, i - 4):i].sum()   # steps 1–4 back = 30–120 min ago

    # hour_of_day stored as float 0.0–23.5 matching real patient timestamps
    hours_of_day = ((np.arange(n) % 48) * 0.5).astype(np.float32)
    return np.stack([glucose, hours_of_day, carbs_30min, carbs_2h, activity_2h, sleep_h], axis=1)


# ==========================================
# Build Training Sequences
# ==========================================

def build_sequences(data: np.ndarray):
    """
    Normalise features and build (X, y) pairs with sliding window.
    Fixed glucose range (GLUCOSE_MIN–GLUCOSE_MAX) matches prediction_service.py.
    """
    g_norm   = (data[:, 0] - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN)
    h_norm   = data[:, 1] / 24.0
    c30_norm = np.clip(data[:, 2] / 100.0, 0.0, 1.0)   # carbs_30min
    c2h_norm = np.clip(data[:, 3] / 150.0, 0.0, 1.0)   # carbs_2h
    a_norm   = np.clip(data[:, 4] / 120.0, 0.0, 1.0)
    s_norm   = np.clip(data[:, 5] / 12.0,  0.0, 1.0)
    scaled   = np.stack([g_norm, h_norm, c30_norm, c2h_norm, a_norm, s_norm], axis=1)

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
            print(f"  {i + 1}/{N_PATIENTS} patients done  (steps each: {STEPS_PER_PATIENT})")

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
