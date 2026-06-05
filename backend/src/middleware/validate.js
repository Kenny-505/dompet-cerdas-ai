'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware untuk mengumpulkan hasil validasi express-validator.
 * Taruh setelah array validasi di route.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validasi gagal',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { validate };
