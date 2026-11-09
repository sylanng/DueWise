// server/src/services/validation.js
// The server never trusts the client: every body is checked here, unknown
// fields are dropped, and values are cleaned before they reach Firestore.

import { parseDate } from './cashflow.js';
import { ApiError } from '../middleware/errorHandler.js';

// ---- rules: each has a label, check(value) -> error message or null, clean(value) ----
const text = (label, max) => ({
  label,
  check: (v) =>
    typeof v !== 'string' || v.trim() === ''
      ? `${label} is required.`
      : v.trim().length > max
        ? `${label} must be ${max} characters or fewer.`
        : null,
  clean: (v) => v.trim(),
});

const money = (label, { allowZero = false, max = 1000000 } = {}) => ({
  label,
  check: (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return `${label} must be a number.`;
    if (allowZero ? v < 0 : v <= 0) return allowZero ? `${label} cannot be negative.` : `${label} must be greater than 0.`;
    if (v > max) return `${label} is too large.`;
    if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) return `${label} can have at most 2 decimal places.`;
    return null;
  },
  clean: (v) => v,
});

const date = (label) => ({
  label,
  check: (v) => {
    try {
      parseDate(v);
      return null;
    } catch {
      return `${label} must be a valid date (YYYY-MM-DD).`;
    }
  },
  clean: (v) => v,
});

const integer = (label, min, max) => ({
  label,
  check: (v) =>
    !Number.isInteger(v) || v < min || v > max ? `${label} must be a whole number from ${min} to ${max}.` : null,
  clean: (v) => v,
});

const oneOf = (label, options) => ({
  label,
  check: (v) => (options.includes(v) ? null : `${label} must be one of: ${options.join(', ')}.`),
  clean: (v) => v,
});

const bool = (label) => ({
  label,
  check: (v) => (typeof v === 'boolean' ? null : `${label} must be true or false.`),
  clean: (v) => v,
});

// ---- schemas (field names match the Firestore model) ----
export const installmentSchema = {
  provider: text('Provider', 60),
  amount: money('Amount'),
  dueDate: date('Due date'),
  remainingPayments: integer('Remaining payments', 1, 60),
  status: oneOf('Status', ['pending', 'paid']),
};
export const installmentDefaults = { remainingPayments: 1, status: 'pending' };

export const allowanceSchema = {
  label: text('Label', 60),
  amount: money('Amount'),
  expectedDate: date('Expected date'),
  frequency: oneOf('Frequency', ['once', 'weekly', 'monthly']),
};
export const allowanceDefaults = { frequency: 'once' };

export const expenseSchema = {
  amount: money('Amount'),
  date: date('Date'),
  category: text('Category', 40),
  essential: bool('Essential'),
};
export const expenseDefaults = { essential: true };

export const settingsSchema = {
  openingBalance: money('Opening balance', { allowZero: true, max: 10000000 }),
  reserveThreshold: money('Reserve threshold', { allowZero: true, max: 10000000 }),
  planningHorizonDays: integer('Planning horizon', 7, 180),
  notifyOnAdd: bool('Notify on add'),
  notifyDueSoon: bool('Notify when due soon'),
};

export const simulationSchema = {
  amount: money('Payment amount'),
  remainingPayments: integer('Number of payments', 1, 60),
  dueDate: date('First payment date'),
};
export const simulationDefaults = { remainingPayments: 1 };

// ---- the validator ----
// create (default): required fields must be present, defaults fill the gaps
// partial: only the fields that were sent are checked (used by PUT)
// Returns the cleaned value, or throws ApiError(400) listing every problem.
export function validate(schema, body, { partial = false, defaults = {} } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.', 'validation/failed');
  }

  const errors = {};
  const value = {};

  for (const [key, rule] of Object.entries(schema)) {
    let v = body[key];
    if (v === undefined) {
      if (partial) continue;
      if (key in defaults) v = defaults[key];
      else {
        errors[key] = `${rule.label} is required.`;
        continue;
      }
    }
    if (v === null) {
      errors[key] = `${rule.label} is required.`;
      continue;
    }
    const problem = rule.check(v);
    if (problem) errors[key] = problem;
    else value[key] = rule.clean(v);
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, Object.values(errors).join(' '), 'validation/failed', errors);
  }
  if (partial && Object.keys(value).length === 0) {
    throw new ApiError(400, 'Nothing to update.', 'validation/failed');
  }
  return value;
}

// 'YYYY-MM-DD' from the client's local clock, so "today" matches the user's timezone
// (the server runs in UTC). Falls back to the server's date.
export function resolveToday(input) {
  if (input === undefined) return new Date().toISOString().slice(0, 10);
  try {
    parseDate(input);
    return input;
  } catch {
    throw new ApiError(400, 'today must be a valid date (YYYY-MM-DD).', 'validation/failed');
  }
}