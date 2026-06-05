"""
Autoencoder Anomaly Detection - Training Script
================================================
Trains an autoencoder on NORMAL transactions only.
Anomaly = high reconstruction error (above 95th-percentile threshold from validation).

Uses tf.GradientTape for custom training loop.
Uses TensorBoard for training visualization.

Input features (11 numeric columns):
  amount_log, category_id, payment_method_id, day_of_week, day_of_month,
  user_avg_amount, category_avg_amount, amount_to_user_avg_ratio,
  amount_to_category_avg_ratio, budget_utilization, monthly_income_ratio

Exports:
  - ml-models/model_autoencoder.keras
  - ml-models/autoencoder_scaler.pkl
  - ml-models/autoencoder_config.json
  - ml-models/tensorboard_logs/autoencoder/
"""
import os
import json
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.preprocessing import StandardScaler
from pathlib import Path
from datetime import datetime

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "synthetic_v2" / "processed" / "dataset_autoencoder_anomaly.csv"
MODELS_DIR = BASE_DIR.parent / "ml-models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
TENSORBOARD_DIR = MODELS_DIR / "tensorboard_logs" / "autoencoder"
TENSORBOARD_DIR.mkdir(parents=True, exist_ok=True)

# ── Feature columns ─────────────────────────────────────────────────────────
FEATURE_COLS = [
    "amount_log",
    "category_id",
    "payment_method_id",
    "day_of_week",
    "day_of_month",
    "user_avg_amount",
    "category_avg_amount",
    "amount_to_user_avg_ratio",
    "amount_to_category_avg_ratio",
    "budget_utilization",
    "monthly_income_ratio",
]

# ── Hyperparameters ──────────────────────────────────────────────────────────
ENCODING_DIM = 32          # bottleneck
HIDDEN_DIMS = [64, 48]     # encoder layers before bottleneck
EPOCHS = 50
BATCH_SIZE = 256
LEARNING_RATE = 1e-3
THRESHOLD_PERCENTILE = 95  # percentile of validation reconstruction error


def build_autoencoder(input_dim: int, encoding_dim: int, hidden_dims: list) -> keras.Model:
    """Build symmetric encoder-decoder autoencoder using Functional API."""
    # ── Encoder ──
    encoder_input = keras.Input(shape=(input_dim,), name="encoder_input")
    x = encoder_input
    for i, dim in enumerate(hidden_dims):
        x = layers.Dense(dim, activation="relu", name=f"encoder_dense_{i}")(x)
        x = layers.BatchNormalization(name=f"encoder_bn_{i}")(x)
    encoded = layers.Dense(encoding_dim, activation="relu", name="bottleneck")(x)

    # ── Decoder ──
    x = encoded
    for i, dim in enumerate(reversed(hidden_dims)):
        x = layers.Dense(dim, activation="relu", name=f"decoder_dense_{i}")(x)
        x = layers.BatchNormalization(name=f"decoder_bn_{i}")(x)
    decoded = layers.Dense(input_dim, activation="linear", name="decoder_output")(x)

    model = keras.Model(encoder_input, decoded, name="autoencoder")
    return model


def custom_train_loop(model, X_train, X_val, epochs, batch_size, learning_rate,
                      tensorboard_dir):
    """
    Custom training loop using tf.GradientTape with TensorBoard logging.
    
    Args:
        model: Keras model (autoencoder)
        X_train: Training data (normal only)
        X_val: Validation data (normal only)
        epochs: Max number of epochs
        batch_size: Batch size
        learning_rate: Learning rate for Adam optimizer
        tensorboard_dir: Path to save TensorBoard logs
    
    Returns:
        history dict with train_loss, val_loss per epoch
    """
    optimizer = keras.optimizers.Adam(learning_rate=learning_rate)
    loss_fn = keras.losses.MeanSquaredError()

    n_samples = len(X_train)
    n_batches = int(np.ceil(n_samples / batch_size))

    # TensorBoard writer
    log_dir = str(tensorboard_dir) + "/" + datetime.now().strftime("%Y%m%d-%H%M%S")
    train_writer = tf.summary.create_file_writer(log_dir + "/train")
    val_writer = tf.summary.create_file_writer(log_dir + "/validation")

    # Metrics tracking
    train_loss_history = []
    val_loss_history = []

    best_val_loss = float("inf")
    best_weights = None
    patience = 8
    patience_counter = 0

    print(f"\nTraining autoencoder with GradientTape (epochs={epochs}, batch_size={batch_size})...")
    print(f"Train samples: {n_samples}, Val samples: {len(X_val)}")
    print(f"TensorBoard log dir: {log_dir}")
    print("-" * 70)

    for epoch in range(epochs):
        # Shuffle training data
        indices = np.random.permutation(n_samples)
        X_shuffled = X_train[indices]

        epoch_losses = []
        for batch_idx in range(n_batches):
            start = batch_idx * batch_size
            end = min(start + batch_size, n_samples)
            X_batch = X_shuffled[start:end]

            with tf.GradientTape() as tape:
                reconstructed = model(X_batch, training=True)
                loss = loss_fn(X_batch, reconstructed)

            gradients = tape.gradient(loss, model.trainable_variables)
            # Clip gradients to prevent explosion
            gradients, _ = tf.clip_by_global_norm(gradients, 1.0)
            optimizer.apply_gradients(zip(gradients, model.trainable_variables))
            epoch_losses.append(float(loss.numpy()))

        # Epoch training loss
        avg_train_loss = np.mean(epoch_losses)
        train_loss_history.append(avg_train_loss)

        # Validation loss
        val_reconstructed = model(X_val, training=False)
        val_loss = float(loss_fn(X_val, val_reconstructed).numpy())
        val_loss_history.append(val_loss)

        # Get current learning rate
        current_lr = float(optimizer.learning_rate.numpy())

        # TensorBoard logging
        with train_writer.as_default():
            tf.summary.scalar("loss", avg_train_loss, step=epoch)
            tf.summary.scalar("learning_rate", current_lr, step=epoch)
        with val_writer.as_default():
            tf.summary.scalar("loss", val_loss, step=epoch)

        # Early stopping check
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_weights = [w.numpy() for w in model.weights]
            patience_counter = 0
            marker = " *"
        else:
            patience_counter += 1
            marker = ""

        if (epoch + 1) % 5 == 0 or epoch == 0 or marker:
            print(
                f"Epoch {epoch+1:3d}/{epochs} | "
                f"Train Loss: {avg_train_loss:.6f} | "
                f"Val Loss: {val_loss:.6f} | "
                f"LR: {current_lr:.2e}{marker}"
            )

        if patience_counter >= patience:
            print(f"\nEarly stopping at epoch {epoch+1} (patience={patience})")
            break

    # Restore best weights
    if best_weights is not None:
        for w, bw in zip(model.weights, best_weights):
            w.assign(bw)
        print(f"\nRestored best weights (val_loss={best_val_loss:.6f})")

    return {
        "train_loss": train_loss_history,
        "val_loss": val_loss_history,
        "best_val_loss": best_val_loss,
        "epochs_trained": len(train_loss_history),
    }


def main():
    # ── 1. Load data ────────────────────────────────────────────────────────
    print("Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    print(f"  Total rows: {len(df)}")
    print(f"  Splits: {df['split'].value_counts().to_dict()}")
    print(f"  Features: {FEATURE_COLS}")
    print(f"  Input dim: {len(FEATURE_COLS)}")

    # Split
    df_train = df[df["split"] == "train"].copy()        # all normal
    df_val = df[df["split"] == "validation"].copy()      # all normal
    df_test = df[df["split"] == "test"].copy()            # has anomalies

    print(f"\n  Train (normal only): {len(df_train)}")
    print(f"  Validation (normal only): {len(df_val)}")
    print(f"  Test (normal + anomaly): {len(df_test)}")
    print(f"  Test anomaly count: {df_test['is_synthetic_anomaly'].sum()}")

    X_train = df_train[FEATURE_COLS].values.astype(np.float32)
    X_val = df_val[FEATURE_COLS].values.astype(np.float32)
    X_test = df_test[FEATURE_COLS].values.astype(np.float32)
    y_test = df_test["is_synthetic_anomaly"].values.astype(int)

    # ── 2. Scale features ───────────────────────────────────────────────────
    print("\nScaling features with StandardScaler (fit on train only)...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train).astype(np.float32)
    X_val_scaled = scaler.transform(X_val).astype(np.float32)
    X_test_scaled = scaler.transform(X_test).astype(np.float32)

    # Save scaler
    scaler_path = MODELS_DIR / "autoencoder_scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"  Scaler saved → {scaler_path}")

    # ── 3. Build model ──────────────────────────────────────────────────────
    input_dim = len(FEATURE_COLS)
    model = build_autoencoder(input_dim, ENCODING_DIM, HIDDEN_DIMS)
    model.summary()

    # ── 4. Train with GradientTape ──────────────────────────────────────────
    history = custom_train_loop(
        model=model,
        X_train=X_train_scaled,
        X_val=X_val_scaled,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        tensorboard_dir=TENSORBOARD_DIR,
    )

    # ── 5. Compute reconstruction errors ────────────────────────────────────
    print("\nComputing reconstruction errors...")

    def recon_error(X):
        """Per-sample MSE reconstruction error."""
        X_pred = model.predict(X, verbose=0)
        return np.mean((X - X_pred) ** 2, axis=1)

    train_errors = recon_error(X_train_scaled)
    val_errors = recon_error(X_val_scaled)
    test_errors = recon_error(X_test_scaled)

    print(f"  Train  — mean: {train_errors.mean():.6f}, std: {train_errors.std():.6f}")
    print(f"  Val    — mean: {val_errors.mean():.6f}, std: {val_errors.std():.6f}")
    print(f"  Test   — mean: {test_errors.mean():.6f}, std: {test_errors.std():.6f}")

    # ── 6. Threshold from validation ────────────────────────────────────────
    threshold = np.percentile(val_errors, THRESHOLD_PERCENTILE)
    print(f"\nThreshold (P{THRESHOLD_PERCENTILE} of val errors): {threshold:.6f}")

    # ── 7. Evaluate on test set ─────────────────────────────────────────────
    y_pred = (test_errors > threshold).astype(int)

    tp = int(np.sum((y_pred == 1) & (y_test == 1)))
    fp = int(np.sum((y_pred == 1) & (y_test == 0)))
    fn = int(np.sum((y_pred == 0) & (y_test == 1)))
    tn = int(np.sum((y_pred == 0) & (y_test == 0)))
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / len(y_test)

    metrics = {
        "threshold": float(threshold),
        "threshold_percentile": THRESHOLD_PERCENTILE,
        "test_total": int(len(y_test)),
        "test_anomaly_count": int(y_test.sum()),
        "test_tp": tp,
        "test_fp": fp,
        "test_fn": fn,
        "test_tn": tn,
        "test_precision": round(precision, 4),
        "test_recall": round(recall, 4),
        "test_f1": round(f1, 4),
        "test_accuracy": round(accuracy, 4),
        "val_recon_error_mean": round(float(val_errors.mean()), 6),
        "val_recon_error_std": round(float(val_errors.std()), 6),
        "train_recon_error_mean": round(float(train_errors.mean()), 6),
        "train_recon_error_std": round(float(train_errors.std()), 6),
    }

    print(f"\n{'='*50}")
    print("TEST SET EVALUATION")
    print(f"{'='*50}")
    print(f"  True Positives:  {tp}")
    print(f"  False Positives: {fp}")
    print(f"  False Negatives: {fn}")
    print(f"  True Negatives:  {tn}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  Accuracy:  {accuracy:.4f}")

    # ── 8. Save artifacts ───────────────────────────────────────────────────
    model_path = MODELS_DIR / "model_autoencoder.keras"
    model.save(str(model_path))
    print(f"\nModel saved → {model_path}")

    config = {
        "model_type": "autoencoder_anomaly",
        "input_dim": input_dim,
        "encoding_dim": ENCODING_DIM,
        "hidden_dims": HIDDEN_DIMS,
        "feature_cols": FEATURE_COLS,
        "threshold": float(threshold),
        "threshold_percentile": THRESHOLD_PERCENTILE,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "metrics": metrics,
        "training_epochs": history["epochs_trained"],
        "best_val_loss": round(float(history["best_val_loss"]), 6),
        "training_method": "tf.GradientTape",
    }

    config_path = MODELS_DIR / "autoencoder_config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"Config saved → {config_path}")

    print(f"\nTensorBoard logs saved → {TENSORBOARD_DIR}")
    print(f"  Run: tensorboard --logdir {TENSORBOARD_DIR}")
    print("\n✅ Autoencoder training complete!")


if __name__ == "__main__":
    main()