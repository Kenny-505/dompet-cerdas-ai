'use strict';

const prisma = require('../utils/prisma');
const { FIXED_CATEGORIES, ALL_CATEGORY_SLUGS } = require('../utils/categories');

/**
 * GET /api/v1/categories
 */
const getAll = async (_req, res, next) => {
  try {
    let categories;
    try {
      categories = await prisma.category.findMany({
        where: { slug: { in: ALL_CATEGORY_SLUGS } },
        orderBy: { name: 'asc' },
      });
      if (categories.length === 0) {
        categories = FIXED_CATEGORIES;
      }
    } catch {
      categories = FIXED_CATEGORIES;
    }

    return res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, FIXED_CATEGORIES };
