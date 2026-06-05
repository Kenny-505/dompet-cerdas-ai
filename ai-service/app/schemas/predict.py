"""
Pydantic schemas for prediction endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from enum import Enum


class TransactionType(str, Enum):
    """Transaction type enum matching database schema."""
    PENGELUARAN = "pengeluaran"
    PEMASUKAN = "pemasukan"


class CategoryPredictionRequest(BaseModel):
    """Request schema for category prediction."""
    amount: float = Field(..., gt=0, description="Transaction amount in IDR")
    transaction_type: TransactionType = Field(..., description="Type: pengeluaran or pemasukan")
    description: str = Field(..., min_length=1, max_length=500, description="Transaction description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "amount": 25000,
                "transaction_type": "pengeluaran",
                "description": "beli kopi di Janji Jiwa"
            }
        }


class CategoryPredictionResponse(BaseModel):
    """Response schema for category prediction."""
    predicted_category: str = Field(..., description="Predicted category label")
    confidence: float = Field(..., ge=0, le=1, description="Prediction confidence score")
    all_probabilities: Optional[Dict[str, float]] = Field(None, description="All category probabilities")
    
    class Config:
        json_schema_extra = {
            "example": {
                "predicted_category": "makanan",
                "confidence": 0.92,
                "all_probabilities": {
                    "makanan": 0.92,
                    "transportasi": 0.03,
                    "belanja": 0.02,
                    "lainnya": 0.03
                }
            }
        }


class CategorySpend(BaseModel):
    """Spending data for a single category in a single month."""
    amount: float = Field(..., ge=0, description="Absolute spending amount in IDR")
    income_ratio: float = Field(..., ge=0, le=1, description="Spending as ratio of monthly income")


class MonthlySpend(BaseModel):
    """All category spending for a single month (9 categories × 2 features = 18 dims)."""
    month: str = Field(..., description="Month label in YYYY-MM format")
    income: float = Field(..., gt=0, description="Monthly income for ratio normalization")
    makanan: CategorySpend
    transportasi: CategorySpend
    belanja: CategorySpend
    tagihan: CategorySpend
    hiburan: CategorySpend
    kesehatan: CategorySpend
    pendidikan: CategorySpend
    kos_sewa: CategorySpend
    lainnya: CategorySpend


class LSTMForecastRequest(BaseModel):
    """Request schema for LSTM spending forecast (multi-category model).

    The model expects 3 consecutive months of spending data across all 9
    expense categories (amount + income_ratio each = 18 features per month).
    It predicts the next month's spending for every category simultaneously.
    """
    monthly_data: List[MonthlySpend] = Field(
        ..., min_length=3, max_length=3,
        description="Exactly 3 months of historical spending (oldest first). "
                    "Each month must include all 9 categories."
    )
    future_months: int = Field(
        default=1, ge=1, le=12,
        description="Number of future months to autoregressively forecast (1-12)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "monthly_data": [
                    {
                        "month": "2025-01",
                        "income": 9000000,
                        "makanan": {"amount": 1851000, "income_ratio": 0.2057},
                        "transportasi": {"amount": 535000, "income_ratio": 0.0594},
                        "belanja": {"amount": 775000, "income_ratio": 0.0861},
                        "tagihan": {"amount": 736000, "income_ratio": 0.0818},
                        "hiburan": {"amount": 351000, "income_ratio": 0.039},
                        "kesehatan": {"amount": 312000, "income_ratio": 0.0347},
                        "pendidikan": {"amount": 533000, "income_ratio": 0.0592},
                        "kos_sewa": {"amount": 882000, "income_ratio": 0.098},
                        "lainnya": {"amount": 423000, "income_ratio": 0.047}
                    },
                    {
                        "month": "2025-02",
                        "income": 9000000,
                        "makanan": {"amount": 1182000, "income_ratio": 0.1313},
                        "transportasi": {"amount": 1175000, "income_ratio": 0.1306},
                        "belanja": {"amount": 726000, "income_ratio": 0.0807},
                        "tagihan": {"amount": 799000, "income_ratio": 0.0888},
                        "hiburan": {"amount": 453000, "income_ratio": 0.0503},
                        "kesehatan": {"amount": 274000, "income_ratio": 0.0304},
                        "pendidikan": {"amount": 476000, "income_ratio": 0.0529},
                        "kos_sewa": {"amount": 770000, "income_ratio": 0.0856},
                        "lainnya": {"amount": 370000, "income_ratio": 0.0411}
                    },
                    {
                        "month": "2025-03",
                        "income": 9000000,
                        "makanan": {"amount": 1496000, "income_ratio": 0.1662},
                        "transportasi": {"amount": 1247000, "income_ratio": 0.1386},
                        "belanja": {"amount": 654000, "income_ratio": 0.0727},
                        "tagihan": {"amount": 746000, "income_ratio": 0.0829},
                        "hiburan": {"amount": 375000, "income_ratio": 0.0417},
                        "kesehatan": {"amount": 310000, "income_ratio": 0.0344},
                        "pendidikan": {"amount": 529000, "income_ratio": 0.0588},
                        "kos_sewa": {"amount": 832000, "income_ratio": 0.0924},
                        "lainnya": {"amount": 407000, "income_ratio": 0.0452}
                    }
                ],
                "future_months": 1
            }
        }


class CategoryForecast(BaseModel):
    """Forecast result for a single category."""
    predicted_amount: float = Field(..., description="Predicted expense amount in IDR (>=0)")
    predicted_income_ratio: float = Field(..., ge=0, le=1, description="Predicted income ratio (0-1)")


class ForecastPoint(BaseModel):
    """Multi-category forecast for a single future month."""
    month: str = Field(..., description="Forecast month in YYYY-MM format")
    categories: Dict[str, CategoryForecast] = Field(
        ..., description="Predicted spending per category (makanan, transportasi, etc.)"
    )
    total_predicted_expense: float = Field(
        ..., description="Sum of all category predicted expenses in IDR"
    )


class LSTMForecastResponse(BaseModel):
    """Response schema for LSTM multi-category spending forecast."""
    future_months: int = Field(..., description="Number of months forecasted")
    monthly_forecast: List[ForecastPoint] = Field(..., description="Month-by-month multi-category forecast")
    categories: List[str] = Field(..., description="List of forecasted categories")
    model_input_timesteps: int = Field(..., description="Number of historical timesteps used as input")

    class Config:
        json_schema_extra = {
            "example": {
                "future_months": 1,
                "monthly_forecast": [
                    {
                        "month": "2025-04",
                        "categories": {
                            "makanan": {"predicted_amount": 1550000.0, "predicted_income_ratio": 0.1722},
                            "transportasi": {"predicted_amount": 800000.0, "predicted_income_ratio": 0.0889}
                        },
                        "total_predicted_expense": 7200000.0
                    }
                ],
                "categories": ["makanan", "transportasi", "belanja", "tagihan",
                               "hiburan", "kesehatan", "pendidikan", "kos_sewa", "lainnya"],
                "model_input_timesteps": 3
            }
        }


class HealthScoreRequest(BaseModel):
    """Request schema for health score prediction.

    The model expects a user segment label and 10 numeric financial features.
    Component scores are NOT included — the model predicts health_score directly
    from raw financial ratios and behavioral signals.
    """
    user_segment: str = Field(
        ..., description="User segment: pelajar_mahasiswa, pekerja_tetap, or freelancer"
    )
    monthly_income: float = Field(..., gt=0, description="Monthly income in IDR")
    spending_ratio: float = Field(..., ge=0, le=1, description="Total expense / total income")
    savings_ratio: float = Field(..., ge=0, le=1, description="1 - spending_ratio")
    budget_utilization: float = Field(..., ge=0, description="Total expense / total budget")
    has_savings: bool = Field(..., description="Whether user has savings activity")
    has_debt: bool = Field(..., description="Whether user has debt")
    debt_ratio: float = Field(..., ge=0, le=1, description="Debt-related payments / total income")
    expense_volatility: float = Field(..., ge=0, description="Std dev of daily expense")
    n_transactions: int = Field(..., ge=0, description="Number of transactions in the month")
    top_category_ratio: float = Field(..., ge=0, le=1, description="Top category spending / total expense")

    class Config:
        json_schema_extra = {
            "example": {
                "user_segment": "pekerja_tetap",
                "monthly_income": 6500000,
                "spending_ratio": 0.83,
                "savings_ratio": 0.17,
                "budget_utilization": 1.05,
                "has_savings": True,
                "has_debt": True,
                "debt_ratio": 0.18,
                "expense_volatility": 0.0,
                "n_transactions": 58,
                "top_category_ratio": 0.21
            }
        }


class HealthScoreResponse(BaseModel):
    """Response schema for health score prediction."""
    health_score: float = Field(..., ge=0, le=100, description="Predicted health score (0-100)")
    user_segment: str = Field(..., description="User segment used for prediction")
    confidence: str = Field(
        ..., description="Confidence level based on model MAE: high (<3 MAE), medium (3-5), low (>5)"
    )
    risk_band: str = Field(
        ..., description="Risk classification: critical (0-20), high_risk (20-40), medium (40-60), healthy (60-80), excellent (80-100)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "health_score": 72.5,
                "user_segment": "pekerja_tetap",
                "confidence": "high",
                "risk_band": "healthy"
            }
        }


class PredictionErrorResponse(BaseModel):
    """Error response schema."""
    detail: str = Field(..., description="Error message")
    fallback_category: Optional[str] = Field("lainnya", description="Fallback category if prediction fails")
    
    class Config:
        json_schema_extra = {
            "example": {
                "detail": "Model not loaded or inference failed",
                "fallback_category": "lainnya"
            }
        }


# --- Anomaly Detection Schemas ---

class AnomalyDetectionRequest(BaseModel):
    """Request schema for anomaly detection using autoencoder.
    
    The model expects 11 numeric features derived from a single transaction
    and user/category context. Features are scaled internally using the
    StandardScaler fitted during training.
    """
    amount_log: float = Field(..., description="Log-transformed transaction amount (np.log1p(amount))")
    category_id: int = Field(..., ge=0, description="Numeric category ID (0-11)")
    payment_method_id: int = Field(..., ge=0, description="Numeric payment method ID")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
    day_of_month: int = Field(..., ge=1, le=31, description="Day of month (1-31)")
    user_avg_amount: float = Field(..., ge=0, description="User's average transaction amount")
    category_avg_amount: float = Field(..., ge=0, description="Average amount for this category")
    amount_to_user_avg_ratio: float = Field(..., ge=0, description="amount / user_avg_amount")
    amount_to_category_avg_ratio: float = Field(..., ge=0, description="amount / category_avg_amount")
    budget_utilization: float = Field(..., ge=0, description="Current budget utilization ratio (0-1+)")
    monthly_income_ratio: float = Field(..., ge=0, le=1, description="Transaction amount / monthly income")

    class Config:
        json_schema_extra = {
            "example": {
                "amount_log": 11.98,
                "category_id": 0,
                "payment_method_id": 1,
                "day_of_week": 2,
                "day_of_month": 15,
                "user_avg_amount": 45000.0,
                "category_avg_amount": 52000.0,
                "amount_to_user_avg_ratio": 3.1,
                "amount_to_category_avg_ratio": 2.77,
                "budget_utilization": 0.85,
                "monthly_income_ratio": 0.022
            }
        }


class AnomalyDetectionResponse(BaseModel):
    """Response schema for anomaly detection."""
    is_anomaly: bool = Field(..., description="Whether the transaction is flagged as anomalous")
    anomaly_score: float = Field(..., ge=0, description="Reconstruction error (MSE) — higher = more anomalous")
    threshold: float = Field(..., ge=0, description="Anomaly threshold (95th percentile of validation errors)")
    confidence: str = Field(..., description="Confidence level: high, medium, low")
    explanation: str = Field(..., description="Human-readable explanation of why the transaction was flagged")

    class Config:
        json_schema_extra = {
            "example": {
                "is_anomaly": True,
                "anomaly_score": 0.1542,
                "threshold": 0.0891,
                "confidence": "high",
                "explanation": "Transaction amount is 3.1x your average spending. Unusually high for category makanan."
            }
        }
