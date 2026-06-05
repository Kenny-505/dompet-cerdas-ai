'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

async function getProfile(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true,
      avatarUrl: true, currency: true, monthlyIncome: true,
      userSegment: true, hasSavings: true, hasDebt: true,
      createdAt: true,
    },
  });
}

async function updateProfile(userId, data) {
  const allowedFields = [
    'name',
    'phone',
    'avatarUrl',
    'currency',
    'monthlyIncome',
    'userSegment',
    'hasSavings',
    'hasDebt',
  ];
  const updateData = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true, name: true, email: true, phone: true,
      avatarUrl: true, currency: true, monthlyIncome: true,
      userSegment: true, hasSavings: true, hasDebt: true,
    },
  });
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error('WRONG_PASSWORD');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Invalidate semua refresh tokens
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

async function deleteAccount(userId) {
  // Cascade delete via Prisma schema (onDelete: Cascade)
  await prisma.user.delete({ where: { id: userId } });
}

module.exports = { getProfile, updateProfile, changePassword, deleteAccount };
