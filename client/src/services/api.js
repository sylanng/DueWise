// client/src/services/api.js
// The ONLY file React pages use to get data.
//
// Mock mode (VITE_MOCK_MODE=true, the default): everything lives in memory, no server needed.
// Real mode (VITE_MOCK_MODE=false): every call goes to our Express API (see `request()` below).
// Every function has the same name, arguments and return shape in both modes,
// so pages never change when you switch.
//
// Switch with client/.env:  VITE_MOCK_MODE=false

import {
  addDays,
  parseDate,
  projectedBalance,
  lowestBalance,
  simulatePlan,
  expandInstallments,
  reminderDate,
  isBelowThreshold,
} from './cashflow.js';
import { createSampleData } from '../data/sampleData.js';
import { getIdToken, notifyUnauthorized } from './authBridge.js';

export const MOCK_MODE = import.meta.env?.VITE_MOCK_MODE !== 'false';

// Same idea as the errors the real API will return (400, 401, 404, ...)
export class ApiError extends Error {
  constructor(message, status = 500, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = could not reach the server
    this.code = code;
    this.details = details; // { field: message } for validation errors
  }
}

export function todayString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// One random key per "Add" form. If the same form is saved twice (for example after a server
// error), the server sees the same key and updates one record instead of creating two.
export function newIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  );
}

const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

// =====================================================================
// MOCK IMPLEMENTATION
// =====================================================================

let db = createSampleData(todayString());
let nextId = 100;
const newId = (prefix) => `${prefix}_${nextId++}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms)); // lets you test loading states

// Generic list/add/update/remove for one collection
function makeCollection(key, prefix, defaults = () => ({})) {
  return {
    list: async () => {
      await delay();
      return clone(db[key]);
    },
    add: async (data, options) => {
      await delay();
      const id = options?.idempotencyKey ? `k_${options.idempotencyKey}` : newId(prefix);
      const record = { ...defaults(), ...clone(data), id };
      const existing = db[key].findIndex((r) => r.id === id);
      if (existing === -1) db[key].push(record);
      else db[key][existing] = record; // same key = same record (safe to retry)
      return clone(record);
    },
    update: async (id, data) => {
      await delay();
      const i = db[key].findIndex((r) => r.id === id);
      if (i === -1) throw new ApiError('Record not found.', 404);
      db[key][i] = { ...db[key][i], ...clone(data), id };
      return clone(db[key][i]);
    },
    remove: async (id) => {
      await delay();
      const i = db[key].findIndex((r) => r.id === id);
      if (i === -1) throw new ApiError('Record not found.', 404);
      db[key].splice(i, 1);
      return { id, deleted: true };
    },
  };
}

const installments = makeCollection('installments', 'inst', () => ({
  status: 'pending',
  remainingPayments: 1,
  calendarEventId: null,
  calendarSyncStatus: 'none',
}));
const allowances = makeCollection('allowances', 'allow', () => ({ frequency: 'once' }));
const expenses = makeCollection('expenses', 'exp', () => ({ essential: true }));

function projectionInputs() {
  const { openingBalance, reserveThreshold, planningHorizonDays } = db.settings;
  const today = todayString();
  return {
    opening: openingBalance,
    allowances: db.allowances,
    expenses: db.expenses,
    installments: db.installments,
    reserveThreshold,
    today,
    end: addDays(today, planningHorizonDays),
  };
}

// Daily balance from `today` to `end`
function buildTimeline(opening, allowances, expenses, installments, today, end) {
  const timeline = [];
  for (let d = 0; d <= daysBetween(today, end); d++) {
    const date = addDays(today, d);
    timeline.push({ date, balance: projectedBalance(opening, allowances, expenses, installments, date) });
  }
  return timeline;
}

const mock = {
  // ----- Installments -----
  getInstallments: installments.list,
  addInstallment: installments.add,
  updateInstallment: installments.update,
  deleteInstallment: installments.remove,

  // ----- Allowances and expenses -----
  getAllowances: allowances.list,
  addAllowance: allowances.add,
  updateAllowance: allowances.update,
  deleteAllowance: allowances.remove,
  getExpenses: expenses.list,
  addExpense: expenses.add,
  updateExpense: expenses.update,
  deleteExpense: expenses.remove,

  // ----- Settings -----
  getSettings: async () => {
    await delay();
    return clone(db.settings);
  },
  updateSettings: async (patch) => {
    await delay();
    db.settings = { ...db.settings, ...clone(patch) };
    return clone(db.settings);
  },

  // ----- Projection -----
  // Recalculated from the current data on every call, so any add/edit/delete
  // is reflected the next time the dashboard asks.
  getProjection: async () => {
    await delay();
    const { opening, allowances: a, expenses: e, installments: i, reserveThreshold, today, end } = projectionInputs();

    const timeline = buildTimeline(opening, a, e, i, today, end);

    const lowest = lowestBalance(opening, a, e, i, today, end);
    const firstWarning = timeline.find((p) => isBelowThreshold(p.balance, reserveThreshold));

    // Every payment coming due inside the horizon, soonest first
    const upcomingDue = db.installments
      .flatMap((inst) =>
        expandInstallments([inst], end)
          .filter((p) => p.date >= today)
          .map((p) => ({
            installmentId: inst.id,
            provider: inst.provider,
            amount: p.amount,
            dueDate: p.date,
            daysUntil: daysBetween(today, p.date),
            reminderDate: reminderDate(p.date),
          }))
      )
      .sort((x, y) => x.dueDate.localeCompare(y.dueDate));

    return {
      asOf: today,
      horizonEnd: end,
      reserveThreshold,
      currentBalance: timeline[0].balance,
      endBalance: timeline[timeline.length - 1].balance,
      lowest, // { date, amount }
      warning: Boolean(firstWarning),
      firstWarningDate: firstWarning ? firstWarning.date : null,
      upcomingDue,
      timeline,
    };
  },

  // ----- Simulator -----
  // plan = { amount, dueDate, remainingPayments }
  // Returns the lowest balance with and without the plan, plus a daily timeline
  // for each so the page can draw both lines.
  simulate: async (plan) => {
    await delay();
    if (!plan || !(Number(plan.amount) > 0)) throw new ApiError('Amount must be greater than 0.', 400);
    if (!plan.dueDate) throw new ApiError('Start date is required.', 400);
    const payments = Number(plan.remainingPayments ?? 1);
    if (!Number.isInteger(payments) || payments < 1) {
      throw new ApiError('Number of payments must be a whole number of at least 1.', 400);
    }

    const { opening, allowances: a, expenses: e, installments: i, reserveThreshold, today, end } = projectionInputs();
    if (plan.dueDate < today) throw new ApiError('First payment date cannot be in the past.', 400);

    const clean = { amount: Number(plan.amount), dueDate: plan.dueDate, remainingPayments: payments };
    const result = simulatePlan({ opening, allowances: a, expenses: e, installments: i, reserveThreshold }, clean, today, end);
    const simulatedInstallments = [...i, { ...clean, status: 'pending' }];

    return {
      ...result,
      reserveThreshold,
      asOf: today,
      horizonEnd: end,
      baselineTimeline: buildTimeline(opening, a, e, i, today, end),
      simulatedTimeline: buildTimeline(opening, a, e, simulatedInstallments, today, end),
    };
  },
};

// Handy for testing: restore the sample data
export function resetMockData() {
  db = createSampleData(todayString());
  nextId = 100;
}

// =====================================================================
// REAL IMPLEMENTATION: calls our Express API
// =====================================================================

const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

// Sends one request with the Firebase ID token. Throws ApiError for anything that goes wrong:
//   status 0   server unreachable (offline, or a free host that is still waking up)
//   status 401 not signed in / session expired (also tells AuthContext to sign out)
//   status 400 validation failed (error.details has the per-field messages)
async function request(method, path, body, extraHeaders) {
  let idToken = null;
  try {
    idToken = await getIdToken();
  } catch {
    idToken = null;
  }
  if (!idToken) {
    notifyUnauthorized();
    throw new ApiError('Please sign in to continue.', 401, 'auth/missing-token');
  }

  const headers = { Accept: 'application/json', Authorization: `Bearer ${idToken}`, ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'network');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null; // empty or non-JSON body
  }

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized();
    throw new ApiError(data?.message || `Request failed (${response.status}).`, response.status, data?.code, data?.details);
  }
  return data;
}

const idem = (options) => (options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined);

const real = {
  getInstallments: () => request('GET', '/api/installments'),
  addInstallment: (data, options) => request('POST', '/api/installments', data, idem(options)),
  updateInstallment: (id, data) => request('PUT', `/api/installments/${id}`, data),
  deleteInstallment: (id) => request('DELETE', `/api/installments/${id}`),

  getAllowances: () => request('GET', '/api/allowances'),
  addAllowance: (data, options) => request('POST', '/api/allowances', data, idem(options)),
  updateAllowance: (id, data) => request('PUT', `/api/allowances/${id}`, data),
  deleteAllowance: (id) => request('DELETE', `/api/allowances/${id}`),
  getExpenses: () => request('GET', '/api/expenses'),
  addExpense: (data, options) => request('POST', '/api/expenses', data, idem(options)),
  updateExpense: (id, data) => request('PUT', `/api/expenses/${id}`, data),
  deleteExpense: (id) => request('DELETE', `/api/expenses/${id}`),

  getSettings: () => request('GET', '/api/settings'),
  updateSettings: (patch) => request('PUT', '/api/settings', patch),

  // The browser's local date is sent so "today" matches the user's timezone (the server runs in UTC)
  getProjection: () => request('GET', `/api/projection?today=${todayString()}`),
  simulate: (plan) => request('POST', '/api/simulate', { ...plan, today: todayString() }),
};

// =====================================================================
// What pages import
// =====================================================================

const impl = MOCK_MODE ? mock : real;

export const {
  getInstallments,
  addInstallment,
  updateInstallment,
  deleteInstallment,
  getAllowances,
  addAllowance,
  updateAllowance,
  deleteAllowance,
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getSettings,
  updateSettings,
  getProjection,
  simulate,
} = impl;