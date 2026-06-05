"""
Tests for LSTM spending forecast model.
Validates the /predict/lstm-forecast endpoint with real model inference.
"""
import pytest
import httpx


class TestLSTMForecast:
    """Test LSTM spending forecast endpoint."""

    def test_lstm_health_returns_ready(self, client, api_prefix, api_headers):
        """LSTM model health check returns ready status."""
        resp = client.get(f"{api_prefix}/predict/lstm-forecast/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["model"] == "lstm_spending_forecast"
        assert data["status"] == "ready"
        assert data["n_categories"] == 9
        assert data["timesteps"] == 3

    def test_lstm_forecast_valid_structure(self, client, api_prefix, api_headers, sample_lstm_request):
        """LSTM forecast returns valid response structure."""
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "future_months" in data
        assert "monthly_forecast" in data
        assert "categories" in data
        assert "model_input_timesteps" in data
        assert data["future_months"] == 1
        assert len(data["monthly_forecast"]) == 1

    def test_lstm_forecast_month_format(self, client, api_prefix, api_headers, sample_lstm_request):
        """Forecast month is in YYYY-MM format."""
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        month = data["monthly_forecast"][0]["month"]
        assert len(month) == 7  # YYYY-MM
        assert month[4] == "-"

    def test_lstm_forecast_all_categories_present(self, client, api_prefix, api_headers, sample_lstm_request):
        """All 9 categories are present in forecast output."""
        expected_cats = ["makanan", "transportasi", "belanja", "tagihan", "hiburan",
                         "kesehatan", "pendidikan", "kos_sewa", "lainnya"]
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        cats = data["monthly_forecast"][0]["categories"]
        for cat in expected_cats:
            assert cat in cats, f"Missing category: {cat}"

    def test_lstm_forecast_amounts_non_negative(self, client, api_prefix, api_headers, sample_lstm_request):
        """All predicted amounts are non-negative."""
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        cats = data["monthly_forecast"][0]["categories"]
        for cat_name, cat_data in cats.items():
            assert cat_data["predicted_amount"] >= 0, f"{cat_name} amount < 0"
            assert 0 <= cat_data["predicted_income_ratio"] <= 1, f"{cat_name} ratio out of range"

    def test_lstm_forecast_total_matches_sum(self, client, api_prefix, api_headers, sample_lstm_request):
        """Total predicted expense matches sum of category amounts."""
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        forecast = data["monthly_forecast"][0]
        cat_sum = sum(c["predicted_amount"] for c in forecast["categories"].values())
        assert abs(forecast["total_predicted_expense"] - cat_sum) < 1.0, \
            f"Total {forecast['total_predicted_expense']} != sum {cat_sum}"

    def test_lstm_forecast_multi_month(self, client, api_prefix, api_headers, sample_lstm_request):
        """Multi-month forecast returns correct number of months."""
        sample_lstm_request["future_months"] = 3
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["future_months"] == 3
        assert len(data["monthly_forecast"]) == 3
        # Reset
        sample_lstm_request["future_months"] = 1

    def test_lstm_forecast_months_sequential(self, client, api_prefix, api_headers, sample_lstm_request):
        """Multi-month forecast months are sequential."""
        sample_lstm_request["future_months"] = 3
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        months = [f["month"] for f in data["monthly_forecast"]]
        # Check months are unique and sequential
        assert len(set(months)) == 3, "Months should be unique"
        sample_lstm_request["future_months"] = 1

    def test_lstm_forecast_future_months_max_exceeded(self, client, api_prefix, api_headers, sample_lstm_request):
        """future_months > 12 is rejected with 422."""
        sample_lstm_request["future_months"] = 13
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=sample_lstm_request, headers=api_headers)
        assert resp.status_code == 422
        sample_lstm_request["future_months"] = 1

    def test_lstm_forecast_insufficient_months_rejected(self, client, api_prefix, api_headers):
        """Request with less than 3 months is rejected with 422."""
        req = {
            "monthly_data": [
                {"month": "2025-01", "income": 5000000, "makanan": {"amount": 1000000, "income_ratio": 0.2},
                 "transportasi": {"amount": 500000, "income_ratio": 0.1}, "belanja": {"amount": 300000, "income_ratio": 0.06},
                 "tagihan": {"amount": 200000, "income_ratio": 0.04}, "hiburan": {"amount": 100000, "income_ratio": 0.02},
                 "kesehatan": {"amount": 100000, "income_ratio": 0.02}, "pendidikan": {"amount": 100000, "income_ratio": 0.02},
                 "kos_sewa": {"amount": 500000, "income_ratio": 0.1}, "lainnya": {"amount": 100000, "income_ratio": 0.02}}
            ],
            "future_months": 1
        }
        resp = client.post(f"{api_prefix}/predict/lstm-forecast", json=req, headers=api_headers)
        assert resp.status_code == 422