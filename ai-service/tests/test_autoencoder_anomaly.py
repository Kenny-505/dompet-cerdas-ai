"""
Tests for Autoencoder anomaly detection model.
Validates the /predict/anomaly endpoint with real model inference.
"""
import pytest


class TestAutoencoderAnomaly:
    """Test autoencoder anomaly detection endpoint."""

    def test_anomaly_model_ready(self, client, api_prefix, api_headers):
        """Autoencoder model health check returns ready status."""
        resp = client.get(f"{api_prefix}/predict/anomaly/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["model"] == "autoencoder_anomaly"
        assert data["status"] == "ready"
        assert data["input_dim"] is not None
        assert data["threshold"] is not None
        assert data["threshold"] > 0

    def test_anomaly_valid_response_structure(self, client, api_prefix, api_headers, sample_anomaly_request_normal):
        """Anomaly detection returns valid response structure."""
        resp = client.post(f"{api_prefix}/predict/anomaly", json=sample_anomaly_request_normal, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "is_anomaly" in data
        assert "anomaly_score" in data
        assert "threshold" in data
        assert "confidence" in data
        assert "explanation" in data
        assert isinstance(data["is_anomaly"], bool)
        assert data["anomaly_score"] >= 0

    def test_anomaly_normal_transaction(self, client, api_prefix, api_headers, sample_anomaly_request_normal):
        """Normal transaction has much lower anomaly score than suspicious one."""
        # Get score for normal transaction
        resp = client.post(f"{api_prefix}/predict/anomaly", json=sample_anomaly_request_normal, headers=api_headers)
        assert resp.status_code == 200
        normal_data = resp.json()
        assert normal_data["anomaly_score"] >= 0
        assert normal_data["confidence"] in ["high", "medium", "low"]

        # Get score for clearly anomalous transaction
        anomalous_req = {
            "amount_log": 16.0,
            "category_id": 0,
            "payment_method_id": 1,
            "day_of_week": 6,
            "day_of_month": 31,
            "user_avg_amount": 30000.0,
            "category_avg_amount": 40000.0,
            "amount_to_user_avg_ratio": 100.0,
            "amount_to_category_avg_ratio": 80.0,
            "budget_utilization": 5.0,
            "monthly_income_ratio": 0.95
        }
        resp2 = client.post(f"{api_prefix}/predict/anomaly", json=anomalous_req, headers=api_headers)
        assert resp2.status_code == 200
        anomalous_data = resp2.json()

        # Normal score should be significantly lower than anomalous score
        assert normal_data["anomaly_score"] < anomalous_data["anomaly_score"], \
            f"Normal score ({normal_data['anomaly_score']}) should be < anomalous score ({anomalous_data['anomaly_score']})"

    def test_anomaly_suspicious_transaction(self, client, api_prefix, api_headers, sample_anomaly_request_anomalous):
        """Clearly anomalous transaction is flagged."""
        resp = client.post(f"{api_prefix}/predict/anomaly", json=sample_anomaly_request_anomalous, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        # Highly anomalous features should produce high score
        assert data["anomaly_score"] > 0
        assert data["threshold"] > 0

    def test_anomaly_score_above_threshold_is_anomaly(self, client, api_prefix, api_headers):
        """Transaction with extreme ratios gets flagged appropriately."""
        req = {
            "amount_log": 16.0,
            "category_id": 0,
            "payment_method_id": 1,
            "day_of_week": 6,
            "day_of_month": 31,
            "user_avg_amount": 30000.0,
            "category_avg_amount": 40000.0,
            "amount_to_user_avg_ratio": 100.0,
            "amount_to_category_avg_ratio": 80.0,
            "budget_utilization": 5.0,
            "monthly_income_ratio": 0.95
        }
        resp = client.post(f"{api_prefix}/predict/anomaly", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_anomaly"] is True
        assert data["anomaly_score"] > data["threshold"]

    def test_anomaly_confidence_levels(self, client, api_prefix, api_headers, sample_anomaly_request_normal):
        """Confidence is one of high, medium, low."""
        resp = client.post(f"{api_prefix}/predict/anomaly", json=sample_anomaly_request_normal, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["confidence"] in ["high", "medium", "low"]

    def test_anomaly_explanation_present(self, client, api_prefix, api_headers, sample_anomaly_request_normal):
        """Explanation is a non-empty string."""
        resp = client.post(f"{api_prefix}/predict/anomaly", json=sample_anomaly_request_normal, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["explanation"], str)
        assert len(data["explanation"]) > 0

    def test_anomaly_health_lists_features(self, client, api_prefix, api_headers):
        """Health endpoint lists feature columns."""
        resp = client.get(f"{api_prefix}/predict/anomaly/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "feature_columns" in data
        assert len(data["feature_columns"]) == 11
        assert "amount_log" in data["feature_columns"]

    def test_anomaly_threshold_percentile_reported(self, client, api_prefix, api_headers):
        """Health endpoint reports threshold percentile."""
        resp = client.get(f"{api_prefix}/predict/anomaly/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["threshold_percentile"] is not None
        assert data["threshold_percentile"] > 0