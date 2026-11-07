// client/src/services/validation.js
// Form checks. Each validate* returns { isValid, errors } where errors is
// { fieldName: 'message' }. The Express API must repeat these checks (Phase 2).

import { parseDate } from './cashflow.js';

export const INSTALLMENT_STATUSES = ['pending', 'paid'];
export const FREQUENCIES = ['once', 'weekly', 'monthly'];

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

function isValidDate(value) {
  try {
    parseDate(String(value));
    return true;
  } catch {
    return false;
  }
}

function checkAmount(value, errors, key = 'amount', label = 'Amount') {
  if (isBlank(value)) {
    errors[key] = `${label} is required.`;
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) errors[key] = `${label} must be a number.`;
  else if (n <= 0) errors[key] = `${label} must be greater than 0.`;
  else if (n > 1000000) errors[key] = `${label} is too large.`;
  else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) errors[key] = `${label} can have at most 2 decimal places.`;
}

function checkDate(value, errors, key, label) {
  if (isBlank(value)) errors[key] = `${label} is required.`;
  else if (!isValidDate(value)) errors[key] = `${label} is not a valid date.`;
}

function checkText(value, errors, key, label, max = 60) {
  if (isBlank(value)) errors[key] = `${label} is required.`;
  else if (String(value).trim().length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
}

const result = (errors) => ({ isValid: Object.keys(errors).length === 0, errors });

export function validateInstallment(values) {
  const errors = {};
  checkText(values.provider, errors, 'provider', 'Provider');
  checkAmount(values.amount, errors);
  checkDate(values.dueDate, errors, 'dueDate', 'Due date');

  if (isBlank(values.remainingPayments)) {
    errors.remainingPayments = 'Remaining payments is required.';
  } else {
    const n = Number(values.remainingPayments);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      errors.remainingPayments = 'Remaining payments must be a whole number from 1 to 60.';
    }
  }

  if (!INSTALLMENT_STATUSES.includes(values.status)) errors.status = 'Choose a valid status.';
  return result(errors);
}

export function validateAllowance(values) {
  const errors = {};
  checkText(values.label, errors, 'label', 'Label');
  checkAmount(values.amount, errors);
  checkDate(values.expectedDate, errors, 'expectedDate', 'Expected date');
  if (!FREQUENCIES.includes(values.frequency)) errors.frequency = 'Choose a valid frequency.';
  return result(errors);
}

export function validateExpense(values) {
  const errors = {};
  checkAmount(values.amount, errors);
  checkDate(values.date, errors, 'date', 'Date');
  checkText(values.category, errors, 'category', 'Category', 40);
  return result(errors);
}

// Turns form strings into the types the API expects
export function normalizeInstallment(values) {
  return {
    provider: String(values.provider).trim(),
    amount: Number(values.amount),
    dueDate: values.dueDate,
    remainingPayments: Number(values.remainingPayments),
    status: values.status,
  };
}

// ---------- Settings (opening balance, reserve, horizon) ----------

function checkNonNegative(value, errors, key, label) {
  if (isBlank(value)) {
    errors[key] = `${label} is required.`;
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) errors[key] = `${label} must be a number.`;
  else if (n < 0) errors[key] = `${label} cannot be negative.`;
  else if (n > 10000000) errors[key] = `${label} is too large.`;
  else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) errors[key] = `${label} can have at most 2 decimal places.`;
}

export function validateSettings(values) {
  const errors = {};
  checkNonNegative(values.openingBalance, errors, 'openingBalance', 'Opening balance');
  checkNonNegative(values.reserveThreshold, errors, 'reserveThreshold', 'Reserve threshold');
  if (isBlank(values.planningHorizonDays)) {
    errors.planningHorizonDays = 'Planning horizon is required.';
  } else {
    const n = Number(values.planningHorizonDays);
    if (!Number.isInteger(n) || n < 7 || n > 180) {
      errors.planningHorizonDays = 'Planning horizon must be a whole number of days from 7 to 180.';
    }
  }
  return result(errors);
}

// ---------- Normalizers (form strings -> API types) ----------

export function normalizeAllowance(values) {
  return {
    label: String(values.label).trim(),
    amount: Number(values.amount),
    expectedDate: values.expectedDate,
    frequency: values.frequency,
  };
}

export function normalizeExpense(values) {
  return {
    amount: Number(values.amount),
    date: values.date,
    category: String(values.category).trim(),
    essential: Boolean(values.essential),
  };
}

export function normalizeSettings(values) {
  return {
    openingBalance: Number(values.openingBalance),
    reserveThreshold: Number(values.reserveThreshold),
    planningHorizonDays: Number(values.planningHorizonDays),
  };
}

// ---------- Simulator ----------

export function validateSimulation(values, today) {
  const errors = {};
  checkAmount(values.amount, errors, 'amount', 'Payment amount');
  if (isBlank(values.remainingPayments)) {
    errors.remainingPayments = 'Number of payments is required.';
  } else {
    const n = Number(values.remainingPayments);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      errors.remainingPayments = 'Number of payments must be a whole number from 1 to 60.';
    }
  }
  checkDate(values.dueDate, errors, 'dueDate', 'First payment date');
  if (!errors.dueDate && today && values.dueDate < today) {
    errors.dueDate = 'First payment date cannot be in the past.';
  }
  return result(errors);
}

export function normalizeSimulation(values) {
  return {
    amount: Number(values.amount),
    remainingPayments: Number(values.remainingPayments),
    dueDate: values.dueDate,
  };
}