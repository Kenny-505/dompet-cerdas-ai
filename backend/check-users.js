const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { id: true, email: true, name: true } });
  console.log(JSON.stringify(users, null, 2));
  
  // Also check predictions
  const preds = await p.spendingPrediction.findMany({ 
    select: { userId: true, targetMonth: true, categorySlug: true, predictedAmount: true, modelVersion: true },
    orderBy: { targetMonth: 'desc' },
    take: 20
  });
  console.log('\nPredictions:', JSON.stringify(preds, null, 2));
}
main().finally(() => p.$disconnect());
