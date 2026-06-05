'use strict';

require('dotenv').config();

const app = require('../src/app');
const prisma = require('../src/utils/prisma');

const EMAIL = process.env.E2E_EMAIL || 'tester@tes.com';
const PASSWORD = process.env.E2E_PASSWORD || 'Tester12345';
const NAME = process.env.E2E_NAME || 'Tester Baseline V2';

const V2_CATEGORY_SLUGS = [
  'makanan',
  'transportasi',
  'belanja',
  'tagihan',
  'hiburan',
  'kesehatan',
  'pendidikan',
  'kos_sewa',
  'lainnya',
  'gaji',
  'freelance_bonus',
  'pemasukan_lain',
];

const LEGACY_CATEGORY_SLUGS = ['investasi', 'sosial', 'perawatan_diri', 'perjalanan'];
const SEGMENTS = ['pelajar_mahasiswa', 'pekerja_tetap', 'freelancer'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function currentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/api/v1` });
    });
  });
}

function makeClient(baseUrl) {
  let cookieHeader = '';

  async function request(method, path, { token, body, expectedStatus } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookieHeader) headers.Cookie = cookieHeader;

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
    if (setCookies.length > 0) {
      cookieHeader = setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
    } else {
      const singleCookie = response.headers.get('set-cookie');
      if (singleCookie) cookieHeader = singleCookie.split(';')[0];
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (expectedStatus && response.status !== expectedStatus) {
      throw new Error(`${method} ${path} expected ${expectedStatus}, got ${response.status}: ${text}`);
    }

    return { status: response.status, data };
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, body, options = {}) => request('POST', path, { ...options, body }),
    put: (path, body, options = {}) => request('PUT', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  };
}

async function loginOrRegister(client) {
  let response = await client.post('/auth/login', { email: EMAIL, password: PASSWORD });

  if (response.status === 401) {
    response = await client.post('/auth/register', { name: NAME, email: EMAIL, password: PASSWORD });
  }

  assert([200, 201].includes(response.status), `Auth failed with status ${response.status}`);
  const accessToken = response.data?.data?.accessToken;
  assert(accessToken, 'Auth response did not include data.accessToken');
  assert(response.data?.data?.user?.email === EMAIL, 'Auth response returned unexpected user email');

  return accessToken;
}

async function validateTempRegistration(baseUrl) {
  const tempClient = makeClient(baseUrl);
  const tempEmail = `baseline-${Date.now()}@tes.com`;
  const response = await tempClient.post('/auth/register', {
    name: 'Temp Baseline User',
    email: tempEmail,
    password: PASSWORD,
  }, { expectedStatus: 201 });

  const token = response.data?.data?.accessToken;
  assert(token, 'Temp register response did not include data.accessToken');

  const me = await tempClient.get('/auth/me', { token, expectedStatus: 200 });
  assert(me.data?.data?.user?.email === tempEmail, 'Temp protected route returned unexpected user');

  return { tempClient, token, email: tempEmail };
}

async function validateAuth(client, token) {
  const unauthorized = await client.get('/auth/me');
  assert(unauthorized.status === 401, 'Protected route should reject request without token');

  const me = await client.get('/auth/me', { token, expectedStatus: 200 });
  assert(me.data?.data?.user?.email === EMAIL, 'Protected route returned unexpected user');
}

async function validateCategories(client, token) {
  const response = await client.get('/categories', { token, expectedStatus: 200 });
  const slugs = response.data.data.map((category) => category.slug);

  for (const slug of V2_CATEGORY_SLUGS) {
    assert(slugs.includes(slug), `Missing v2 category: ${slug}`);
  }

  for (const slug of LEGACY_CATEGORY_SLUGS) {
    assert(!slugs.includes(slug), `Legacy category is still active: ${slug}`);
  }
}

async function validateProfile(client, token) {
  for (const [index, segment] of SEGMENTS.entries()) {
    const response = await client.put('/users/profile', {
      name: `${NAME} ${index + 1}`,
      monthlyIncome: 6250000 + index,
      userSegment: segment,
      hasSavings: index !== 0,
      hasDebt: index === 2,
    }, { token, expectedStatus: 200 });

    assert(response.data.data.userSegment === segment, `Profile segment was not saved: ${segment}`);
  }

  const profile = await client.get('/users/profile', { token, expectedStatus: 200 });
  assert(profile.data.data.userSegment === 'freelancer', 'Profile final segment mismatch');
  assert(profile.data.data.hasDebt === true, 'Profile hasDebt mismatch');
  assert(profile.data.data.hasSavings === true, 'Profile hasSavings mismatch');
  assert(Number(profile.data.data.monthlyIncome) === 6250002, 'Profile monthlyIncome mismatch');
}

async function validateTransactions(client, token, tempAccount) {
  const date = todayDate();
  const created = await client.post('/transactions', {
    type: 'expense',
    amount: 25000,
    description: `E2E makanan ${Date.now()}`,
    date,
    categorySlug: 'makanan',
    note: 'created by baseline v2 validation',
  }, { token, expectedStatus: 201 });

  const transaction = created.data.data;
  assert(transaction.category?.slug === 'makanan', 'Transaction create did not resolve categorySlug makanan');

  if (tempAccount) {
    const otherUserRead = await tempAccount.tempClient.get(`/transactions/${transaction.id}`, { token: tempAccount.token });
    assert(otherUserRead.status === 404, 'Other user should not be able to read this transaction');
  }

  const list = await client.get(`/transactions?page=1&limit=20&type=expense&category=makanan&startDate=${date}&endDate=${date}`, {
    token,
    expectedStatus: 200,
  });
  assert(
    list.data.data.transactions.some((item) => item.id === transaction.id),
    'Created transaction was not found in filtered list',
  );

  const updated = await client.put(`/transactions/${transaction.id}`, {
    amount: 30000,
    categorySlug: 'transportasi',
    note: 'updated by baseline v2 validation',
  }, { token, expectedStatus: 200 });

  assert(Number(updated.data.data.amount) === 30000, 'Transaction amount update mismatch');
  assert(updated.data.data.category?.slug === 'transportasi', 'Transaction update did not resolve categorySlug transportasi');

  // Test search functionality
  const uniqueSearchString = `E2E_search_${Date.now()}`;
  const transactionToSearch = await client.post('/transactions', {
    type: 'expense',
    amount: 15000,
    description: `Makan siang ${uniqueSearchString} di warteg`,
    date,
    categorySlug: 'makanan',
    note: 'test search context',
  }, { token, expectedStatus: 201 });

  const searchList = await client.get(`/transactions?search=${uniqueSearchString}`, {
    token,
    expectedStatus: 200,
  });
  
  assert(
    searchList.data.data.transactions.length >= 1,
    'Search by description did not return any results'
  );
  assert(
    searchList.data.data.transactions.some((item) => item.id === transactionToSearch.data.data.id),
    'Search by description did not find the expected transaction'
  );

  await client.delete(`/transactions/${transaction.id}`, { token, expectedStatus: 200 });
  await client.delete(`/transactions/${transactionToSearch.data.data.id}`, { token, expectedStatus: 200 });
  const afterDelete = await client.get(`/transactions/${transaction.id}`, { token });
  assert(afterDelete.status === 404, 'Deleted transaction should return 404');
}

async function validateBudget(client, token) {
  const monthYear = currentMonthYear();
  const updated = await client.put('/budgets', {
    monthYear,
    totalBudget: 50000, // Small budget for testing
    needsPercent: 50,
    wantsPercent: 30,
    savingsPercent: 20,
    allocations: [
      { categorySlug: 'makanan', budgetAmount: 10000 },
      { categorySlug: 'pemasukan_lain', budgetAmount: 5000 } // Should be ignored (income category)
    ]
  }, { token, expectedStatus: 200 });

  assert(Number(updated.data.data.totalBudget) === 50000, 'Budget totalBudget update mismatch');

  let summary = await client.get(`/budgets/summary?monthYear=${monthYear}`, { token, expectedStatus: 200 });
  assert(summary.data.data.monthYear === monthYear, 'Budget summary monthYear mismatch');
  assert(Number(summary.data.data.setting.totalBudget) === 50000, 'Budget summary setting mismatch');
  assert(Array.isArray(summary.data.data.allocations), 'Budget summary allocations should be an array');
  
  // Verify that only the expense category (makanan) was allocated, and the income one (pemasukan_lain) was ignored
  const allocations = summary.data.data.allocations;
  const makananAlloc = allocations.find(a => a.categorySlug === 'makanan');
  const pemasukanAlloc = allocations.find(a => a.categorySlug === 'pemasukan_lain');
  
  assert(makananAlloc, 'Expense category allocation (makanan) was not saved');
  assert(Number(makananAlloc.budgetAmount) === 10000, 'Expense category allocation budgetAmount mismatch');
  assert(!pemasukanAlloc, 'Income category allocation (pemasukan_lain) should have been rejected/ignored');

  // Add transaction to trigger 'warning' status for 'makanan' (>= 80% and <= 100%)
  const date = todayDate();
  const tx1 = await client.post('/transactions', {
    type: 'expense',
    amount: 8500, // 85% of 10000
    description: `Tx Warning Budget ${Date.now()}`,
    date,
    categorySlug: 'makanan',
    note: 'E2E warning budget test'
  }, { token, expectedStatus: 201 });

  summary = await client.get(`/budgets/summary?monthYear=${monthYear}`, { token, expectedStatus: 200 });
  let refreshedMakananAlloc = summary.data.data.allocations.find(a => a.categorySlug === 'makanan');
  
  assert(Number(refreshedMakananAlloc.spent) === 8500, 'Budget summary spent amount mismatch after tx1');
  assert(refreshedMakananAlloc.status === 'warning', 'Budget summary allocation status should be "warning" (>=80%)');

  // Add another transaction to trigger 'exceeded' status for 'makanan' (> 100%)
  const tx2 = await client.post('/transactions', {
    type: 'expense',
    amount: 2000, // total spent: 10500 > 10000
    description: `Tx Exceeded Budget ${Date.now()}`,
    date,
    categorySlug: 'makanan',
    note: 'E2E exceeded budget test'
  }, { token, expectedStatus: 201 });

  summary = await client.get(`/budgets/summary?monthYear=${monthYear}`, { token, expectedStatus: 200 });
  refreshedMakananAlloc = summary.data.data.allocations.find(a => a.categorySlug === 'makanan');
  
  assert(Number(refreshedMakananAlloc.spent) === 10500, 'Budget summary spent amount mismatch after tx2');
  assert(refreshedMakananAlloc.status === 'exceeded', 'Budget summary allocation status should be "exceeded" (>100%)');

  // Cleanup testing transactions
  await client.delete(`/transactions/${tx1.data.data.id}`, { token, expectedStatus: 200 });
  await client.delete(`/transactions/${tx2.data.data.id}`, { token, expectedStatus: 200 });
}

async function validateDashboard(client, token) {
  const now = new Date();
  const monthYear = currentMonthYear();
  
  // Make an income and an expense transaction
  const txIncome = await client.post('/transactions', {
    type: 'income',
    amount: 15000000,
    description: `Dashboard Income ${Date.now()}`,
    date: todayDate(),
    categorySlug: 'gaji',
    note: 'E2E dashboard test'
  }, { token, expectedStatus: 201 });

  const txExpense = await client.post('/transactions', {
    type: 'expense',
    amount: 2500000,
    description: `Dashboard Expense ${Date.now()}`,
    date: todayDate(),
    categorySlug: 'belanja',
    note: 'E2E dashboard test'
  }, { token, expectedStatus: 201 });

  const summary = await client.get(`/dashboard/summary?monthYear=${monthYear}`, { token, expectedStatus: 200 });
  const { totalIncome, totalExpense, netSavings, spendingByCategory } = summary.data.data;
  
  assert(Number(totalIncome) >= 15000000, 'Dashboard income should reflect the created transactions');
  assert(Number(totalExpense) >= 2500000, 'Dashboard expense should reflect the created transactions');
  
  const hasBelanja = spendingByCategory.some(cat => cat.slug === 'belanja' && Number(cat.amount) >= 2500000);
  assert(hasBelanja, 'Dashboard array spendingByCategory should include the test expense transaction');

  // Verify trends
  const trend = await client.get(`/dashboard/spending-trend`, { token, expectedStatus: 200 });
  assert(Array.isArray(trend.data.data), 'Dashboard trend should return an array');

  // Cleanup
  await client.delete(`/transactions/${txIncome.data.data.id}`, { token, expectedStatus: 200 });
  await client.delete(`/transactions/${txExpense.data.data.id}`, { token, expectedStatus: 200 });
}

async function validateReadiness(client, token, tempAccount) {
  // New user temp account should have no_data
  const tempReadiness = await tempAccount.tempClient.get(`/readiness`, { token: tempAccount.token, expectedStatus: 200 });
  const state = tempReadiness.data.data;
  assert(state.prediction.status === 'no_data', 'Temp user prediction readiness should be no_data');
  assert(state.healthScore.status === 'no_data', 'Temp user healthScore readiness should be no_data');
  assert(state.anomaly.status === 'no_data', 'Temp user anomaly readiness should be no_data');
  assert(state.assistant.status === 'no_data', 'Temp user assistant readiness should be no_data');
  assert(state.monthsWithData === 0, 'Temp user monthsWithData should be 0');

  // Main user (has interactions) likely limited_data
  // Not creating 3 months of data to avoid test complexity, but just ensuring endpoint exists and structure is clean
  const mainReadiness = await client.get('/readiness', { token, expectedStatus: 200 });
  assert(['no_data', 'limited_data', 'enough_data'].includes(mainReadiness.data.data.prediction.status), 'Valid readiness logic for main user prediction');
}

async function main() {
  const { server, baseUrl } = await startServer();
  const client = makeClient(baseUrl);
  let tempAccount = null;

  try {
    tempAccount = await validateTempRegistration(baseUrl);
    const token = await loginOrRegister(client);
    await validateAuth(client, token);
    await validateCategories(client, token);
    await validateProfile(client, token);
    await validateTransactions(client, token, tempAccount);
    await validateBudget(client, token);
    await validateDashboard(client, token);
    await validateReadiness(client, token, tempAccount);
    await client.post('/auth/logout', {}, { token });

    console.log('Baseline v2 E2E validation passed');
  } finally {
    if (tempAccount) {
      try {
        await tempAccount.tempClient.delete('/users/account', { token: tempAccount.token });
      } catch {
        // Best effort cleanup for temp registration account.
      }
    }
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error('Baseline v2 E2E validation failed');
  console.error(error.message);
  process.exit(1);
});
