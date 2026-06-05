'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Route Imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const transactionRoutes = require('./routes/transaction.routes');
const budgetRoutes = require('./routes/budget.routes');
const categoryRoutes = require('./routes/category.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const chatRoutes = require('./routes/chat.routes');
const anomalyRoutes = require('./routes/anomaly.routes');
const predictionRoutes = require('./routes/prediction.routes');
const predictCategoryRoutes = require('./routes/predict-category.routes');
const readinessRoutes = require('./routes/readiness.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// Security Middleware
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} tidak diizinkan`));
  },
  credentials: true,
}));

// General Middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));
app.use(generalLimiter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'dompet-cerdas-backend',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/anomalies', anomalyRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/predict-category', predictCategoryRoutes);
app.use('/api/v1/readiness', readinessRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
