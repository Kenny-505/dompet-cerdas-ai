/**
 * Test prediction flow directly (no HTTP, direct service call)
 * Usage: node test-prediction-api.js <userId>
 */
const predictionService = require('./src/services/prediction.service');

// Use Citra Pekerja (Ready) - has predictions in DB
const userId = process.argv[2] || 'cmpyil9b9005mpgdjm9jibwoe';
const targetMonth = (() => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
})();

console.log('=== Testing Prediction Service ===');
console.log('userId:', userId);
console.log('targetMonth:', targetMonth);
console.log('');

async function run() {
  // 1. Test GET existing predictions
  console.log('--- GET existing predictions ---');
  try {
    const preds = await predictionService.get(userId, targetMonth);
    console.log('GET result count:', preds?.length);
    const total = preds?.find(p => p.categorySlug === '__total');
    console.log('Total prediction:', total ? `${total.predictedAmount} (${total.modelVersion})` : 'NOT FOUND');
    console.log('All slugs:', preds?.map(p => p.categorySlug));
  } catch (err) {
    console.error('GET error:', err.message);
  }

  console.log('');
  
  // 2. Test GENERATE
  console.log('--- GENERATE prediction ---');
  try {
    const result = await predictionService.generate(userId);
    console.log('GENERATE result:', result ? JSON.stringify({
      categorySlug: result.categorySlug,
      predictedAmount: result.predictedAmount,
      modelVersion: result.modelVersion,
    }) : 'NULL (failed)');
  } catch (err) {
    console.error('GENERATE error:', err.message);
    console.error('Stack:', err.stack);
  }
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
