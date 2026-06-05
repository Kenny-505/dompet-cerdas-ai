'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_HASH_ROUNDS = 10; // lebih rendah dari password, tapi cukup aman
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

/**
 * Generate JWT access token
 * @param {string} userId
 */
function generateAccessToken(userId) {
  return jwt.sign(
    { sub: userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES },
  );
}

/**
 * Generate JWT refresh token (opaque random + stored in DB)
 * @param {string} userId
 */
async function generateRefreshToken(userId) {
  const token = jwt.sign(
    { sub: userId, type: 'refresh', rand: Math.random() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES },
  );

  // Hash token sebelum disimpan ke DB
  // Token asli dikembalikan ke client, hash di DB untuk verifikasi
  const tokenHash = await bcrypt.hash(token, REFRESH_TOKEN_HASH_ROUNDS);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, token: tokenHash, expiresAt },
  });

  return token; // return plain token ke client
}

/**
 * Register pengguna baru
 */
async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return { user, accessToken, refreshToken };
}

/**
 * Login pengguna
 */
async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error('INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const safeUser = { id: user.id, name: user.name, email: user.email };
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Refresh access token menggunakan refresh token
 */
async function refresh(token) {
  // Verifikasi JWT signature terlebih dahulu (cepat, tanpa DB)
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Ambil semua token milik user ini yang belum expired
  // Lalu bandingkan dengan bcrypt.compare (karena token di DB sudah di-hash)
  const userTokens = await prisma.refreshToken.findMany({
    where: {
      userId: decoded.sub,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'desc' },
  });

  if (userTokens.length === 0) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Cari token yang cocok via bcrypt.compare
  let matchedToken = null;
  for (const stored of userTokens) {
    const isMatch = await bcrypt.compare(token, stored.token);
    if (isMatch) {
      matchedToken = stored;
      break;
    }
  }

  if (!matchedToken) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Rotate: hapus token lama, buat token baru
  await prisma.refreshToken.delete({ where: { id: matchedToken.id } });
  const newRefreshToken = await generateRefreshToken(decoded.sub);
  const accessToken = generateAccessToken(decoded.sub);

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Logout: hapus refresh token dari DB
 */
async function logout(token) {
  try {
    // Verifikasi JWT untuk dapatkan userId
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return; // Token invalid, tidak perlu hapus
    }

    // Ambil semua token user dan bandingkan dengan bcrypt
    const userTokens = await prisma.refreshToken.findMany({
      where: { userId: decoded.sub },
    });

    for (const stored of userTokens) {
      const isMatch = await bcrypt.compare(token, stored.token);
      if (isMatch) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
        break;
      }
    }
  } catch {
    // Ignore semua error saat logout
  }
}

module.exports = { register, login, refresh, logout };
