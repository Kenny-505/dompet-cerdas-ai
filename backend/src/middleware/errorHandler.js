const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Must be the LAST middleware registered in Express.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Data sudah ada (duplikat).',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Data tidak ditemukan.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token sudah kedaluwarsa.',
    });
  }

  // Validation errors
  if (err.type === 'validation') {
    return res.status(422).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Generic HTTP error
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode < 500 ? err.message : 'Internal server error.';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
