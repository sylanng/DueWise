// server/src/api.test.js
// Starts the real Express app with a fake sign-in check and an in-memory store,
// then calls it over HTTP. Run with: node --test
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { createApp } from './createApp.js';
import { createMemoryStore } from './services/memoryStore.js';

// Fake Firebase: tokens like "user-a" are valid, "expired" is expired, anything else is invalid
async function verifyIdToken(token) {
  if (token === 'expired') throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' });
  if (!token.startsWith('user-')) throw Object.assign(new Error('bad'), { code: 'auth/argument-error' });
  return { uid: token, email: `${token}@test.dev` };
}

let server;
let base;

before(async () => {
  const app = createApp({
    verifyIdToken,
    store: createMemoryStore(),
    allowedOrigins: ['http://localhost:5173'],
  });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json, headers: res.headers };
}

const goodInstallment = { provider: 'Atome', amount: 800, dueDate: '2026-11-19', remainingPayments: 2 };

// ---------- auth ----------
test('health is public', async () => {
  const r = await call('GET', '/api/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.status, 'ok');
});

test('protected routes need a valid token (401)', async () => {
  assert.strictEqual((await call('GET', '/api/installments')).status, 401);
  const bad = await call('GET', '/api/installments', { token: 'nonsense' });
  assert.strictEqual(bad.status, 401);
  assert.strictEqual(bad.json.code, 'auth/invalid-token');
  const expired = await call('GET', '/api/installments', { token: 'expired' });
  assert.strictEqual(expired.status, 401);
  assert.strictEqual(expired.json.code, 'auth/id-token-expired');
  assert.match(expired.json.message, /expired/i);
  assert.strictEqual((await call('GET', '/api/projection')).status, 401);
  assert.strictEqual((await call('POST', '/api/simulate', { body: {} })).status, 401);
});

// ---------- installments CRUD + validation ----------
test('installments: create, list, edit, delete', async () => {
  const token = 'user-crud';
  const created = await call('POST', '/api/installments', { token, body: goodInstallment });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.json.status, 'pending'); // default
  assert.strictEqual(created.json.calendarEventId, null);
  assert.strictEqual(created.json.calendarSyncStatus, 'none');
  const id = created.json.id;

  const list = await call('GET', '/api/installments', { token });
  assert.strictEqual(list.json.length, 1);

  // partial update (what "Mark paid" sends)
  const paid = await call('PUT', `/api/installments/${id}`, { token, body: { status: 'paid' } });
  assert.strictEqual(paid.status, 200);
  assert.strictEqual(paid.json.status, 'paid');
  assert.strictEqual(paid.json.provider, 'Atome'); // untouched

  const del = await call('DELETE', `/api/installments/${id}`, { token });
  assert.deepStrictEqual(del.json, { id, deleted: true });
  assert.strictEqual((await call('GET', '/api/installments', { token })).json.length, 0);
  assert.strictEqual((await call('DELETE', `/api/installments/${id}`, { token })).status, 404);
});

test('installments: invalid input returns 400 with clear messages', async () => {
  const token = 'user-invalid';
  const empty = await call('POST', '/api/installments', { token, body: {} });
  assert.strictEqual(empty.status, 400);
  assert.match(empty.json.message, /Provider is required/);
  assert.match(empty.json.message, /Amount is required/);
  assert.ok(empty.json.details.dueDate);

  const bad = await call('POST', '/api/installments', {
    token,
    body: { provider: 'X', amount: -5, dueDate: '2026-02-31', remainingPayments: 1.5, status: 'maybe' },
  });
  assert.strictEqual(bad.status, 400);
  assert.deepStrictEqual(Object.keys(bad.json.details).sort(), ['amount', 'dueDate', 'remainingPayments', 'status']);

  // numbers as strings are rejected (the server is strict)
  const str = await call('POST', '/api/installments', { token, body: { ...goodInstallment, amount: '800' } });
  assert.strictEqual(str.status, 400);
  const decimals = await call('POST', '/api/installments', { token, body: { ...goodInstallment, amount: 10.123 } });
  assert.match(decimals.json.message, /2 decimal/);

  assert.strictEqual((await call('GET', '/api/installments', { token })).json.length, 0); // nothing saved
});

test('unknown fields cannot be written (cannot fake a calendar event)', async () => {
  const token = 'user-strip';
  const r = await call('POST', '/api/installments', {
    token,
    body: { ...goodInstallment, calendarEventId: 'hacked', calendarSyncStatus: 'synced', isAdmin: true },
  });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.calendarEventId, null);
  assert.strictEqual(r.json.isAdmin, undefined);
  const put = await call('PUT', `/api/installments/${r.json.id}`, { token, body: { calendarEventId: 'hacked' } });
  assert.strictEqual(put.status, 400); // nothing valid to update
});

test('users cannot see or change each other\'s data', async () => {
  const a = await call('POST', '/api/installments', { token: 'user-a', body: goodInstallment });
  const id = a.json.id;
  assert.strictEqual((await call('GET', '/api/installments', { token: 'user-b' })).json.length, 0);
  assert.strictEqual((await call('PUT', `/api/installments/${id}`, { token: 'user-b', body: { status: 'paid' } })).status, 404);
  assert.strictEqual((await call('DELETE', `/api/installments/${id}`, { token: 'user-b' })).status, 404);
  assert.strictEqual((await call('GET', '/api/installments', { token: 'user-a' })).json[0].status, 'pending');
});

test('weird ids return 404, not a crash', async () => {
  const r = await call('DELETE', '/api/installments/..%2F..%2Fusers', { token: 'user-a' });
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await call('PUT', '/api/installments/__x__!', { token: 'user-a', body: { status: 'paid' } })).status, 404);
});

// ---------- allowances, expenses, settings ----------
test('allowances and expenses: defaults and validation', async () => {
  const token = 'user-ae';
  const al = await call('POST', '/api/allowances', { token, body: { label: 'Baon', amount: 4000, expectedDate: '2026-11-16' } });
  assert.strictEqual(al.status, 201);
  assert.strictEqual(al.json.frequency, 'once');
  assert.strictEqual((await call('POST', '/api/allowances', { token, body: { label: '', amount: 0, expectedDate: 'x', frequency: 'daily' } })).status, 400);

  const ex = await call('POST', '/api/expenses', { token, body: { amount: 120, date: '2026-11-08', category: ' Food ' } });
  assert.strictEqual(ex.status, 201);
  assert.strictEqual(ex.json.essential, true);
  assert.strictEqual(ex.json.category, 'Food'); // trimmed
  const edited = await call('PUT', `/api/expenses/${ex.json.id}`, { token, body: { amount: 150 } });
  assert.strictEqual(edited.json.amount, 150);
  assert.strictEqual((await call('POST', '/api/expenses', { token, body: { amount: 5, date: '2026-11-08' } })).status, 400);
});

test('settings: defaults, partial update, validation', async () => {
  const token = 'user-settings';
  const first = await call('GET', '/api/settings', { token });
  assert.strictEqual(first.json.reserveThreshold, 500);
  assert.strictEqual(first.json.planningHorizonDays, 30);
  const upd = await call('PUT', '/api/settings', { token, body: { openingBalance: 3000, planningHorizonDays: 45 } });
  assert.strictEqual(upd.json.openingBalance, 3000);
  assert.strictEqual(upd.json.planningHorizonDays, 45);
  assert.strictEqual(upd.json.reserveThreshold, 500); // untouched
  const bad = await call('PUT', '/api/settings', { token, body: { planningHorizonDays: 3, reserveThreshold: -1 } });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await call('GET', '/api/settings', { token })).json.planningHorizonDays, 45);
});

// ---------- projection and simulate (same numbers as the client's mock mode) ----------
async function seedSample(token) {
  await call('PUT', '/api/settings', { token, body: { openingBalance: 3000, reserveThreshold: 500, planningHorizonDays: 30 } });
  await call('POST', '/api/allowances', { token, body: { label: 'Monthly allowance', amount: 4000, expectedDate: '2026-11-16', frequency: 'monthly' } });
  for (const [amount, date, category] of [[350, '2026-11-05', 'Food'], [120, '2026-11-08', 'Transport'], [400, '2026-11-13', 'Projects'], [250, '2026-11-21', 'Leisure']]) {
    await call('POST', '/api/expenses', { token, body: { amount, date, category } });
  }
  for (const [provider, amount, dueDate, remainingPayments] of [['SPayLater', 450, '2026-11-12', 3], ['Atome', 800, '2026-11-19', 2], ['GGives', 1200, '2026-11-27', 4]]) {
    await call('POST', '/api/installments', { token, body: { provider, amount, dueDate, remainingPayments } });
  }
}

test('projection: correct numbers, shape and today handling', async () => {
  const token = 'user-proj';
  await seedSample(token);
  const r = await call('GET', '/api/projection?today=2026-11-07', { token });
  assert.strictEqual(r.status, 200);
  const p = r.json;
  assert.strictEqual(p.currentBalance, 2650);
  assert.deepStrictEqual(p.lowest, { date: '2026-11-13', amount: 1680 });
  assert.strictEqual(p.endBalance, 3430);
  assert.strictEqual(p.warning, false);
  assert.strictEqual(p.firstWarningDate, null);
  assert.strictEqual(p.horizonEnd, '2026-12-07');
  assert.strictEqual(p.timeline.length, 31);
  assert.deepStrictEqual(p.upcomingDue.map((u) => [u.provider, u.dueDate, u.daysUntil]), [
    ['SPayLater', '2026-11-12', 5], ['Atome', '2026-11-19', 12], ['GGives', '2026-11-27', 20],
  ]);
  assert.strictEqual(p.upcomingDue[0].reminderDate, '2026-11-09');
  assert.strictEqual((await call('GET', '/api/projection?today=nope', { token })).status, 400);
  assert.strictEqual((await call('GET', '/api/projection', { token })).status, 200); // server date fallback

  // raising the reserve triggers the warning
  await call('PUT', '/api/settings', { token, body: { reserveThreshold: 2500 } });
  const warn = (await call('GET', '/api/projection?today=2026-11-07', { token })).json;
  assert.strictEqual(warn.warning, true);
  assert.strictEqual(warn.firstWarningDate, '2026-11-12'); // Nov 8 is 2,530 (still above 2,500); SPayLater on Nov 12 drops it to 2,080

  // marking an installment paid removes it from the projection
  const list = (await call('GET', '/api/installments', { token })).json;
  const ggives = list.find((i) => i.provider === 'GGives');
  await call('PUT', `/api/installments/${ggives.id}`, { token, body: { status: 'paid' } });
  const after = (await call('GET', '/api/projection?today=2026-11-07', { token })).json;
  assert.strictEqual(after.upcomingDue.some((u) => u.provider === 'GGives'), false);
  assert.strictEqual(after.endBalance, 3430 + 1200);
});

test('projection of a brand-new user does not crash', async () => {
  const r = await call('GET', '/api/projection?today=2026-11-07', { token: 'user-new' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.currentBalance, 0);
  assert.strictEqual(r.json.warning, true); // 0 is below the default 500 reserve
});

test('simulate: risky plan, safe plan, validation, no side effects', async () => {
  const token = 'user-sim';
  await seedSample(token);
  const risky = await call('POST', '/api/simulate', { token, body: { amount: 1500, remainingPayments: 3, dueDate: '2026-11-07', today: '2026-11-07' } });
  assert.strictEqual(risky.status, 200);
  assert.strictEqual(risky.json.baseline.amount, 1680);
  assert.strictEqual(risky.json.simulated.amount, 180);
  assert.strictEqual(risky.json.impact, 1500);
  assert.strictEqual(risky.json.simulatedWarning, true);
  assert.strictEqual(risky.json.baselineWarning, false);
  assert.strictEqual(risky.json.simulatedTimeline.length, 31);

  const safe = await call('POST', '/api/simulate', { token, body: { amount: 300, dueDate: '2026-11-08', today: '2026-11-07' } });
  assert.strictEqual(safe.json.simulated.amount, 1380);
  assert.strictEqual(safe.json.simulatedWarning, false);

  const past = await call('POST', '/api/simulate', { token, body: { amount: 300, dueDate: '2026-11-01', today: '2026-11-07' } });
  assert.strictEqual(past.status, 400);
  assert.match(past.json.message, /past/);
  assert.strictEqual((await call('POST', '/api/simulate', { token, body: { amount: -1, dueDate: '2026-11-08', today: '2026-11-07' } })).status, 400);

  assert.strictEqual((await call('GET', '/api/installments', { token })).json.length, 3); // nothing was saved
});

// ---------- plumbing ----------
test('bad JSON, unknown routes, and CORS', async () => {
  const badJson = await call('POST', '/api/installments', { token: 'user-a', raw: '{not json' });
  assert.strictEqual(badJson.status, 400);
  assert.match(badJson.json.message, /JSON/);

  const unknown = await call('GET', '/api/nope', { token: 'user-a' });
  assert.strictEqual(unknown.status, 404);

  const ok = await call('GET', '/api/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.strictEqual(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const evil = await call('GET', '/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.strictEqual(evil.headers.get('access-control-allow-origin'), null);

  const pre = await call('OPTIONS', '/api/installments', {
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,x-google-access-token,idempotency-key' },
  });
  assert.ok(pre.status === 204 || pre.status === 200);
  assert.match(pre.headers.get('access-control-allow-headers').toLowerCase(), /authorization/);
  assert.match(pre.headers.get('access-control-allow-headers').toLowerCase(), /x-google-access-token/);
  assert.match(pre.headers.get('access-control-allow-headers').toLowerCase(), /idempotency-key/);
});

// ---------- no duplicates when the same form is saved twice ----------
test('POST with the same Idempotency-Key updates one record instead of duplicating', async () => {
  const token = 'user-idem';
  const key = '11111111-2222-3333-4444-555555555555';
  const body = { label: 'Baon', amount: 1000, expectedDate: '2026-11-08', frequency: 'weekly' };

  const first = await call('POST', '/api/allowances', { token, body, headers: { 'Idempotency-Key': key } });
  const second = await call('POST', '/api/allowances', { token, body: { ...body, amount: 1200 }, headers: { 'Idempotency-Key': key } });
  assert.strictEqual(first.status, 201);
  assert.strictEqual(second.status, 201);
  assert.strictEqual(second.json.id, first.json.id);

  const list = (await call('GET', '/api/allowances', { token })).json;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].amount, 1200); // the latest values win

  // a new form (new key) is a new record; no key behaves as before
  await call('POST', '/api/allowances', { token, body, headers: { 'Idempotency-Key': 'aaaaaaaa-bbbb-cccc' } });
  await call('POST', '/api/allowances', { token, body });
  assert.strictEqual((await call('GET', '/api/allowances', { token })).json.length, 3);

  // the same key from another user is a separate record in their own space
  await call('POST', '/api/allowances', { token: 'user-idem-2', body, headers: { 'Idempotency-Key': key } });
  assert.strictEqual((await call('GET', '/api/allowances', { token: 'user-idem-2' })).json.length, 1);
  assert.strictEqual((await call('GET', '/api/allowances', { token })).json.length, 3);
});

test('a bad Idempotency-Key is rejected and nothing is saved', async () => {
  const token = 'user-idem-bad';
  const body = { label: 'Baon', amount: 1000, expectedDate: '2026-11-08' };
  assert.strictEqual((await call('POST', '/api/allowances', { token, body, headers: { 'Idempotency-Key': 'x' } })).status, 400);
  assert.strictEqual((await call('POST', '/api/allowances', { token, body, headers: { 'Idempotency-Key': 'has spaces in it!!' } })).status, 400);
  assert.strictEqual((await call('GET', '/api/allowances', { token })).json.length, 0);
});