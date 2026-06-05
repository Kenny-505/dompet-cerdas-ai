"""
Tests for Health Score Dense NN model.
Validates the /predict/health-score endpoint with real model inference.
"""
import pytest


class TestHealthScore:
    """Test health score prediction endpoint."""

    def test_health_score_model_ready(self, client, api_prefix, api_headers):
        """Health score model health check returns ready status."""
        resp = client.get(f"{api_prefix}/predict/health-score/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["model"] == "health_score_dense_nn"
        assert data["status"] == "ready"
        assert data["n_segments"] == 3

    def test_health_score_valid_response(self, client, api_prefix, api_headers, sample_health_score_request):
        """Health score returns valid response structure."""
        resp = client.post(f"{api_prefix}/predict/health-score", json=sample_health_score_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "health_score" in data
        assert "user_segment" in data
        assert "confidence" in data
        assert "risk_band" in data
        assert 0 <= data["health_score"] <= 100

    def test_health_score_pekerja_segment(self, client, api_prefix, api_headers):
        """Pekerja tetap segment returns valid score."""
        req = {
            "user_segment": "pekerja_tetap", "monthly_income": 8000000,
            "spending_ratio": 0.7, "savings_ratio": 0.3,
            "budget_utilization": 0.85, "has_savings": True, "has_debt": False,
            "debt_ratio": 0.0, "expense_volatility": 30000.0,
            "n_transactions": 45, "top_category_ratio": 0.25
        }
        resp = client.post(f"{api_prefix}/predict/health-score", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_segment"] == "pekerja_tetap"
        assert data["health_score"] >= 0

    def test_health_score_pelajar_segment(self, client, api_prefix, api_headers):
        """Pelajar mahasiswa segment returns valid score."""
        req = {
            "user_segment": "pelajar_mahasiswa", "monthly_income": 2000000,
            "spending_ratio": 0.9, "savings_ratio": 0.1,
            "budget_utilization": 0.95, "has_savings": False, "has_debt": False,
            "debt_ratio": 0.0, "expense_volatility": 20000.0,
            "n_transactions": 20, "top_category_ratio": 0.35
        }
        resp = client.post(f"{api_prefix}/predict/health-score", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_segment"] == "pelajar_mahasiswa"

    def test_health_score_freelancer_segment(self, client, api_prefix, api_headers):
        """Freelancer segment returns valid score."""
        req = {
            "user_segment": "freelancer", "monthly_income": 5000000,
            "spending_ratio": 0.85, "savings_ratio": 0.15,
            "budget_utilization": 1.1, "has_savings": True, "has_debt": True,
            "debt_ratio": 0.2, "expense_volatility": 80000.0,
            "n_transactions": 30, "top_category_ratio": 0.3
        }
        resp = client.post(f"{api_prefix}/predict/health-score", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_segment"] == "freelancer"

    def test_health_score_risk_bands(self, client, api_prefix, api_headers):
        """Risk band classification is consistent with score."""
        req = {
            "user_segment": "pekerja_tetap", "monthly_income": 8000000,
            "spending_ratio": 0.7, "savings_ratio": 0.3,
            "budget_utilization": 0.8, "has_savings": True, "has_debt": False,
            "debt_ratio": 0.0, "expense_volatility": 25000.0,
            "n_transactions": 50, "top_category_ratio": 0.2
        }
        resp = client.post(f"{api_prefix}/predict/health-score", json=req, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        score = data["health_score"]
        band = data["risk_band"]
        if score < 20:
            assert band == "critical"
        elif score < 40:
            assert band == "high_risk"
        elif score < 60:
            assert band == "medium"
        elif score < 80:
            assert band == "healthy"
        else:
            assert band == "excellent"

    def test_health_score_confidence_levels(self, client, api_prefix, api_headers, sample_health_score_request):
        """Confidence is one of high, medium, low."""
        resp = client.post(f"{api_prefix}/predict/health-score", json=sample_health_score_request, headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["confidence"] in ["high", "medium", "low"]

    def test_health_score_invalid_segment_rejected(self, client, api_prefix, api_headers):
        """Invalid user_segment is rejected."""
        req = {
            "user_segment": "invalid_segment", "monthly_income": 5000000,
            "spending_ratio": 0.7, "savings_ratio": 0.3,
            "budget_utilization": 0.8, "has_savings": True, "has_debt": False,
            "debt_ratio": 0.0, "expense_volatility": 25000.0,
            "n_transactions": 40, "top_category_ratio": 0.2
        }
        resp = client.post(f"{api_prefix}/predict/health-score", json=req, headers=api_headers)
        assert resp.status_code == 400

    def test_health_score_segments_listed(self, client, api_prefix, api_headers):
        """Health endpoint lists all 3 segments."""
        resp = client.get(f"{api_prefix}/predict/health-score/health", headers=api_headers)
        assert resp.status_code == 200
        data = resp.json()
        segments = data["segments"]
        assert "pelajar_mahasiswa" in segments
        assert "pekerja_tetap" in segments
        assert "freelancer" in segments