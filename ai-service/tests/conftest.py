"""
Shared fixtures for AI/ML inference tests.
All tests run against the LIVE AI service at localhost:8000.
"""
import pytest
import httpx
import os
import numpy as np
from pathlib import Path

# Load .env from ai-service root if AI_SERVICE_API_KEY not already set
_env_file = Path(__file__).resolve().parent.parent / ".env"
if _env_file.exists() and not os.getenv("AI_SERVICE_API_KEY"):
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


BASE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
API_PREFIX = "/api/v1"
API_KEY = os.getenv("AI_SERVICE_API_KEY", "")


@pytest.fixture(scope="session")
def base_url():
    """Base URL for the AI service."""
    return BASE_URL


@pytest.fixture(scope="session")
def api_prefix():
    """API prefix for prediction endpoints."""
    return API_PREFIX


@pytest.fixture(scope="session")
def api_headers():
    """Headers with API key if configured."""
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    return headers


@pytest.fixture(scope="session")
def client():
    """Synchronous httpx client for testing."""
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="session")
def async_client():
    """Async httpx client for testing."""
    import asyncio
    # Not needed if using sync client; kept for flexibility
    pass


# --- Sample Data Fixtures ---

@pytest.fixture
def sample_category_request():
    """Sample request for CNN category prediction."""
    return {
        "amount": 25000,
        "transaction_type": "pengeluaran",
        "description": "beli kopi di Janji Jiwa"
    }


@pytest.fixture
def sample_category_requests():
    """Multiple sample requests for category prediction testing."""
    return [
        {"amount": 35000, "transaction_type": "pengeluaran", "description": "makan siang warteg"},
        {"amount": 15000, "transaction_type": "pengeluaran", "description": "grab ke kantor"},
        {"amount": 500000, "transaction_type": "pengeluaran", "description": "belanja bulanan di alfamart"},
        {"amount": 200000, "transaction_type": "pengeluaran", "description": "bayar listrik pln"},
        {"amount": 50000, "transaction_type": "pengeluaran", "description": "nonton bioskop xxi"},
        {"amount": 100000, "transaction_type": "pengeluaran", "description": "beli obat di apotek"},
        {"amount": 500000, "transaction_type": "pemasukan", "description": "gaji bulanan dari kantor"},
    ]


@pytest.fixture
def sample_lstm_request():
    """Sample request for LSTM forecast with 3 months of data."""
    def _make_month(month, income, amounts):
        return {
            "month": month,
            "income": income,
            "makanan": {"amount": amounts[0], "income_ratio": amounts[0] / income},
            "transportasi": {"amount": amounts[1], "income_ratio": amounts[1] / income},
            "belanja": {"amount": amounts[2], "income_ratio": amounts[2] / income},
            "tagihan": {"amount": amounts[3], "income_ratio": amounts[3] / income},
            "hiburan": {"amount": amounts[4], "income_ratio": amounts[4] / income},
            "kesehatan": {"amount": amounts[5], "income_ratio": amounts[5] / income},
            "pendidikan": {"amount": amounts[6], "income_ratio": amounts[6] / income},
            "kos_sewa": {"amount": amounts[7], "income_ratio": amounts[7] / income},
            "lainnya": {"amount": amounts[8], "income_ratio": amounts[8] / income},
        }

    return {
        "monthly_data": [
            _make_month("2025-01", 9000000, [1851000, 535000, 775000, 736000, 351000, 312000, 533000, 882000, 423000]),
            _make_month("2025-02", 9000000, [1182000, 1175000, 726000, 799000, 453000, 274000, 476000, 770000, 370000]),
            _make_month("2025-03", 9000000, [1496000, 1247000, 654000, 746000, 375000, 310000, 529000, 832000, 407000]),
        ],
        "future_months": 1
    }


@pytest.fixture
def sample_health_score_request():
    """Sample request for health score prediction (pekerja_tetap)."""
    return {
        "user_segment": "pekerja_tetap",
        "monthly_income": 6500000,
        "spending_ratio": 0.83,
        "savings_ratio": 0.17,
        "budget_utilization": 1.05,
        "has_savings": True,
        "has_debt": True,
        "debt_ratio": 0.18,
        "expense_volatility": 50000.0,
        "n_transactions": 58,
        "top_category_ratio": 0.21
    }


@pytest.fixture
def sample_anomaly_request_normal():
    """Sample anomaly request for a normal transaction."""
    return {
        "amount_log": 10.82,
        "category_id": 0,
        "payment_method_id": 1,
        "day_of_week": 2,
        "day_of_month": 15,
        "user_avg_amount": 45000.0,
        "category_avg_amount": 52000.0,
        "amount_to_user_avg_ratio": 1.0,
        "amount_to_category_avg_ratio": 0.95,
        "budget_utilization": 0.65,
        "monthly_income_ratio": 0.007
    }


@pytest.fixture
def sample_anomaly_request_anomalous():
    """Sample anomaly request for a clearly anomalous transaction."""
    return {
        "amount_log": 15.42,
        "category_id": 0,
        "payment_method_id": 1,
        "day_of_week": 6,
        "day_of_month": 28,
        "user_avg_amount": 45000.0,
        "category_avg_amount": 52000.0,
        "amount_to_user_avg_ratio": 35.0,
        "amount_to_category_avg_ratio": 30.5,
        "budget_utilization": 2.5,
        "monthly_income_ratio": 0.85
    }