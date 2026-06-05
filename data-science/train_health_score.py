#!/usr/bin/env python3
"""
Phase 4.5: Dense NN Health Score Training
Dataset: dataset_health_score_user_month.csv
Features: user_segment (embedded), monthly_income, spending_ratio, savings_ratio,
          budget_utilization, has_savings, has_debt, debt_ratio, expense_volatility,
          n_transactions, top_category_ratio
Target: health_score (0-100)
Architecture: Model Subclassing with CategoryEmbeddingMixer custom layer

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
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from datetime import datetime

# Configuration
DATA_PATH = "synthetic_v2/processed/dataset_health_score_user_month.csv"
OUTPUT_DIR = "../ml-models"
MODEL_NAME = "model_health_dense.keras"
METADATA_NAME = "model_health_metadata.json"
SCALER_NAME = "health_scaler.pkl"
LABEL_ENCODER_NAME = "health_label_encoder.pkl"

# Segment categories
SEGMENTS = ["pelajar_mahasiswa", "pekerja_tetap", "freelancer"]

# Numeric features (exclude component scores to avoid leakage)
NUMERIC_FEATURES = [
    "monthly_income", "spending_ratio", "savings_ratio", "budget_utilization",
    "has_savings", "has_debt", "debt_ratio", "expense_volatility",
    "n_transactions", "top_category_ratio"
]

TARGET = "health_score"

# Training hyperparameters
BATCH_SIZE = 32
EPOCHS = 150
LEARNING_RATE = 0.001
VALIDATION_SPLIT = 0.15
RANDOM_SEED = 42


# ============================================================
# Custom Layer: CategoryEmbeddingMixer
# ============================================================
class CategoryEmbeddingMixer(layers.Layer):
    """
    Custom layer that embeds a categorical input (user_segment) and
    mixes it with numeric features via concatenation and a small dense block.
    
    Input: [segment_indices (batch, 1), numeric_features (batch, n_numeric)]
    Output: mixed representation (batch, mixed_dim)
    """
    def __init__(self, n_segments, embed_dim=8, mixed_dim=32, **kwargs):
        super().__init__(**kwargs)
        self.n_segments = n_segments
        self.embed_dim = embed_dim
        self.mixed_dim = mixed_dim

    def build(self, input_shape):
        self.embedding = layers.Embedding(
            input_dim=self.n_segments,
            output_dim=self.embed_dim,
            name="segment_embedding"
        )
        self.mix_dense = layers.Dense(self.mixed_dim, activation="relu", name="mix_dense")
        self.mix_norm = layers.BatchNormalization(name="mix_norm")
        super().build(input_shape)

    def call(self, inputs, training=False):
        segment_input, numeric_input = inputs
        # segment_input: (batch, 1) int indices
        embedded = self.embedding(segment_input)  # (batch, 1, embed_dim)
        embedded = tf.squeeze(embedded, axis=1)    # (batch, embed_dim)
        # Concatenate with numeric features
        combined = tf.concat([embedded, numeric_input], axis=-1)
        mixed = self.mix_dense(combined)
        mixed = self.mix_norm(mixed, training=training)
        return mixed

    def get_config(self):
        config = super().get_config()
        config.update({
            "n_segments": self.n_segments,
            "embed_dim": self.embed_dim,
            "mixed_dim": self.mixed_dim,
        })
        return config


# ============================================================
# Model: HealthScoreDenseModel (Model Subclassing)
# ============================================================
class HealthScoreDenseModel(keras.Model):
    """
    Dense NN for health score prediction.
    Uses CategoryEmbeddingMixer to combine segment embeddings with numeric features.
    Trained with GradientTape for custom training loop.
    """
    def __init__(self, n_segments, n_numeric, **kwargs):
        super().__init__(**kwargs)
        self._n_segments = n_segments
        self._n_numeric = n_numeric
        self.mixer = CategoryEmbeddingMixer(
            n_segments=n_segments,
            embed_dim=8,
            mixed_dim=32,
            name="embedding_mixer"
        )
        # Deep dense tower
        self.dense1 = layers.Dense(64, activation="relu", name="dense_1")
        self.norm1 = layers.BatchNormalization(name="norm_1")
        self.dropout1 = layers.Dropout(0.3, name="drop_1")

        self.dense2 = layers.Dense(32, activation="relu", name="dense_2")
        self.norm2 = layers.BatchNormalization(name="norm_2")
        self.dropout2 = layers.Dropout(0.2, name="drop_2")

        self.dense3 = layers.Dense(16, activation="relu", name="dense_3")
        self.output_layer = layers.Dense(1, activation="linear", name="output")

    def call(self, inputs, training=False):
        segment_input, numeric_input = inputs
        x = self.mixer([segment_input, numeric_input], training=training)
        x = self.dense1(x)
        x = self.norm1(x, training=training)
        x = self.dropout1(x, training=training)
        x = self.dense2(x)
        x = self.norm2(x, training=training)
        x = self.dropout2(x, training=training)
        x = self.dense3(x)
        return self.output_layer(x)

    def get_config(self):
        config = super().get_config()
        config.update({
            "n_segments": self._n_segments,
            "n_numeric": self._n_numeric,
        })
        return config


# ============================================================
# Data Loading & Preprocessing
# ============================================================
def load_and_prepare_data(csv_path):
    """Load dataset, encode segments, scale features, split train/val/test."""
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} samples, columns: {list(df.columns)}")

    # Encode user_segment
    le = LabelEncoder()
    le.fit(SEGMENTS)
    df["segment_encoded"] = le.transform(df["user_segment"])

    # Boolean to int
    df["has_savings"] = df["has_savings"].astype(int)
    df["has_debt"] = df["has_debt"].astype(int)

    # Split based on 'split' column
    train_df = df[df["split"] == "train"].copy()
    val_df = df[df["split"] == "validation"].copy()
    test_df = df[df["split"] == "test"].copy()
    # Exclude demo_holdout from training
    print(f"Split: train={len(train_df)}, val={len(val_df)}, test={len(test_df)}")

    # Scale numeric features
    scaler = StandardScaler()
    train_num = scaler.fit_transform(train_df[NUMERIC_FEATURES])
    val_num = scaler.transform(val_df[NUMERIC_FEATURES])
    test_num = scaler.transform(test_df[NUMERIC_FEATURES])

    # Targets
    y_train = train_df[TARGET].values.astype(np.float32)
    y_val = val_df[TARGET].values.astype(np.float32)
    y_test = test_df[TARGET].values.astype(np.float32)

    # Segment indices
    seg_train = train_df["segment_encoded"].values.astype(np.int32)
    seg_val = val_df["segment_encoded"].values.astype(np.int32)
    seg_test = test_df["segment_encoded"].values.astype(np.int32)

    return {
        "train": (seg_train, train_num, y_train),
        "val": (seg_val, val_num, y_val),
        "test": (seg_test, test_num, y_test),
        "scaler": scaler,
        "label_encoder": le,
        "n_numeric": len(NUMERIC_FEATURES),
    }


# ============================================================
# Custom Training Loop with GradientTape
# ============================================================
def train_model(model, data, epochs=EPOCHS, batch_size=BATCH_SIZE, lr=LEARNING_RATE,
                tensorboard_dir=None):
    """Train using GradientTape with MSE loss, Adam optimizer, and TensorBoard logging."""
    seg_train, num_train, y_train = data["train"]
    seg_val, num_val, y_val = data["val"]

    n_samples = len(y_train)
    n_batches = int(np.ceil(n_samples / batch_size))

    optimizer = keras.optimizers.Adam(learning_rate=lr)
    loss_fn = keras.losses.MeanSquaredError()

    # ── TensorBoard setup ──
    if tensorboard_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        tensorboard_dir = os.path.join(script_dir, OUTPUT_DIR, "tensorboard_logs", "health_score")
    os.makedirs(tensorboard_dir, exist_ok=True)

    log_dir = os.path.join(tensorboard_dir, datetime.now().strftime("%Y%m%d-%H%M%S"))
    train_writer = tf.summary.create_file_writer(log_dir + "/train")
    val_writer = tf.summary.create_file_writer(log_dir + "/validation")

    # Metrics tracking
    train_loss_history = []
    val_loss_history = []
    val_mae_history = []

    best_val_loss = float("inf")
    best_weights = None
    patience = 20
    patience_counter = 0

    print(f"\nTraining for up to {epochs} epochs, {n_batches} batches/epoch, batch_size={batch_size}")
    print(f"Train samples: {n_samples}, Val samples: {len(y_val)}")
    print(f"TensorBoard log dir: {log_dir}")
    print("-" * 70)

    for epoch in range(epochs):
        # Shuffle training data
        indices = np.random.permutation(n_samples)
        seg_shuffled = seg_train[indices]
        num_shuffled = num_train[indices]
        y_shuffled = y_train[indices]

        epoch_losses = []
        for batch_idx in range(n_batches):
            start = batch_idx * batch_size
            end = min(start + batch_size, n_samples)

            seg_batch = seg_shuffled[start:end].reshape(-1, 1)
            num_batch = num_shuffled[start:end]
            y_batch = y_shuffled[start:end]

            with tf.GradientTape() as tape:
                predictions = model([seg_batch, num_batch], training=True)
                predictions = tf.squeeze(predictions, axis=-1)
                loss = loss_fn(y_batch, predictions)

            gradients = tape.gradient(loss, model.trainable_variables)
            gradients, _ = tf.clip_by_global_norm(gradients, 1.0)
            optimizer.apply_gradients(zip(gradients, model.trainable_variables))
            epoch_losses.append(float(loss.numpy()))

        # Epoch training loss
        avg_train_loss = np.mean(epoch_losses)
        train_loss_history.append(avg_train_loss)

        # Validation
        seg_val_input = seg_val.reshape(-1, 1)
        val_pred = model([seg_val_input, num_val], training=False)
        val_pred = tf.squeeze(val_pred, axis=-1).numpy()
        val_loss = float(loss_fn(y_val, val_pred).numpy())
        val_mae = float(mean_absolute_error(y_val, val_pred))
        val_loss_history.append(val_loss)
        val_mae_history.append(val_mae)

        current_lr = float(optimizer.learning_rate.numpy())

        # ── TensorBoard logging ──
        with train_writer.as_default():
            tf.summary.scalar("loss", avg_train_loss, step=epoch)
            tf.summary.scalar("learning_rate", current_lr, step=epoch)
        with val_writer.as_default():
            tf.summary.scalar("loss", val_loss, step=epoch)
            tf.summary.scalar("mae", val_mae, step=epoch)

        # Early stopping check
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_weights = [w.numpy() for w in model.weights]
            patience_counter = 0
            marker = " *"
        else:
            patience_counter += 1
            marker = ""

        if (epoch + 1) % 10 == 0 or epoch == 0 or marker:
            print(
                f"Epoch {epoch+1:3d}/{epochs} | "
                f"Train Loss: {avg_train_loss:.4f} | "
                f"Val Loss: {val_loss:.4f} | "
                f"Val MAE: {val_mae:.2f}{marker}"
            )

        if patience_counter >= patience:
            print(f"\nEarly stopping at epoch {epoch+1} (patience={patience})")
            break

        gc.collect()

    # Restore best weights
    if best_weights is not None:
        for w, bw in zip(model.weights, best_weights):
            w.assign(bw)
        print(f"\nRestored best weights (val_loss={best_val_loss:.4f})")

    print(f"\nTensorBoard logs saved → {tensorboard_dir}")
    print(f"  Run: tensorboard --logdir {tensorboard_dir}")

    return {
        "train_loss": train_loss_history,
        "val_loss": val_loss_history,
        "val_mae": val_mae_history,
        "best_val_loss": best_val_loss,
        "epochs_trained": len(train_loss_history),
    }


# ============================================================
# Evaluation
# ============================================================
def evaluate_model(model, data):
    """Evaluate on test set."""
    seg_test, num_test, y_test = data["test"]
    seg_test_input = seg_test.reshape(-1, 1)

    y_pred = model([seg_test_input, num_test], training=False)
    y_pred = tf.squeeze(y_pred, axis=-1).numpy()

    # Clamp predictions to [0, 100]
    y_pred_clamped = np.clip(y_pred, 0, 100)

    mae = mean_absolute_error(y_test, y_pred_clamped)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred_clamped))
    r2 = r2_score(y_test, y_pred_clamped)

    # Per-segment metrics
    segment_metrics = {}
    le = data["label_encoder"]
    for seg_name in SEGMENTS:
        seg_idx = le.transform([seg_name])[0]
        mask = seg_test == seg_idx
        if mask.sum() > 0:
            seg_mae = mean_absolute_error(y_test[mask], y_pred_clamped[mask])
            seg_r2 = r2_score(y_test[mask], y_pred_clamped[mask])
            segment_metrics[seg_name] = {
                "n_samples": int(mask.sum()),
                "mae": round(float(seg_mae), 4),
                "r2": round(float(seg_r2), 4),
            }

    metrics = {
        "overall": {
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "r2": round(float(r2), 4),
            "n_test_samples": len(y_test),
        },
        "per_segment": segment_metrics,
    }

    print(f"\n{'='*50}")
    print("TEST SET EVALUATION")
    print(f"{'='*50}")
    print(f"MAE:  {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R²:   {r2:.4f}")
    print(f"\nPer-segment breakdown:")
    for seg, m in segment_metrics.items():
        print(f"  {seg:20s}: n={m['n_samples']:4d}, MAE={m['mae']:.4f}, R²={m['r2']:.4f}")

    return metrics, y_pred_clamped


# ============================================================
# Save artifacts
# ============================================================
def save_artifacts(model, scaler, label_encoder, metrics, history, output_dir):
    """Save model, scaler, label encoder, and metadata."""
    os.makedirs(output_dir, exist_ok=True)

    # Save Keras model
    model_path = os.path.join(output_dir, MODEL_NAME)
    model.save(model_path)
    print(f"Model saved to {model_path}")

    # Save scaler
    scaler_path = os.path.join(output_dir, SCALER_NAME)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"Scaler saved to {scaler_path}")

    # Save label encoder
    le_path = os.path.join(output_dir, LABEL_ENCODER_NAME)
    with open(le_path, "wb") as f:
        pickle.dump(label_encoder, f)
    print(f"Label encoder saved to {le_path}")

    # Save metadata
    metadata = {
        "model_type": "DenseNN_HealthScore",
        "numeric_features": NUMERIC_FEATURES,
        "segments": SEGMENTS,
        "n_segments": len(SEGMENTS),
        "n_numeric": len(NUMERIC_FEATURES),
        "embedding_dim": 8,
        "mixed_dim": 32,
        "scaler": "StandardScaler",
        "target_range": [0, 100],
        "metrics": metrics["overall"],
        "per_segment_metrics": metrics["per_segment"],
        "training": {
            "epochs_trained": history["epochs_trained"],
            "best_val_loss": round(history["best_val_loss"], 4),
            "batch_size": BATCH_SIZE,
            "learning_rate": LEARNING_RATE,
            "early_stopping_patience": 20,
        },
    }
    metadata_path = os.path.join(output_dir, METADATA_NAME)
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to {metadata_path}")


# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("DompetCerdas AI — Phase 4.5: Health Score Dense NN Training")
    print("=" * 60)

    # Resolve data path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, DATA_PATH)
    output_dir = os.path.join(script_dir, OUTPUT_DIR)

    # 1. Load data
    data = load_and_prepare_data(csv_path)

    # 2. Build model
    n_segments = len(SEGMENTS)
    n_numeric = data["n_numeric"]
    model = HealthScoreDenseModel(n_segments=n_segments, n_numeric=n_numeric)
    # Build the model by running a dummy forward pass
    dummy_seg = np.array([[0]], dtype=np.int32)
    dummy_num = np.zeros((1, n_numeric), dtype=np.float32)
    _ = model([dummy_seg, dummy_num], training=False)
    model.summary()

    # 3. Train
    history = train_model(model, data)

    # 4. Evaluate
    metrics, y_pred = evaluate_model(model, data)

    # 5. Save
    save_artifacts(model, data["scaler"], data["label_encoder"], metrics, history, output_dir)

    print("\n✅ Phase 4.5 training complete!")
    print(f"   Model: {MODEL_NAME}")
    print(f"   MAE: {metrics['overall']['mae']:.4f}")
    print(f"   R²: {metrics['overall']['r2']:.4f}")