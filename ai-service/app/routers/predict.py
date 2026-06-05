"""
Prediction endpoints for ML models.
"""
import os
import logging
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, HTTPException, status, Depends, Security
from fastapi.security import APIKeyHeader
from typing import Dict, List

# API Key authentication
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    """Validate API key for protected endpoints."""
    expected_api_key = os.getenv("AI_SERVICE_API_KEY")
    if not expected_api_key:
        return api_key_header  # Allow if no key configured
    if api_key_header == expected_api_key:
        return api_key_header
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate API Key",
    )

from app.schemas.predict import (
    CategoryPredictionRequest,
    CategoryPredictionResponse,
    LSTMForecastRequest,
    LSTMForecastResponse,
    ForecastPoint,
    CategoryForecast,
    HealthScoreRequest,
    HealthScoreResponse,
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    PredictionErrorResponse
)
from app.preprocessing.text import TextPreprocessor
from app.models.loader import model_manager

router = APIRouter(
    prefix="/predict", 
    tags=["Prediction"],
    dependencies=[Depends(get_api_key)]  # Require API key for all predict endpoints
)

logger = logging.getLogger(__name__)

# Fallback category when model fails
FALLBACK_CATEGORY = "lainnya"

# Ordered categories matching model output (9 categories × 2 features = 18 dims)
LSTM_CATEGORIES = [
    "makanan", "transportasi", "belanja", "tagihan", "hiburan",
    "kesehatan", "pendidikan", "kos_sewa", "lainnya"
]


@router.post(
    "/category",
    response_model=CategoryPredictionResponse,
    responses={
        200: {"description": "Successful prediction"},
        503: {
            "description": "Model not available",
            "model": PredictionErrorResponse
        },
        500: {
            "description": "Internal server error",
            "model": PredictionErrorResponse
        }
    },
    summary="Predict transaction category",
    description="Predict the category of a transaction based on description, amount, and type using CNN model."
)
async def predict_category(request: CategoryPredictionRequest):
    """
    Predict transaction category using CNN model.
    
    - **amount**: Transaction amount in IDR (must be > 0)
    - **transaction_type**: Either "pengeluaran" (expense) or "pemasukan" (income)
    - **description**: Transaction description text
    
    Returns predicted category with confidence score.
    """
    # Check if model is ready
    if not model_manager.is_cnn_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "CNN model not loaded. Please try again later.",
                "fallback_category": FALLBACK_CATEGORY
            }
        )
    
    try:
        # Get model and preprocessors
        model = model_manager.get_cnn_model()
        tokenizer = model_manager.get_category_tokenizer()
        label_encoder = model_manager.get_category_label_encoder()
        
        # Initialize preprocessor - model expects max_length=20
        preprocessor = TextPreprocessor(max_length=20)
        preprocessor.tokenizer = tokenizer
        
        # Preprocess input
        text_seq = preprocessor.preprocess(request.description)
        
        # Normalize amount (log scale)
        amount_norm = np.log1p(request.amount) / 20.0
        amount_norm = np.clip(amount_norm, 0, 1)
        
        # Encode transaction type
        type_encoded = 0 if request.transaction_type == "pengeluaran" else 1
        
        # Reshape for model input (batch_size=1)
        # Model expects 2 inputs: text_input (None, 20) and numeric_input (None, 2)
        text_input = np.expand_dims(text_seq, axis=0).astype(np.float32)
        numeric_input = np.array([[amount_norm, type_encoded]], dtype=np.float32)
        
        # Run prediction
        predictions = model.predict([text_input, numeric_input], verbose=0)
        
        # Get predicted class and confidence
        predicted_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_idx])
        
        # Convert to category label
        predicted_category = label_encoder.inverse_transform([predicted_idx])[0]
        
        # Build all probabilities dictionary
        all_probs = {
            label_encoder.inverse_transform([i])[0]: float(predictions[0][i])
            for i in range(len(predictions[0]))
        }
        
        # Sort by probability descending
        all_probs = dict(sorted(all_probs.items(), key=lambda x: x[1], reverse=True))
        
        return CategoryPredictionResponse(
            predicted_category=predicted_category,
            confidence=round(confidence, 4),
            all_probabilities=all_probs
        )
        
    except Exception as e:
        # Log error and return fallback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Prediction error: {str(e)}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": f"Prediction failed: {str(e)}",
                "fallback_category": FALLBACK_CATEGORY
            }
        )


@router.get(
    "/category/health",
    summary="Check category prediction model status",
    description="Check if the CNN category prediction model is loaded and ready."
)
async def category_model_health():
    """Check if CNN model is loaded and ready."""
    is_ready = model_manager.is_cnn_ready()
    classes = model_manager.get_category_classes()
    
    return {
        "model": "cnn_category",
        "status": "ready" if is_ready else "not_loaded",
        "classes": classes if classes else [],
        "class_count": len(classes) if classes else 0
    }


def _monthly_spend_to_vector(ms) -> np.ndarray:
    """Convert a MonthlySpend object into an 18-dim feature vector.
    
    Feature order: [makanan_amt, makanan_ratio, transportasi_amt, transportasi_ratio, ...]
    Matching the training data column order: 9 categories × 2 features.
    """
    features = []
    for cat in LSTM_CATEGORIES:
        cs = getattr(ms, cat)
        features.extend([cs.amount, cs.income_ratio])
    return np.array(features, dtype=np.float32)


@router.post(
    "/lstm-forecast",
    response_model=LSTMForecastResponse,
    responses={
        200: {"description": "Successful forecast"},
        503: {
            "description": "Model not available",
            "model": PredictionErrorResponse
        },
        400: {
            "description": "Invalid input data",
            "model": PredictionErrorResponse
        },
        500: {
            "description": "Internal server error",
            "model": PredictionErrorResponse
        }
    },
    summary="Forecast next-month spending across all categories",
    description=(
        "Use the multi-category LSTM model to forecast next-month expenses for "
        "all 9 spending categories simultaneously, based on 3 consecutive months "
        "of historical spending data. Supports autoregressive multi-step forecasting."
    )
)
async def predict_lstm_forecast(request: LSTMForecastRequest):
    """
    Forecast next-month spending using the multi-category LSTM model.

    - **monthly_data**: Exactly 3 months of historical spending (all 9 categories each)
    - **future_months**: Number of months to autoregressively forecast (1-12)

    Returns per-category predicted amounts for each future month.
    """
    # Check if LSTM model is ready
    if not model_manager.is_lstm_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "LSTM spending forecast model not loaded. Please try again later.",
            }
        )

    try:
        model = model_manager.get_lstm_model()
        config = model_manager.get_lstm_config()
        lstm_scaler = model_manager.get_lstm_scaler()

        timesteps = config.get("timesteps", 3) if config else 3
        n_categories = config.get("n_categories", 9) if config else 9
        normalization = config.get("normalization", {}) if config else {}
        uses_sigmoid = normalization.get("output_activation") == "sigmoid"

        # Build input array: (1, 3, 18)
        monthly_vectors = [_monthly_spend_to_vector(ms) for ms in request.monthly_data]
        current_window = np.array(monthly_vectors, dtype=np.float32)  # (3, 18)

        if current_window.shape != (timesteps, 18):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": f"Expected input shape ({timesteps}, 18), "
                              f"got {current_window.shape}.",
                }
            )

        # Apply log1p to amount columns if model uses normalized targets
        if uses_sigmoid:
            for t in range(timesteps):
                for ci in range(n_categories):
                    amount_idx = t * (n_categories * 2) + ci * 2
                    current_window[t, amount_idx] = np.log1p(current_window[t, amount_idx])

        # Determine last month label for forecast labels
        last_label = request.monthly_data[-1].month
        try:
            last_date = datetime.strptime(last_label, "%Y-%m")
        except ValueError:
            last_date = datetime.now().replace(day=1)

        def inverse_transform_prediction(pred_row, scaler, n_cats):
            """Inverse transform normalized prediction to original IDR space."""
            pred_2d = pred_row.reshape(1, -1)
            if scaler is not None:
                pred_log = scaler.inverse_transform(pred_2d)[0]
            else:
                pred_log = pred_row
            # Inverse log1p on amount columns (even indices)
            result = pred_log.copy()
            for ci in range(n_cats):
                amount_idx = ci * 2
                result[amount_idx] = np.expm1(result[amount_idx])
            # Clip negative amounts to 0
            for ci in range(n_cats):
                result[ci * 2] = max(0.0, result[ci * 2])
            return result

        # Autoregressive multi-step forecast
        window = current_window.copy()  # (3, 18)
        all_forecasts: List[Dict] = []

        for step in range(request.future_months):
            x_input = window.reshape(1, timesteps, 18).astype(np.float32)
            pred = model.predict(x_input, verbose=0)  # (1, 18)
            pred_row = pred[0]  # (18,)

            # Inverse transform if using normalized targets
            if uses_sigmoid:
                pred_original = inverse_transform_prediction(pred_row, lstm_scaler, n_categories)
            else:
                pred_original = pred_row.copy()

            # Parse predictions per category
            cat_forecasts = {}
            for ci, cat in enumerate(LSTM_CATEGORIES):
                raw_amt = float(pred_original[ci * 2])
                raw_ratio = float(pred_original[ci * 2 + 1])
                # Clamp to valid ranges
                raw_amt = max(raw_amt, 0.0)
                raw_ratio = max(0.0, min(raw_ratio, 1.0))
                cat_forecasts[cat] = {
                    "amount": raw_amt,
                    "ratio": raw_ratio,
                }

            # Compute month label
            month_date = last_date + relativedelta(months=step + 1)
            month_str = month_date.strftime("%Y-%m")

            total_expense = sum(cf["amount"] for cf in cat_forecasts.values())

            all_forecasts.append({
                "month": month_str,
                "categories": cat_forecasts,
                "total": total_expense,
            })

            # Slide window: drop oldest, append prediction vector (normalized space)
            new_row = pred_row.copy()
            window = np.vstack([window[1:], new_row.reshape(1, -1)])

        # Build response
        monthly_forecast = []
        for fc in all_forecasts:
            cats = {}
            for cat in LSTM_CATEGORIES:
                cats[cat] = CategoryForecast(
                    predicted_amount=round(fc["categories"][cat]["amount"], 2),
                    predicted_income_ratio=round(fc["categories"][cat]["ratio"], 4),
                )
            monthly_forecast.append(
                ForecastPoint(
                    month=fc["month"],
                    categories=cats,
                    total_predicted_expense=round(fc["total"], 2),
                )
            )

        return LSTMForecastResponse(
            future_months=request.future_months,
            monthly_forecast=monthly_forecast,
            categories=LSTM_CATEGORIES,
            model_input_timesteps=timesteps,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LSTM forecast error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": f"Forecast failed: {str(e)}",
            }
        )


@router.get(
    "/lstm-forecast/health",
    summary="Check LSTM forecast model status",
    description="Check if the LSTM spending forecast model is loaded and ready."
)
async def lstm_model_health():
    """Check if LSTM model is loaded and ready."""
    is_ready = model_manager.is_lstm_ready()
    config = model_manager.get_lstm_config()

    return {
        "model": "lstm_spending_forecast",
        "status": "ready" if is_ready else "not_loaded",
        "n_categories": config.get("n_categories") if config else None,
        "timesteps": config.get("timesteps") if config else None,
        "input_shape": config.get("input_shape") if config else None,
        "categories": LSTM_CATEGORIES,
    }


# --- Health Score Prediction ---

SEGMENT_MAP = {"pelajar_mahasiswa": 0, "pekerja_tetap": 1, "freelancer": 2}

# Feature columns expected by the model (same order as training)
HEALTH_NUMERIC_COLS = [
    "monthly_income", "spending_ratio", "savings_ratio",
    "budget_utilization", "has_savings", "has_debt",
    "debt_ratio", "expense_volatility", "n_transactions", "top_category_ratio"
]


def _risk_band(score: float) -> str:
    if score < 20:
        return "critical"
    elif score < 40:
        return "high_risk"
    elif score < 60:
        return "medium"
    elif score < 80:
        return "healthy"
    return "excellent"


def _confidence_label(mae_val: float) -> str:
    if mae_val < 3:
        return "high"
    elif mae_val < 5:
        return "medium"
    return "low"


@router.post(
    "/health-score",
    response_model=HealthScoreResponse,
    responses={
        200: {"description": "Successful health score prediction"},
        503: {
            "description": "Model not available",
            "model": PredictionErrorResponse
        },
        400: {
            "description": "Invalid input data",
            "model": PredictionErrorResponse
        },
        500: {
            "description": "Internal server error",
            "model": PredictionErrorResponse
        }
    },
    summary="Predict financial health score",
    description=(
        "Predict a user's financial health score (0-100) based on their financial "
        "metrics using the Dense NN model. The model takes a user segment label and "
        "10 numeric financial features, and returns a score with risk classification."
    )
)
async def predict_health_score(request: HealthScoreRequest):
    """
    Predict financial health score using Dense NN model.

    - **user_segment**: User segment (pelajar_mahasiswa, pekerja_tetap, freelancer)
    - **monthly_income**: Monthly income in IDR
    - **spending_ratio**: Total expense / total income
    - **savings_ratio**: 1 - spending_ratio
    - **budget_utilization**: Total expense / total budget
    - **has_savings**: Whether user has savings activity
    - **has_debt**: Whether user has debt
    - **debt_ratio**: Debt-related payments / total income
    - **expense_volatility**: Std dev of daily expense
    - **n_transactions**: Number of transactions in the month
    - **top_category_ratio**: Top category spending / total expense

    Returns predicted health score (0-100), risk band, and confidence level.
    """
    if not model_manager.is_health_score_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "Health score model not loaded. Please try again later.",
            }
        )

    try:
        model = model_manager.get_health_score_model()
        config = model_manager.get_health_score_config()
        scaler = model_manager.get_health_score_scaler()

        # Validate segment
        if request.user_segment not in SEGMENT_MAP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": f"Invalid user_segment '{request.user_segment}'. "
                              f"Must be one of: {list(SEGMENT_MAP.keys())}",
                }
            )

        # Build numeric feature vector
        features = np.array([[
            request.monthly_income,
            request.spending_ratio,
            request.savings_ratio,
            request.budget_utilization,
            float(request.has_savings),
            float(request.has_debt),
            request.debt_ratio,
            request.expense_volatility,
            float(request.n_transactions),
            request.top_category_ratio,
        ]], dtype=np.float32)

        # Scale features
        if scaler is not None:
            features = scaler.transform(features).astype(np.float32)

        # Build segment input
        segment_idx = np.array([[SEGMENT_MAP[request.user_segment]]], dtype=np.int32)

        # Predict
        prediction = model.predict([segment_idx, features], verbose=0)
        raw_score = float(prediction[0][0])

        # Inverse-transform score if needed (model may output normalized score)
        # The model outputs directly in 0-100 range after training
        health_score = float(np.clip(raw_score, 0, 100))

        # Confidence: use model MAE from metadata if available
        mae_val = 5.0  # default conservative
        if config and "metrics" in config:
            mae_val = config["metrics"].get("mae", 5.0)

        return HealthScoreResponse(
            health_score=round(health_score, 1),
            user_segment=request.user_segment,
            confidence=_confidence_label(mae_val),
            risk_band=_risk_band(health_score),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health score prediction error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": f"Health score prediction failed: {str(e)}",
            }
        )


@router.get(
    "/health-score/health",
    summary="Check health score model status",
    description="Check if the health score Dense NN model is loaded and ready."
)
async def health_score_model_health():
    """Check if Health Score model is loaded and ready."""
    is_ready = model_manager.is_health_score_ready()
    config = model_manager.get_health_score_config()

    return {
        "model": "health_score_dense_nn",
        "status": "ready" if is_ready else "not_loaded",
        "n_numeric_features": config.get("n_numeric") if config else None,
        "n_segments": config.get("n_segments") if config else None,
        "best_val_mae": config.get("metrics", {}).get("mae") if config else None,
        "best_val_r2": config.get("metrics", {}).get("r2") if config else None,
        "segments": list(SEGMENT_MAP.keys()),
    }


# --- Anomaly Detection ---

ANOMALY_FEATURE_COLS = [
    "amount_log", "category_id", "payment_method_id",
    "day_of_week", "day_of_month",
    "user_avg_amount", "category_avg_amount",
    "amount_to_user_avg_ratio", "amount_to_category_avg_ratio",
    "budget_utilization", "monthly_income_ratio",
]


def _anomaly_confidence(score: float, threshold: float) -> str:
    """Determine confidence based on how far above threshold the score is."""
    if threshold <= 0:
        return "low"
    ratio = score / threshold
    if ratio > 2.0:
        return "high"
    elif ratio > 1.3:
        return "medium"
    return "low"


def _anomaly_explanation(request: AnomalyDetectionRequest, is_anomaly: bool) -> str:
    """Generate human-readable explanation for the anomaly flag."""
    if not is_anomaly:
        return "Transaction appears normal based on your spending patterns."

    reasons = []
    if request.amount_to_user_avg_ratio > 2.0:
        reasons.append(
            f"Transaction amount is {request.amount_to_user_avg_ratio:.1f}x your average spending."
        )
    if request.amount_to_category_avg_ratio > 2.0:
        reasons.append(
            f"Amount is {request.amount_to_category_avg_ratio:.1f}x the category average."
        )
    if request.budget_utilization > 1.0:
        reasons.append(
            f"Budget utilization at {request.budget_utilization:.0%} (over budget)."
        )
    if request.monthly_income_ratio > 0.3:
        reasons.append(
            f"This transaction represents {request.monthly_income_ratio:.0%} of monthly income."
        )
    if not reasons:
        reasons.append("The transaction's feature pattern deviates significantly from normal spending.")
    return " ".join(reasons)


@router.post(
    "/anomaly",
    response_model=AnomalyDetectionResponse,
    responses={
        200: {"description": "Successful anomaly detection"},
        503: {
            "description": "Model not available",
            "model": PredictionErrorResponse
        },
        500: {
            "description": "Internal server error",
            "model": PredictionErrorResponse
        }
    },
    summary="Detect anomalous transaction",
    description=(
        "Detect whether a transaction is anomalous using the autoencoder model. "
        "The model reconstructs the input features; high reconstruction error "
        "(above the calibrated threshold) indicates an anomalous transaction."
    )
)
async def detect_anomaly(request: AnomalyDetectionRequest):
    """
    Detect anomalous transaction using autoencoder.

    The autoencoder is trained on normal transactions only.
    Anomaly = high reconstruction error (MSE) above the 95th-percentile threshold.
    """
    if not model_manager.is_autoencoder_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "detail": "Autoencoder anomaly detection model not loaded. Please try again later.",
            }
        )

    try:
        model = model_manager.get_autoencoder_model()
        config = model_manager.get_autoencoder_config()
        scaler = model_manager.get_autoencoder_scaler()

        threshold = config.get("threshold", 0.0) if config else 0.0

        # Build feature vector from request (same order as training)
        features = np.array([[
            request.amount_log,
            request.category_id,
            request.payment_method_id,
            request.day_of_week,
            request.day_of_month,
            request.user_avg_amount,
            request.category_avg_amount,
            request.amount_to_user_avg_ratio,
            request.amount_to_category_avg_ratio,
            request.budget_utilization,
            request.monthly_income_ratio,
        ]], dtype=np.float32)

        # Scale features
        if scaler is not None:
            features = scaler.transform(features).astype(np.float32)

        # Predict (reconstruct)
        reconstructed = model.predict(features, verbose=0)

        # Compute per-sample MSE reconstruction error
        anomaly_score = float(np.mean((features - reconstructed) ** 2))

        is_anomaly = anomaly_score > threshold if threshold > 0 else False
        confidence = _anomaly_confidence(anomaly_score, threshold)
        explanation = _anomaly_explanation(request, is_anomaly)

        return AnomalyDetectionResponse(
            is_anomaly=is_anomaly,
            anomaly_score=round(anomaly_score, 6),
            threshold=round(threshold, 6),
            confidence=confidence,
            explanation=explanation,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Anomaly detection error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": f"Anomaly detection failed: {str(e)}",
            }
        )


@router.get(
    "/anomaly/health",
    summary="Check anomaly detection model status",
    description="Check if the autoencoder anomaly detection model is loaded and ready."
)
async def anomaly_model_health():
    """Check if Autoencoder anomaly detection model is loaded and ready."""
    is_ready = model_manager.is_autoencoder_ready()
    config = model_manager.get_autoencoder_config()

    return {
        "model": "autoencoder_anomaly",
        "status": "ready" if is_ready else "not_loaded",
        "input_dim": config.get("input_dim") if config else None,
        "threshold": config.get("threshold") if config else None,
        "threshold_percentile": config.get("threshold_percentile") if config else None,
        "feature_columns": ANOMALY_FEATURE_COLS,
    }
