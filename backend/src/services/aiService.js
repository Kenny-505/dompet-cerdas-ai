'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.FASTAPI_URL || process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_KEY = process.env.AI_SERVICE_API_KEY || '';

const TIMEOUT_CATEGORY = 5000;
const TIMEOUT_PREDICTION = 15000;
const TIMEOUT_ANOMALY = 5000;
const TIMEOUT_CHAT = 30000;

const client = axios.create({
  baseURL: `${AI_SERVICE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': AI_API_KEY,
  },
});

// Log request errors uniformly
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || 'unknown';
    const status = err.response?.status || 'no-response';
    logger.warn(`AI Service ${url} failed [${status}]: ${err.message}`);
    return Promise.reject(err);
  },
);

// --- Prediction Endpoints ---

/**
 * Auto-categorize a transaction via CNN model.
 * @param {string} description
 * @param {number} amount
 * @param {string} [transactionType='pengeluaran']
 * @returns {Promise<{predicted_category: string, confidence: number, all_probabilities: object}|null>}
 */
async function predictCategory(description, amount, transactionType = 'pengeluaran') {
  try {
    const resp = await client.post('/predict/category', {
      description,
      amount,
      transaction_type: transactionType,
    }, { timeout: TIMEOUT_CATEGORY });
    return resp.data;
  } catch {
    return null;
  }
}

/**
 * LSTM spending forecast per category.
 * @param {Array} monthlyData - 3 months of MonthlySpend objects
 * @param {number} [futureMonths=1]
 * @returns {Promise<object|null>}
 */
async function predictLstmForecast(monthlyData, futureMonths = 1) {
  try {
    const resp = await client.post('/predict/lstm-forecast', {
      monthly_data: monthlyData,
      future_months: futureMonths,
    }, { timeout: TIMEOUT_PREDICTION });
    return resp.data;
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    logger.warn(`AI Service /predict/lstm-forecast failed [${err.response?.status || 'no-response'}]: ${JSON.stringify(detail)}`);
    return null;
  }
}

/**
 * Dense NN health score prediction.
 * @param {object} features - HealthScoreRequest fields
 * @returns {Promise<{health_score: number, risk_band: string, confidence: string, user_segment: string}|null>}
 */
async function predictHealthScore(features) {
  try {
    const resp = await client.post('/predict/health-score', features, { timeout: TIMEOUT_PREDICTION });
    return resp.data;
  } catch {
    return null;
  }
}

/**
 * Autoencoder anomaly detection.
 * @param {object} features - AnomalyDetectionRequest fields
 * @returns {Promise<{is_anomaly: boolean, anomaly_score: number, threshold: number, confidence: string, explanation: string}|null>}
 */
async function detectAnomaly(features) {
  try {
    const resp = await client.post('/predict/anomaly', features, { timeout: TIMEOUT_ANOMALY });
    return resp.data;
  } catch {
    return null;
  }
}

/**
 * Chat with AI assistant (Groq via AI-service).
 * @param {string} message
 * @param {Array} history - last N messages [{role, content}]
 * @param {object} financialContext
 * @returns {Promise<string>}
 */
async function sendChatMessage(message, history, financialContext) {
  try {
    const resp = await client.post('/chat', {
      message,
      history,
      financial_context: financialContext,
    }, { timeout: TIMEOUT_CHAT });
    return resp.data?.reply || null;
  } catch {
    return null;
  }
}

// --- Health Checks ---

async function checkHealth() {
  try {
    const resp = await client.get('/health', { timeout: 3000 });
    return resp.data;
  } catch {
    return { status: 'unreachable' };
  }
}

async function checkCategoryModelHealth() {
  try {
    const resp = await client.get('/predict/category/health', { timeout: 3000 });
    return resp.data;
  } catch {
    return { model: 'cnn_category', status: 'unreachable' };
  }
}

async function checkLstmModelHealth() {
  try {
    const resp = await client.get('/predict/lstm-forecast/health', { timeout: 3000 });
    return resp.data;
  } catch {
    return { model: 'lstm_spending_forecast', status: 'unreachable' };
  }
}

async function checkHealthScoreModelHealth() {
  try {
    const resp = await client.get('/predict/health-score/health', { timeout: 3000 });
    return resp.data;
  } catch {
    return { model: 'health_score_dense_nn', status: 'unreachable' };
  }
}

async function checkAnomalyModelHealth() {
  try {
    const resp = await client.get('/predict/anomaly/health', { timeout: 3000 });
    return resp.data;
  } catch {
    return { model: 'autoencoder_anomaly', status: 'unreachable' };
  }
}

module.exports = {
  predictCategory,
  predictLstmForecast,
  predictHealthScore,
  detectAnomaly,
  sendChatMessage,
  checkHealth,
  checkCategoryModelHealth,
  checkLstmModelHealth,
  checkHealthScoreModelHealth,
  checkAnomalyModelHealth,
};