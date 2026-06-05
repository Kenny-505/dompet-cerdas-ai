'use strict';

const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

/**
 * Middleware autentikasi JWT.
 * Mengambil access token dari Authorization header: "Bearer <token>"
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token autentikasi tidak ditemukan',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token sudah kadaluarsa',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid',
      });
    }

    // Verify user masih ada di DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        name: true,
        userSegment: true,
        monthlyIncome: true,
        hasSavings: true,
        hasDebt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak ditemukan',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware untuk validasi X-API-Key (dipakai internal: Backend → AI Service)
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.AI_SERVICE_API_KEY) {
    return res.status(403).json({
      success: false,
      message: 'API key tidak valid',
    });
  }
  next();
};

module.exports = { authenticate, validateApiKey };
