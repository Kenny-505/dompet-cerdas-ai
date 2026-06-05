#!/usr/bin/env python3
"""
Phase 4.3: LSTM Model Training for Spending Prediction
Dataset: dataset_lstm_monthly_spending.csv
Input: 3 months spending history (54 features → reshaped to 3 timesteps × 18)
Output: Next month spending prediction (18 features)

Memory-safe: Sets OpenBLAS/TF thread limits to avoid Windows memory conflicts.
"""

# ============================================================
# MEMORY-SAFE THREAD CONFIG — MUST BE BEFORE ANY IMPORTS
# ============================================================
import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["TF_NUM_INTEROP_THREADS"] = "1"
os.environ["TF_NUM_INTRAOP_THREADS"] = "2"

import sys
import gc
import json
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import mean_absolute_error, mean_squared_error
from datetime import datetime

# Configuration
DATA_PATH = "synthetic_v2/processed/dataset_lstm_monthly_spending.csv"
OUTPUT_DIR = "../ml-models"
MODEL_NAME = "model_spending_lstm.keras"
SCALER_NAME = "spending_minmax_scaler.pkl"

# Categories (9 spending categories)
CATEGORIES = [
    "makanan", "transportasi", "belanja", "tagihan",
    "hiburan", "kesehatan", "pendidikan", "kos_sewa", "lainnya"
]

# Features per category (amount + income_ratio)
FEATURES_PER_CAT = 2
N_CATEGORIES = len(CATEGORIES)  # 9
TIMESTEPS = 3
FEATURES_PER_TIMESTEP = N_CATEGORIES * FEATURES_PER_CAT  # 18
INPUT_DIM = TIMESTEPS * FEATURES_PER_TIMESTEP  # 54
OUTPUT_DIM = N_CATEGORIES * FEATURES_PER_CAT  # 18


def load_data(csv_path):
    """Load and prepare LSTM dataset."""
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} samples")

    input_cols = [c for c in df.columns if c.startswith(('input_m1_', 'input_m2_', 'input_m3_'))]
    # Exclude target_month (string) — only keep numeric target columns
    target_cols = [c for c in df.columns if c.startswith('target_') and c != 'target_month']

    print(f"Input features: {len(input_cols)}")
    print(f"Target features: {len(target_cols)}")

    # Split by 'split' column
    train_df = df[df['split'] == 'train']
    val_df = df[df['split'] == 'validation']
    test_df = df[df['split'] == 'test']

    print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

    X_train = train_df[input_cols].values.astype(np.float32)
    y_train = train_df[target_cols].values.astype(np.float32)
    X_val = val_df[input_cols].values.astype(np.float32)
    y_val = val_df[target_cols].values.astype(np.float32)
    X_test = test_df[input_cols].values.astype(np.float32)
    y_test = test_df[target_cols].values.astype(np.float32)

    return X_train, y_train, X_val, y_val, X_test, y_test, input_cols, target_cols


def reshape_for_lstm(X, timesteps=TIMESTEPS, n_features=FEATURES_PER_TIMESTEP):
    """
    Reshape input for LSTM: (samples, timesteps, features_per_timestep)
    Original: 54 features (3 months × 9 categories × 2)
    Reshaped: (samples, 3, 18)
    """
    n_samples = X.shape[0]
    X_reshaped = X.reshape(n_samples, timesteps, n_features).astype(np.float32)
    return X_reshaped


class AsymmetricMSE(keras.losses.Loss):
    """
    Custom loss function that penalizes overspending predictions more.
    If prediction > actual (overspending), apply higher penalty.
    """
    def __init__(self, overspend_penalty=2.0, name="asymmetric_mse"):
        super().__init__(name=name)
        self.overspend_penalty = overspend_penalty

    def call(self, y_true, y_pred):
        error = y_pred - y_true
        overspend_mask = tf.cast(error > 0, tf.float32)
        underspend_mask = tf.cast(error <= 0, tf.float32)
        overspend_loss = tf.square(error) * overspend_mask * self.overspend_penalty
        underspend_loss = tf.square(error) * underspend_mask
        return tf.reduce_mean(overspend_loss + underspend_loss)


def build_lstm_model(input_shape, output_dim):
    """
    Build LSTM model architecture.
    Input shape: (timesteps=3, features=18)
    Output: 18 features (9 categories × 2)
    """
    model = keras.Sequential([
        layers.Input(shape=input_shape),
        layers.LSTM(64, return_sequences=True, dropout=0.2),
        layers.LSTM(32, dropout=0.2),
        layers.Dense(32, activation='relu'),
        layers.Dropout(0.2),
        layers.Dense(16, activation='relu'),
        layers.Dense(output_dim, activation='linear')
    ])
    return model


def train_model(X_train, y_train, X_val, y_val):
    """Train LSTM model with memory-safe settings."""
    print("\n" + "=" * 50)
    print("Building LSTM Model")
    print("=" * 50)

    input_shape = (X_train.shape[1], X_train.shape[2])  # (3, 18)
    output_dim = y_train.shape[1]  # 18

    print(f"Input shape: {input_shape}")
    print(f"Output dim: {output_dim}")

    model = build_lstm_model(input_shape, output_dim)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss=AsymmetricMSE(overspend_penalty=2.0),
        metrics=['mae', 'mse']
    )

    model.summary()

    # TensorBoard log directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tensorboard_dir = os.path.join(script_dir, OUTPUT_DIR, "tensorboard_logs", "lstm_spending")
    os.makedirs(tensorboard_dir, exist_ok=True)
    log_dir = os.path.join(tensorboard_dir, datetime.now().strftime("%Y%m%d-%H%M%S"))

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6
        ),
        keras.callbacks.TensorBoard(
            log_dir=log_dir,
            histogram_freq=1,
            write_graph=True,
            update_freq='epoch'
        )
    ]

    print("\n" + "=" * 50)
    print("Training Model (memory-safe: batch_size=16)")
    print(f"TensorBoard log dir: {log_dir}")
    print("=" * 50)

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=16,
        callbacks=callbacks,
        verbose=1
    )

    return model, history


def evaluate_model(model, X_test, y_test, target_cols):
    """Evaluate model performance."""
    print("\n" + "=" * 50)
    print("Model Evaluation")
    print("=" * 50)

    y_pred = model.predict(X_test, verbose=0)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"Overall MAE: {mae:.4f}")
    print(f"Overall RMSE: {rmse:.4f}")

    # Per-category metrics (amount columns only, every other feature)
    print("\nPer-category MAE (amount):")
    for i, cat in enumerate(CATEGORIES):
        col_idx = i * 2  # amount columns are at even indices
        if col_idx < y_pred.shape[1]:
            cat_mae = mean_absolute_error(y_test[:, col_idx], y_pred[:, col_idx])
            print(f"  {cat}: {cat_mae:.2f}")

    return {'mae': float(mae), 'rmse': float(rmse)}


def save_model_and_artifacts(model, output_dir, model_name, scaler_name, metrics):
    """Save model, scaler info, and metadata."""
    print("\n" + "=" * 50)
    print("Saving Model and Artifacts")
    print("=" * 50)

    os.makedirs(output_dir, exist_ok=True)

    # Save model
    model_path = os.path.join(output_dir, model_name)
    model.save(model_path)
    print(f"Model saved to {model_path}")

    # Save scaler info (data uses pre-normalized income ratios)
    scaler_info = {
        'n_categories': N_CATEGORIES,
        'features_per_category': FEATURES_PER_CAT,
        'timesteps': TIMESTEPS,
        'categories': CATEGORIES,
        'note': 'Amount features are raw IDR values; income ratios are pre-normalized. Use log1p transform for amount inference.'
    }

    scaler_path = os.path.join(output_dir, scaler_name)
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler_info, f)
    print(f"Scaler info saved to {scaler_path}")

    # Save model metadata
    metadata = {
        'model_type': 'LSTM',
        'input_shape': [TIMESTEPS, FEATURES_PER_TIMESTEP],
        'output_dim': OUTPUT_DIM,
        'loss': 'AsymmetricMSE',
        'categories': CATEGORIES,
        'n_categories': N_CATEGORIES,
        'features_per_category': FEATURES_PER_CAT,
        'timesteps': TIMESTEPS,
        'metrics': metrics
    }

    metadata_path = os.path.join(output_dir, 'model_lstm_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to {metadata_path}")


def main():
    """Main training pipeline."""
    print("=" * 50)
    print("Phase 4.3: LSTM Spending Prediction Model")
    print("Memory-safe mode: OpenBLAS threads=1, TF interop=1, intraop=2")
    print("=" * 50)

    # Verify TF config
    print(f"TensorFlow version: {tf.__version__}")
    print(f"Available GPUs: {len(tf.config.list_physical_devices('GPU'))}")

    if not os.path.exists(DATA_PATH):
        print(f"Error: Data file not found at {DATA_PATH}")
        sys.exit(1)

    # Load data
    X_train, y_train, X_val, y_val, X_test, y_test, input_cols, target_cols = load_data(DATA_PATH)

    # Reshape for LSTM
    X_train_lstm = reshape_for_lstm(X_train)
    X_val_lstm = reshape_for_lstm(X_val)
    X_test_lstm = reshape_for_lstm(X_test)

    # Free raw arrays
    del X_train, X_val, X_test
    gc.collect()

    print(f"\nReshaped input shapes:")
    print(f"  X_train: {X_train_lstm.shape}")
    print(f"  X_val: {X_val_lstm.shape}")
    print(f"  X_test: {X_test_lstm.shape}")

    # Train model
    model, history = train_model(X_train_lstm, y_train, X_val_lstm, y_val)

    # Evaluate
    metrics = evaluate_model(model, X_test_lstm, y_test, target_cols)

    # Force GC before saving
    gc.collect()

    # Save
    save_model_and_artifacts(model, OUTPUT_DIR, MODEL_NAME, SCALER_NAME, metrics)

    print("\n" + "=" * 50)
    print("Training Complete!")
    print("=" * 50)
    print(f"Model: {os.path.join(OUTPUT_DIR, MODEL_NAME)}")
    print(f"Metrics - MAE: {metrics['mae']:.4f}, RMSE: {metrics['rmse']:.4f}")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    tensorboard_dir = os.path.join(script_dir, OUTPUT_DIR, "tensorboard_logs", "lstm_spending")
    print(f"\nTensorBoard logs saved → {tensorboard_dir}")
    print(f"  Run: tensorboard --logdir {tensorboard_dir}")

    print("\n✅ LSTM training complete!")


if __name__ == "__main__":
    main()