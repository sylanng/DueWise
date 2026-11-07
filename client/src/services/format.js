// client/src/services/format.js
import { parseDate } from './cashflow.js';

export const formatPeso = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

// '2026-11-12' -> 'Nov 12, 2026'
export const formatDate = (str) =>
  parseDate(str).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

// '2026-11-12' -> 'Nov 12'
export const formatShortDate = (str) =>
  parseDate(str).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });