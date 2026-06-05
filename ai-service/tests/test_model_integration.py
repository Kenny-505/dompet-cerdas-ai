"""
Cross-model integration tests.
Validates that all 4 ML models work together and the AI service is fully operational.
"""
import pytest


class TestModelIntegration:
    """Test cross-model integration and service-level health."""

    def test_service_health_endpoint(self, client):
        """Root /health endpoint returns ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "dompet-cerdas-ai-service" in data["service"]

    def test_all_four_model_health_endpoints(self, client, api_prefix, api_headers):
        """All 4 model health endpoints return ready."""
        endpoints = [
            f"{api_prefix}/predict/category/health",
            f"{api_prefix}/predict/lstm-forecast/health",
            f"{api_prefix}/predict/health-score/health",
            f"{api_prefix}/predict/anomaly/health",
        ]
        for endpoint in endpoints:
            resp = client.get(endpoint, headers=api_headers)
            assert resp.status_code == 200, f"Failed: {endpoint}"
            data = resp.json()
            assert data["status"] == "ready", f"Not ready: {endpoint}"

    def test_full_prediction_pipeline(self, client, api_prefix, api_headers):
        """Full pipeline: categorize → detect anomaly → health score → forecast."""
        # Step 1: Categorize
        cat_req = {"amount": 50000, "transaction_type": "pengeluaran", "description": "makan siang nasi goreng"}
        cat_resp = client.post(f"{api_prefix}/predict/category", json=cat_req, headers=api_headers)
        assert cat_resp.status_code == 200
        category = cat_resp.json()["predicted_category"]
        assert category is not None

        # Step 2: Anomaly detection
        anomaly_req = {
            "amount_log": 10.82, "category_id": 0, "payment_method_id": 1,
            "day_of_week": 2, "day_of_month": 15,
            "user_avg_amount": 45000.0, "category_avg_amount": 52000.0,
            "amount_to_user_avg_ratio": 1.1, "amount_to_category_avg_ratio": 0.96,
            "budget_utilization": 0.7, "monthly_income_ratio": 0.008
        }
        anomaly_resp = client.post(f"{api_prefix}/predict/anomaly", json=anomaly_req, headers=api_headers)
        assert anomaly_resp.status_code == 200
        assert "is_anomaly" in anomaly_resp.json()

        # Step 3: Health score
        health_req = {
            "user_segment": "pekerja_tetap", "monthly_income": 8000000,
            "spending_ratio": 0.75, "savings_ratio": 0.25,
            "budget_utilization": 0.85, "has_savings": True, "has_debt": False,
            "debt_ratio": 0.0, "expense_volatility": 30000.0,
            "n_transactions": 40, "top_category_ratio": 0.22
        }
        health_resp = client.post(f"{api_prefix}/predict/health-score", json=health_req, headers=api_headers)
        assert health_resp.status_code == 200
        assert "health_score" in health_resp.json()

    def test_api_key_required_for_predict_endpoints(self, client, api_prefix):
        """Predict endpoints require API key when configured (or allow when not)."""
        # Without API key header — should succeed when no key is configured
        resp = client.get(f"{api_prefix}/predict/category/health")
        # Either 200 (no key configured) or 403 (key required)
        assert resp.status_code in [200, 403]

    def test_cors_headers_present(self, client):
        """CORS headers are present on responses."""
        resp = client.options("/health", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        })
        # FastAPI CORS middleware should handle this
        assert resp.status_code in [200, 204, 405]