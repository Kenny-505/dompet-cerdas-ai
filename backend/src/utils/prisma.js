'use strict';

const { PrismaClient } = require('@prisma/client');

/**
 * Singleton PrismaClient instance.
 * Mencegah "too many connections" di Supabase free tier
 * dengan memastikan hanya ada satu koneksi pool di seluruh aplikasi.
 */
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
