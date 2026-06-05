'use strict';

const authService = require('../services/auth.service');
const logger = require('../utils/logger');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
};

/**
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.register({ name, email, password });

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar',
      });
    }
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah',
      });
    }
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token tidak ditemukan',
      });
    }

    const result = await authService.refresh(token);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  } catch (error) {
    if (error.message === 'INVALID_REFRESH_TOKEN') {
      res.clearCookie('refreshToken');
      return res.status(401).json({
        success: false,
        message: 'Refresh token tidak valid atau sudah kadaluarsa',
      });
    }
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await authService.logout(token);

    res.clearCookie('refreshToken');
    return res.json({ success: true, message: 'Logout berhasil' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 */
const me = async (req, res) => {
  return res.json({
    success: true,
    data: { user: req.user },
  });
};

module.exports = { register, login, refresh, logout, me };
