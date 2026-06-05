"""
DompetCerdas AI — Inference Demo Script
========================================
Standalone script to demonstrate model inference for all 4 models.
Loads .keras models and runs sample predictions.

Run from: dompet-cerdas-ai/ml-models/
  python inference_demo.py

Or from project root:
  python dompet-cerdas-ai/ml-models/inference_demo.py
"""
import os
import sys
import json
import pickle
import numpy as np
import tensorflow as tf
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
MODELS_DIR = SCRIPT_DIR

print("=" * 60)
print("DompetCerdas AI — Inference Demo")
print("=" * 60)
print(f"TensorFlow version: {tf.__version__}")
print(f"Models directory: {MODELS_DIR}")
print()


# ============================================================
# 1. CNN Category Prediction
# ============================================================
def demo_cnn_category():
    """Demo CNN model: predict transaction category from description + amount."""
    print("=" * 50)
    print("1. CNN Category Prediction")
    print("=" * 50)

    model_path = MODELS_DIR / "model_category_cnn.keras"
    tokenizer_path = MODELS_DIR / "category_tokenizer.pkl"
    le_path = MODELS_DIR / "label_encoder.pkl"

    if not model_path.exists():
        print("  ❌ Model not found, skipping.\n")
        return

    # Load model and preprocessors
    model = tf.keras.models.load_model(str(model_path))
    with open(tokenizer_path, 'rb') as f:
        tokenizer = pickle.load(f)
    with open(le_path, 'rb') as f:
        label_encoder = pickle.load(f)

    # Sample inputs
    samples = [
        {"description": "makan siang di restoran padang", "amount": 50000, "type": "pengeluaran"},
        {"description": "beli tiket bus ke kampus", "amount": 15000, "type": "pengeluaran"},
        {"description": "bayar tagihan listrik bulanan", "amount": 350000, "type": "pengeluaran"},
        {"description": "beli obat di apotek", "amount": 75000, "type": "pengeluaran"},
    ]

    from tensorflow.keras.preprocessing.sequence import pad_sequences

    for sample in samples:
        # Preprocess
        seq = tokenizer.texts_to_sequences([sample["description"]])
        text_input = pad_sequences(seq, maxlen=20, padding='post')
        amount_norm = np.log1p(sample["amount"]) / 20.0
        amount_norm = np.clip(amount_norm, 0, 1)
        type_encoded = 0 if sample["type"] == "pengeluaran" else 1
        numeric_input = np.array([[amount_norm, type_encoded]], dtype=np.float32)

        # Predict
        predictions = model.predict([text_input, numeric_input], verbose=0)
        predicted_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_idx])
        category = label_encoder.inverse_transform([predicted_idx])[0]

        # Top 3
        top3_idx = np.argsort(predictions[0])[-3:][::-1]
        top3 = [(label_encoder.inverse_transform([i])[0], f"{predictions[0][i]:.4f}") for i in top3_idx]

        print(f"  📝 '{sample['description']}' (Rp{sample['amount']:,})")
        print(f"     → {category} ({confidence:.2%}) | Top 3: {top3}")

    # Print metrics
    metrics_path = MODELS_DIR / "cnn_metrics.json"
    if metrics_path.exists():
        with open(metrics_path) as f:
            metrics = json.load(f)
        print(f"  📊 Test Accuracy: {metrics.get('test_accuracy', 'N/A')}")
    print()


# ============================================================
# 2. LSTM Spending Forecast
# ============================================================
def demo_lstm_forecast():
    """Demo LSTM model: forecast next-month spending across 9 categories."""
    print("=" * 50)
    print("2. LSTM Spending Forecast")
    print("=" * 50)

    model_path = MODELS_DIR / "model_spending_lstm.keras"
    metadata_path = MODELS_DIR / "model_lstm_metadata.json"

    if not model_path.exists():
        print("  ❌ Model not found, skipping.\n")
        return

    model = tf.keras.models.load_model(str(model_path), compile=False)

    with open(metadata_path) as f:
        metadata = json.load(f)

    categories = metadata.get("categories", [
        "makanan", "transportasi", "belanja", "tagihan",
        "hiburan", "kesehatan", "pendidikan", "kos_sewa", "lainnya"
    ])

    normalization = metadata.get("normalization", {})
    uses_sigmoid = normalization.get("output_activation") == "sigmoid"

    # Sample: 3 months of spending data (18 features per month)
    # Format per category: [amount, income_ratio]
    # Using log1p-normalized amounts if sigmoid output
    monthly_data = np.array([
        # Month 1
        [500000, 0.15, 200000, 0.06, 300000, 0.09, 150000, 0.05,
         100000, 0.03, 50000, 0.015, 0, 0.0, 800000, 0.24, 50000, 0.015],
        # Month 2
        [550000, 0.16, 180000, 0.05, 250000, 0.07, 160000, 0.05,
         80000, 0.02, 75000, 0.02, 0, 0.0, 800000, 0.24, 30000, 0.01],
        # Month 3
        [480000, 0.14, 220000, 0.07, 280000, 0.08, 170000, 0.05,
         120000, 0.04, 60000, 0.02, 50000, 0.015, 800000, 0.24, 40000, 0.012],
    ], dtype=np.float32)

    # Apply log1p to amount columns if using sigmoid output
    if uses_sigmoid:
        for i in range(len(categories)):
            monthly_data[:, i * 2] = np.log1p(monthly_data[:, i * 2])

    # Reshape to (1, 3, 18)
    X_input = monthly_data.reshape(1, 3, 18)

    # Predict
    prediction = model.predict(X_input, verbose=0)[0]  # (18,)

    print(f"  📅 Next month forecast:")
    for i, cat in enumerate(categories):
        amt = prediction[i * 2]
        ratio = prediction[i * 2 + 1]
        if uses_sigmoid:
            print(f"     {cat:15s}: normalized={amt:.4f}, ratio={ratio:.4f}")
        else:
            print(f"     {cat:15s}: Rp{amt:,.0f}, ratio={ratio:.4f}")

    if uses_sigmoid:
        print(f"  ℹ️  Output is normalized (sigmoid). Use inverse transform for IDR amounts.")

    metrics = metadata.get("metrics", {})
    if metrics:
        print(f"  📊 Normalized MAE: {metrics.get('normalized_mae', 'N/A')}")
        print(f"  📊 Original MAE: {metrics.get('original_mae', 'N/A')}")
    print()


# ============================================================
# 3. Health Score Prediction
# ============================================================
def demo_health_score():
    """Demo Health Score model: predict financial health score (0-100)."""
    print("=" * 50)
    print("3. Health Score Prediction")
    print("=" * 50)

    model_path = MODELS_DIR / "model_health_dense.keras"
    scaler_path = MODELS_DIR / "health_scaler.pkl"
    metadata_path = MODELS_DIR / "model_health_metadata.json"

    if not model_path.exists():
        print("  ❌ Model not found, skipping.\n")
        return

    # Load with custom objects
    sys.path.insert(0, str(Path(__file__).parent.parent / "ai-service" / "app" / "models"))
    from custom_objects import HealthScoreDenseModel, CategoryEmbeddingMixer

    model = tf.keras.models.load_model(
        str(model_path), compile=False,
        custom_objects={
            "HealthScoreDenseModel": HealthScoreDenseModel,
            "CategoryEmbeddingMixer": CategoryEmbeddingMixer,
        }
    )

    with open(scaler_path, 'rb') as f:
        scaler = pickle.load(f)

    # Sample inputs for 3 segments
    samples = [
        {
            "segment": "pelajar_mahasiswa",
            "features": [1500000, 0.7, 0.3, 0.8, 1, 0, 0.0, 15000, 25, 0.35],
        },
        {
            "segment": "pekerja_tetap",
            "features": [8000000, 0.55, 0.45, 0.7, 1, 1, 0.1, 50000, 40, 0.25],
        },
        {
            "segment": "freelancer",
            "features": [5000000, 0.8, 0.2, 0.95, 0, 1, 0.3, 80000, 18, 0.45],
        },
    ]

    segment_map = {"pelajar_mahasiswa": 0, "pekerja_tetap": 1, "freelancer": 2}

    for sample in samples:
        features = np.array([sample["features"]], dtype=np.float32)
        features_scaled = scaler.transform(features).astype(np.float32)
        segment_idx = np.array([[segment_map[sample["segment"]]]], dtype=np.int32)

        prediction = model.predict([segment_idx, features_scaled], verbose=0)
        score = float(np.clip(prediction[0][0], 0, 100))

        # Risk band
        if score < 20: risk = "🔴 Critical"
        elif score < 40: risk = "🟠 High Risk"
        elif score < 60: risk = "🟡 Medium"
        elif score < 80: risk = "🟢 Healthy"
        else: risk = "🟢 Excellent"

        print(f"  👤 {sample['segment']:20s} → Health Score: {score:.1f}/100 {risk}")

    if metadata_path.exists():
        with open(metadata_path) as f:
            meta = json.load(f)
        m = meta.get("metrics", {})
        print(f"  📊 Model MAE: {m.get('mae', 'N/A')}, R²: {m.get('r2', 'N/A')}")
    print()


# ============================================================
# 4. Autoencoder Anomaly Detection
# ============================================================
def demo_anomaly_detection():
    """Demo Autoencoder: detect anomalous transactions."""
    print("=" * 50)
    print("4. Anomaly Detection (Autoencoder)")
    print("=" * 50)

    model_path = MODELS_DIR / "model_autoencoder.keras"
    scaler_path = MODELS_DIR / "autoencoder_scaler.pkl"
    config_path = MODELS_DIR / "autoencoder_config.json"

    if not model_path.exists():
        print("  ❌ Model not found, skipping.\n")
        return

    model = tf.keras.models.load_model(str(model_path), compile=False)

    with open(scaler_path, 'rb') as f:
        scaler = pickle.load(f)
    with open(config_path) as f:
        config = json.load(f)

    threshold = config.get("threshold", 0.005)
    feature_cols = config.get("feature_cols", [])

    # Sample transactions
    samples = [
        {
            "label": "Normal grocery",
            "features": [10.0, 2, 1, 3, 15, 90000, 85000, 1.0, 1.0, 0.8, 0.01],
        },
        {
            "label": "Suspicious large amount",
            "features": [14.0, 2, 1, 5, 28, 90000, 85000, 5.0, 5.0, 1.5, 0.5],
        },
        {
            "label": "Normal transport",
            "features": [9.5, 5, 2, 1, 8, 50000, 45000, 0.9, 0.95, 0.5, 0.008],
        },
    ]

    for sample in samples:
        features = np.array([sample["features"]], dtype=np.float32)
        features_scaled = scaler.transform(features).astype(np.float32)

        reconstructed = model.predict(features_scaled, verbose=0)
        mse = float(np.mean((features_scaled - reconstructed) ** 2))
        is_anomaly = mse > threshold

        status = "🚨 ANOMALY" if is_anomaly else "✅ Normal"
        print(f"  💳 {sample['label']:30s} → MSE: {mse:.6f} | Threshold: {threshold:.6f} | {status}")

    metrics = config.get("metrics", {})
    if metrics:
        print(f"  📊 Test Accuracy: {metrics.get('test_accuracy', 'N/A')}")
        print(f"  📊 Test Precision: {metrics.get('test_precision', 'N/A')}")
        print(f"  📊 Test Recall: {metrics.get('test_recall', 'N/A')}")
    print()


# ============================================================
# Run all demos
# ============================================================
if __name__ == "__main__":
    demo_cnn_category()
    demo_lstm_forecast()
    demo_health_score()
    demo_anomaly_detection()

    print("=" * 60)
    print("✅ All inference demos complete!")
    print("=" * 60)