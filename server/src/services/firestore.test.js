// server/src/services/firestore.test.js
// Tests firestore.js against a tiny fake Firestore that can fail on purpose,
// including the nasty case: the write really happens, but the call still reports an error.
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { createFirestoreStore } from './firestore.js';
import { withRetry, isTransient } from './retry.js';

const realWarn = console.warn;
before(() => { console.warn = () => {}; }); // keep test output quiet
after(() => { console.warn = realWarn; });

function createFakeDb() {
  const data = new Map(); // full path -> record
  const faults = []; // { op, code, afterCommit }
  let auto = 0;

  const maybeFail = (op, commit) => {
    const i = faults.findIndex((f) => f.op === op);
    if (i === -1) return;
    const fault = faults.splice(i, 1)[0];
    if (fault.afterCommit) commit?.(); // the write really happens...
    throw Object.assign(new Error(`${fault.code} simulated failure`), { code: fault.code }); // ...yet it reports failure
  };

  const docRef = (colPath, id) => {
    const path = `${colPath}/${id}`;
    return {
      id,
      collection: (name) => collRef(`${path}/${name}`),
      get: async () => {
        maybeFail('get');
        const d = data.get(path);
        return { exists: d !== undefined, id, data: () => (d ? { ...d } : undefined) };
      },
      set: async (value, opts) => {
        const commit = () => data.set(path, opts?.merge ? { ...(data.get(path) || {}), ...value } : { ...value });
        maybeFail('set', commit);
        commit();
      },
      update: async (value) => {
        const commit = () => data.set(path, { ...data.get(path), ...value });
        maybeFail('update', commit);
        commit();
      },
      delete: async () => {
        maybeFail('delete', () => data.delete(path));
        data.delete(path);
      },
    };
  };

  const collRef = (colPath) => ({
    doc: (id = `auto${++auto}`) => docRef(colPath, id),
    get: async () => {
      maybeFail('list');
      const docs = [...data.entries()]
        .filter(([p]) => p.startsWith(`${colPath}/`) && !p.slice(colPath.length + 1).includes('/'))
        .map(([p, d]) => ({ id: p.split('/').pop(), data: () => ({ ...d }) }));
      return { docs };
    },
  });

  return { collection: (name) => collRef(name), faults, size: () => data.size };
}

const fresh = () => {
  const db = createFakeDb();
  return { db, store: createFirestoreStore(db) };
};
const installment = { provider: 'Atome', amount: 800, dueDate: '2026-11-19', remainingPayments: 2, status: 'pending' };

// ---------- retry helper ----------
test('withRetry: retries transient errors, gives up on real ones', async () => {
  let calls = 0;
  const flaky = async () => { calls += 1; if (calls < 3) throw Object.assign(new Error('x'), { code: 14 }); return 'ok'; };
  assert.strictEqual(await withRetry(flaky, { baseDelayMs: 1 }), 'ok');
  assert.strictEqual(calls, 3);

  calls = 0;
  const denied = async () => { calls += 1; throw Object.assign(new Error('nope'), { code: 7 }); };
  await assert.rejects(withRetry(denied, { baseDelayMs: 1 }), { code: 7 });
  assert.strictEqual(calls, 1); // not retried

  calls = 0;
  const down = async () => { calls += 1; throw Object.assign(new Error('x'), { code: 14 }); };
  await assert.rejects(withRetry(down, { retries: 2, baseDelayMs: 1 }), { code: 14 });
  assert.strictEqual(calls, 3); // 1 try + 2 retries

  assert.strictEqual(isTransient(new Error('read ECONNRESET')), true);
  assert.strictEqual(isTransient(new Error('Getting metadata from plugin failed with error')), true);
  assert.strictEqual(isTransient(new Error('bad data')), false);
});

// ---------- store basics ----------
test('create, get, list, update, remove', async () => {
  const { store } = fresh();
  const created = await store.create('u1', 'installments', installment);
  assert.ok(created.id);
  assert.deepStrictEqual(await store.get('u1', 'installments', created.id), { id: created.id, ...installment });
  assert.strictEqual((await store.list('u1', 'installments')).length, 1);

  const updated = await store.update('u1', 'installments', created.id, { status: 'paid' });
  assert.strictEqual(updated.status, 'paid');
  assert.strictEqual(updated.provider, 'Atome');
  assert.strictEqual(await store.update('u1', 'installments', 'nope', { status: 'paid' }), null);

  assert.strictEqual(await store.remove('u1', 'installments', created.id), true);
  assert.strictEqual(await store.remove('u1', 'installments', created.id), false);
  assert.strictEqual((await store.list('u1', 'installments')).length, 0);
});

test('users are separated', async () => {
  const { store } = fresh();
  const a = await store.create('ua', 'installments', installment);
  assert.strictEqual((await store.list('ub', 'installments')).length, 0);
  assert.strictEqual(await store.get('ub', 'installments', a.id), null);
  assert.strictEqual(await store.remove('ub', 'installments', a.id), false);
});

test('settings: defaults, merge, separate per user', async () => {
  const { store } = fresh();
  assert.strictEqual((await store.getSettings('u1')).reserveThreshold, 500);
  const next = await store.updateSettings('u1', { openingBalance: 3000 });
  assert.strictEqual(next.openingBalance, 3000);
  assert.strictEqual(next.reserveThreshold, 500);
  assert.strictEqual((await store.getSettings('u2')).openingBalance, 0);
});

test('warmUp works', async () => {
  const { store } = fresh();
  await store.warmUp();
});

// ---------- the bug that doubled your allowance ----------
test('write that succeeds but reports an error is retried WITHOUT creating a duplicate', async () => {
  const { db, store } = fresh();
  db.faults.push({ op: 'set', code: 14, afterCommit: true });
  const created = await store.create('u1', 'allowances', { label: 'Baon', amount: 1000 }); // no key at all
  assert.ok(created.id);
  assert.strictEqual((await store.list('u1', 'allowances')).length, 1);
});

test('same Idempotency-Key twice = one record with the latest values', async () => {
  const { store } = fresh();
  await store.create('u1', 'allowances', { label: 'Baon', amount: 1000 }, { id: 'k_abcdefgh' });
  await store.create('u1', 'allowances', { label: 'Baon', amount: 1200 }, { id: 'k_abcdefgh' });
  const list = await store.list('u1', 'allowances');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].amount, 1200);
});

test('transient read failure is retried; permission errors are not', async () => {
  const { db, store } = fresh();
  const created = await store.create('u1', 'installments', installment);
  db.faults.push({ op: 'list', code: 14 });
  assert.strictEqual((await store.list('u1', 'installments')).length, 1);

  db.faults.push({ op: 'set', code: 7 });
  await assert.rejects(store.create('u1', 'installments', installment), { code: 7 });
  assert.strictEqual((await store.list('u1', 'installments')).length, 1); // nothing extra saved

  db.faults.push({ op: 'delete', code: 14, afterCommit: true });
  assert.strictEqual(await store.remove('u1', 'installments', created.id), true);
  assert.strictEqual((await store.list('u1', 'installments')).length, 0);
});