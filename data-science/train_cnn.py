"""
CNN Category Classification - Training Script
==============================================
Classifies transactions into 9 categories based on description text + numeric features.
Uses CNN 1D with text embedding (Functional API architecture).

Uses tf.GradientTape for custom training loop.
Uses TensorBoard for training visualization.

Exports:
  - ml-models/model_category_cnn.keras
  - ml-models/category_tokenizer.pkl
  - ml-models/label_encoder.pkl
  - ml-models/cnn_metrics.json
  - ml-models/tensorboard_logs/cnn_category/
"""
import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import json
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv1D, GlobalMaxPooling1D, Dense,
    Concatenate, Dropout, BatchNormalization
)
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from datetime import datetime
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "synthetic_v2" / "processed" / "dataset_cnn_category.csv"
MODEL_DIR = BASE_DIR.parent / "ml-models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
TENSORBOARD_DIR = MODEL_DIR / "tensorboard_logs" / "cnn_category"
TENSORBOARD_DIR.mkdir(parents=True, exist_ok=True)

# ── Hyperparameters ──────────────────────────────────────────────────────────
MAX_VOCAB = 5000
MAX_LEN = 20
BATCH_SIZE = 64
EPOCHS = 15
LEARNING_RATE = 1e-3


def build_cnn_model(max_vocab, max_len, num_classes):
    """Build CNN 1D model using Functional API."""
    # Text branch
    text_input = Input(shape=(MAX_LEN,), name='text_input')
    embed = Embedding(input_dim=max_vocab, output_dim=64)(text_input)
    conv1 = Conv1D(filters=64, kernel_size=3, activation='relu')(embed)
    conv2 = Conv1D(filters=128, kernel_size=3, activation='relu')(conv1)
    pool = GlobalMaxPooling1D()(conv2)

    # Numeric branch
    numeric_input = Input(shape=(2,), name='numeric_input')
    dense_num = Dense(16, activation='relu')(numeric_input)

    # Merge
    concat = Concatenate()([pool, dense_num])
    bn = BatchNormalization()(concat)
    dropout1 = Dropout(0.3)(bn)
    dense1 = Dense(64, activation='relu')(dropout1)
    dropout2 = Dropout(0.2)(dense1)
    output = Dense(num_classes, activation='softmax', name='output')(dropout2)

    model = Model(inputs=[text_input, numeric_input], outputs=output)
    return model


def custom_train_loop(model, X_train_text, X_train_num, y_train,
                      X_val_text, X_val_num, y_val,
                      epochs, batch_size, learning_rate, tensorboard_dir,
                      class_weight=None):
    """
    Custom training loop using tf.GradientTape with TensorBoard logging.
    
    Args:
        model: Keras CNN model
        X_train_text, X_train_num: Training inputs
        y_train: Training labels (sparse integer)
        X_val_text, X_val_num: Validation inputs
        y_val: Validation labels
        epochs: Max number of epochs
        batch_size: Batch size
        learning_rate: Learning rate for Adam optimizer
        tensorboard_dir: Path to save TensorBoard logs
        class_weight: Optional dict of class weights {class_idx: weight}
    
    Returns:
        history dict
    """
    optimizer = tf.keras.optimizers.Adam(learning_rate=learning_rate)
    loss_fn = tf.keras.losses.SparseCategoricalCrossentropy()

    n_samples = len(y_train)
    n_batches = int(np.ceil(n_samples / batch_size))

    # Prepare class weight tensor if provided
    if class_weight:
        sample_weights = np.array([class_weight.get(int(y), 1.0) for y in y_train],
                                  dtype=np.float32)
    else:
        sample_weights = np.ones(len(y_train), dtype=np.float32)

    # TensorBoard writer
    log_dir = str(tensorboard_dir) + "/" + datetime.now().strftime("%Y%m%d-%H%M%S")
    train_writer = tf.summary.create_file_writer(log_dir + "/train")
    val_writer = tf.summary.create_file_writer(log_dir + "/validation")

    # Metrics tracking
    train_loss_history = []
    val_loss_history = []
    val_accuracy_history = []

    best_val_loss = float("inf")
    best_weights = None
    patience = 5
    patience_counter = 0

    print(f"\nTraining CNN with GradientTape (epochs={epochs}, batch_size={batch_size})...")
    print(f"Train samples: {n_samples}, Val samples: {len(y_val)}")
    print(f"TensorBoard log dir: {log_dir}")
    print("-" * 70)

    for epoch in range(epochs):
        # Shuffle training data
        indices = np.random.permutation(n_samples)
        X_train_text_shuffled = X_train_text[indices]
        X_train_num_shuffled = X_train_num[indices]
        y_train_shuffled = y_train[indices]
        weights_shuffled = sample_weights[indices]

        epoch_losses = []
        epoch_correct = 0
        epoch_total = 0

        for batch_idx in range(n_batches):
            start = batch_idx * batch_size
            end = min(start + batch_size, n_samples)

            text_batch = X_train_text_shuffled[start:end]
            num_batch = X_train_num_shuffled[start:end]
            y_batch = y_train_shuffled[start:end]
            w_batch = weights_shuffled[start:end]

            with tf.GradientTape() as tape:
                predictions = model([text_batch, num_batch], training=True)
                # Weighted loss
                per_sample_loss = loss_fn(y_batch, predictions)
                loss = tf.reduce_mean(per_sample_loss * w_batch)

            gradients = tape.gradient(loss, model.trainable_variables)
            gradients, _ = tf.clip_by_global_norm(gradients, 1.0)
            optimizer.apply_gradients(zip(gradients, model.trainable_variables))

            epoch_losses.append(float(loss.numpy()))
            pred_classes = np.argmax(predictions.numpy(), axis=1)
            epoch_correct += np.sum(pred_classes == y_batch)
            epoch_total += len(y_batch)

        # Epoch metrics
        avg_train_loss = np.mean(epoch_losses)
        train_accuracy = epoch_correct / epoch_total if epoch_total > 0 else 0.0
        train_loss_history.append(avg_train_loss)

        # Validation
        val_predictions = model([X_val_text, X_val_num], training=False)
        val_loss = float(tf.reduce_mean(loss_fn(y_val, val_predictions)).numpy())
        val_pred_classes = np.argmax(val_predictions.numpy(), axis=1)
        val_accuracy = float(np.mean(val_pred_classes == y_val))
        val_loss_history.append(val_loss)
        val_accuracy_history.append(val_accuracy)

        current_lr = float(optimizer.learning_rate.numpy())

        # TensorBoard logging
        with train_writer.as_default():
            tf.summary.scalar("loss", avg_train_loss, step=epoch)
            tf.summary.scalar("accuracy", train_accuracy, step=epoch)
            tf.summary.scalar("learning_rate", current_lr, step=epoch)
        with val_writer.as_default():
            tf.summary.scalar("loss", val_loss, step=epoch)
            tf.summary.scalar("accuracy", val_accuracy, step=epoch)

        # Early stopping check
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_weights = [w.numpy() for w in model.weights]
            patience_counter = 0
            marker = " *"
        else:
            patience_counter += 1
            marker = ""

        print(
            f"Epoch {epoch+1:3d}/{epochs} | "
            f"Train Loss: {avg_train_loss:.4f} Acc: {train_accuracy:.4f} | "
            f"Val Loss: {val_loss:.4f} Acc: {val_accuracy:.4f} | "
            f"LR: {current_lr:.2e}{marker}"
        )

        if patience_counter >= patience:
            print(f"\nEarly stopping at epoch {epoch+1} (patience={patience})")
            break

    # Restore best weights
    if best_weights is not None:
        for w, bw in zip(model.weights, best_weights):
            w.assign(bw)
        print(f"\nRestored best weights (val_loss={best_val_loss:.4f})")

    return {
        "train_loss": train_loss_history,
        "val_loss": val_loss_history,
        "val_accuracy": val_accuracy_history,
        "best_val_loss": best_val_loss,
        "epochs_trained": len(train_loss_history),
    }


def main():
    print("=" * 60)
    print("CNN Category Classification — GradientTape Training")
    print("=" * 60)

    # 1. Load Data
    df = pd.read_csv(str(DATA_PATH))
    df = df[df['split'] != 'demo_holdout'].copy()
    df['is_expense'] = (df['transaction_type'] == 'pengeluaran').astype(float)
    df['clean_description'] = df['clean_description'].fillna('')

    # 2. Split dataset
    train_df, temp_df = train_test_split(df, test_size=0.3, random_state=42, stratify=df['category'])
    val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42, stratify=temp_df['category'])
    print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

    # 3. Label Encoding
    le = LabelEncoder()
    y_train = le.fit_transform(train_df['category'])
    y_val = le.transform(val_df['category'])
    y_test = le.transform(test_df['category'])
    num_classes = len(le.classes_)
    print(f"Classes: {num_classes} — {list(le.classes_)}")

    # 4. Text Preprocessing
    tokenizer = Tokenizer(num_words=MAX_VOCAB, oov_token='<OOV>')
    tokenizer.fit_on_texts(train_df['clean_description'])

    X_train_text = pad_sequences(tokenizer.texts_to_sequences(train_df['clean_description']),
                                 maxlen=MAX_LEN, padding='post')
    X_val_text = pad_sequences(tokenizer.texts_to_sequences(val_df['clean_description']),
                               maxlen=MAX_LEN, padding='post')
    X_test_text = pad_sequences(tokenizer.texts_to_sequences(test_df['clean_description']),
                                maxlen=MAX_LEN, padding='post')

    # Numeric features
    X_train_num = train_df[['amount_scaled_log', 'is_expense']].values.astype(np.float32)
    X_val_num = val_df[['amount_scaled_log', 'is_expense']].values.astype(np.float32)
    X_test_num = test_df[['amount_scaled_log', 'is_expense']].values.astype(np.float32)

    # 5. Build model
    model = build_cnn_model(MAX_VOCAB, MAX_LEN, num_classes)
    model.summary()

    # 6. Extract class weights if available
    weights_dict = None
    if 'class_weight' in df.columns:
        cat_weights = df.groupby('category')['class_weight'].first().to_dict()
        weights_dict = {le.transform([k])[0]: v for k, v in cat_weights.items()}
        print(f"Using class weights: {weights_dict}")

    # 7. Train with GradientTape
    history = custom_train_loop(
        model=model,
        X_train_text=X_train_text,
        X_train_num=X_train_num,
        y_train=y_train,
        X_val_text=X_val_text,
        X_val_num=X_val_num,
        y_val=y_val,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        tensorboard_dir=TENSORBOARD_DIR,
        class_weight=weights_dict,
    )

    # 8. Evaluate on Test Set
    print("\n--- Evaluating on Test Set ---")
    y_pred_probs = model.predict([X_test_text, X_test_num], verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)

    test_loss_fn = tf.keras.losses.SparseCategoricalCrossentropy()
    test_loss = float(test_loss_fn(y_test, y_pred_probs).numpy())
    test_accuracy = float(np.mean(y_pred == y_test))

    print(f"Test Loss: {test_loss:.4f}")
    print(f"Test Accuracy: {test_accuracy:.4f}")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    # 9. Save artifacts
    model_path = MODEL_DIR / 'model_category_cnn.keras'
    model.save(str(model_path))
    print(f"\nModel saved → {model_path}")

    tokenizer_path = MODEL_DIR / 'category_tokenizer.pkl'
    with open(tokenizer_path, 'wb') as f:
        pickle.dump(tokenizer, f)
    print(f"Tokenizer saved → {tokenizer_path}")

    le_path = MODEL_DIR / 'label_encoder.pkl'
    with open(le_path, 'wb') as f:
        pickle.dump(le, f)
    print(f"Label Encoder saved → {le_path}")

    metrics = {
        'test_accuracy': round(test_accuracy, 4),
        'test_loss': round(test_loss, 4),
        'training_method': 'tf.GradientTape',
        'epochs_trained': history['epochs_trained'],
    }
    metrics_path = MODEL_DIR / 'cnn_metrics.json'
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics saved → {metrics_path}")

    print(f"\nTensorBoard logs saved → {TENSORBOARD_DIR}")
    print(f"  Run: tensorboard --logdir {TENSORBOARD_DIR}")
    print("\n✅ CNN training complete!")


if __name__ == "__main__":
    main()