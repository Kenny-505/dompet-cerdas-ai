'use strict';

const userService = require('../services/user.service');

/**
 * GET /api/v1/users/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    return res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateProfile(req.user.id, req.body);
    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/users/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    return res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    if (error.message === 'WRONG_PASSWORD') {
      return res.status(401).json({ success: false, message: 'Password saat ini salah' });
    }
    next(error);
  }
};

/**
 * DELETE /api/v1/users/account
 */
const deleteAccount = async (req, res, next) => {
  try {
    await userService.deleteAccount(req.user.id);
    res.clearCookie('refreshToken');
    return res.json({ success: true, message: 'Akun berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, changePassword, deleteAccount };
