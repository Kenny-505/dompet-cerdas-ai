'use strict';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Which user has predictions?
  const pred = await p.spendingPrediction.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log('Latest prediction userId:', pred?.userId, 'targetMonth:', pred?.targetMonth, 'modelVersion:', pred?.modelVersion);

  const user = await p.user.findUnique({ where: { id: pred?.userId }, select: { email: true, userSegment: true } });
  console.log('User:', user);

  // Check that user's transactions - what categories do they have?
  const txs = await p.transaction.findMany({
    where: { userId: pred?.userId, type: 'expense' },
    include: { category: { select: { slug: true } } },
    orderBy: { date: 'desc' },
    take: 20,
  });
  const catCounts = {};
  for (const tx of txs) {
    const slug = tx.category?.slug || 'unknown';
    catCounts[slug] = (catCounts[slug] || 0) + 1;
  }
  console.log('\nExpense categories for this user:', catCounts);

  // Check ALL predictions for pekerja_ready
  const pekerjaReady = await p.user.findFirst({
    where: { email: 'demo.pekerja.ready@dompetcerdas.test' },
  });
  if (pekerjaReady) {
    const preds = await p.spendingPrediction.findMany({
      where: { userId: pekerjaReady.id },
      orderBy: { categorySlug: 'asc' },
    });
    console.log('\nPekerja_ready predictions:', preds.length);
    for (const pred of preds) {
      console.log(`  ${pred.categorySlug}: ${pred.predictedAmount} (${pred.modelVersion}) targetMonth: ${pred.targetMonth}`);
    }

    // Check readiness: how many months of expense data?
    const expTxs = await p.transaction.findMany({
      where: { userId: pekerjaReady.id, type: 'expense' },
      select: { date: true, amount: true },
      orderBy: { date: 'asc' },
    });
    const monthSet = new Set(expTxs.map(t => t.date.toISOString().slice(0, 7)));
    console.log('\nPekerja_ready expense months:', [...monthSet]);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
