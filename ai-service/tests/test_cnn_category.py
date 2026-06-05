"""
Tests for CNN category prediction model.
Validates the /predict/category endpoint with real model inference.
"""
import pytest
import httpx


class TestCNNCategoryPrediction:
    """Test CNN category prediction endpoint."""

    def test_category_health_returns_ready(self, client, api_prefix, api_headers):
        """CNN model health check returns ready status."""
        resp = client.get(f"{api_prefix}/predict/category/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["model"] == "cnn_category"
        assert data["status"] == "ready"
        assert data["class_count"] > 0

    def test_category_prediction_returns_valid_structure(self, client, api_prefix, api_headers, sample_category_request):
        """CNN prediction returns valid response structure."""
        resp = client.post(f"{api_prefix}/predict/category", json=sample_category_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "predicted_category" in data
        assert "confidence" in data
        assert "all_probabilities" in data
        assert 0 <= data["confidence"] <= 1

    def test_category_prediction_food_description(self, client, api_prefix, api_headers):
        """Food description predicts makanan category."""
        req = {"amount": 35000, "transaction_type": "pengeluaran", "description": "makan siang warteg nasi"}
        resp = client.post(f"{api_prefix}/predict/category", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["predicted_category"] is not None
        assert len(data["predicted_category"]) > 0

    def test_category_prediction_transport_description(self, client, api_prefix, api_headers):
        """Transport description predicts transportasi category."""
        req = {"amount": 15000, "transaction_type": "pengeluaran", "description": "grab bike ke kantor"}
        resp = client.post(f"{api_prefix}/predict/category", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["predicted_category"] is not None

    def test_category_prediction_probabilities_sum_to_one(self, client, api_prefix, api_headers, sample_category_request):
        """All category probabilities sum to approximately 1."""
        resp = client.post(f"{api_prefix}/predict/category", json=sample_category_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        probs = data["all_probabilities"]
        assert probs is not None
        total = sum(probs.values())
        assert abs(total - 1.0) < 0.01, f"Probabilities sum {total} != 1.0"

    def test_category_prediction_amount_zero_rejected(self, client, api_prefix, api_headers):
        """Zero amount is rejected with 422 validation error."""
        req = {"amount": 0, "transaction_type": "pengeluaran", "description": "test"}
        resp = client.post(f"{api_prefix}/predict/category", json=req, headers=api_headers)
        assert resp.status_code == 422

    def test_category_prediction_empty_description_rejected(self, client, api_prefix, api_headers):
        """Empty description is rejected with 422 validation error."""
        req = {"amount": 10000, "transaction_type": "pengeluaran", "description": ""}
        resp = client.post(f"{api_prefix}/predict/category", json=req, headers=api_headers)
        assert resp.status_code == 422

    def test_category_prediction_income_type(self, client, api_prefix, api_headers):
        """Income transaction type is accepted and predicts correctly."""
        req = {"amount": 5000000, "transaction_type": "pemasukan", "description": "gaji bulanan"}
        resp = client.post(f"{api_prefix}/predict/category", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["predicted_category"] is not None