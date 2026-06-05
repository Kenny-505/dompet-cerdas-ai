const rateLimit = require('express-rate-limit');

// Skip rate limiting in development
const skipRateLimit = process.env.NODE_ENV === 'development';

/**
 * Rate limiter umum untuk semua API
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  message: {
    success: false,
    message: 'Terlalu banyak request. Coba lagi dalam 15 menit.',
  },
});

/**
 * Rate limiter ketat untuk auth endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
  },
});

/**
 * Rate limiter untuk AI chat
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak pesan. Coba lagi dalam 1 menit.',
  },
});

module.exports = { generalLimiter, authLimiter, chatLimiter };
