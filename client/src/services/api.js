// client/src/services/api.js
// The ONLY file React pages use to get data.
//
// Mock mode (default in Phase 1): everything lives in memory, no server needed.
// Real mode (Phase 2): fill in `request()` and the `real` object below.
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

export const MOCK_MODE = import.meta.env?.VITE_MOCK_MODE !== 'false';

// Same idea as the errors the real API will return (400, 401, 404, ...)
export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function todayString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
    add: async (data) => {
      await delay();
      const record = { ...defaults(), ...clone(data), id: newId(prefix) };
      db[key].push(record);
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
// REAL IMPLEMENTATION (Phase 2)
// =====================================================================
// TODO Phase 2: build request() to call fetch(`${API_URL}${path}`) with the
// Firebase ID token in the Authorization header, then throw ApiError on
// 400 / 401 / network failures.

async function request(method, path, body) {
  throw new ApiError(`Real API is not connected yet (${method} ${path}). Set VITE_MOCK_MODE=true.`, 0);
}

const real = {
  getInstallments: () => request('GET', '/api/installments'),
  addInstallment: (data) => request('POST', '/api/installments', data),
  updateInstallment: (id, data) => request('PUT', `/api/installments/${id}`, data),
  deleteInstallment: (id) => request('DELETE', `/api/installments/${id}`),

  getAllowances: () => request('GET', '/api/allowances'),
  addAllowance: (data) => request('POST', '/api/allowances', data),
  // NOTE: these four routes are not in the project plan's endpoint table.
  // Phase 1 needs "records can be edited", so add them to the Express API too.
  updateAllowance: (id, data) => request('PUT', `/api/allowances/${id}`, data),
  deleteAllowance: (id) => request('DELETE', `/api/allowances/${id}`),
  getExpenses: () => request('GET', '/api/expenses'),
  addExpense: (data) => request('POST', '/api/expenses', data),
  updateExpense: (id, data) => request('PUT', `/api/expenses/${id}`, data),
  deleteExpense: (id) => request('DELETE', `/api/expenses/${id}`),

  getSettings: () => request('GET', '/api/settings'), // also not in the plan's table
  updateSettings: (patch) => request('PUT', '/api/settings', patch),

  getProjection: () => request('GET', '/api/projection'),
  simulate: (plan) => request('POST', '/api/simulate', plan),
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