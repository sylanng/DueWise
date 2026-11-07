// server/src/services/cashflow.js
// Pure projection logic. No Express, no Firebase: easy to test and reuse.
// All dates are 'YYYY-MM-DD' strings and are handled in UTC, so results
// never shift by a day because of the server's timezone (e.g. PH = UTC+8).

// ---------- Date helpers ----------

function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new Error(`Invalid date: ${str}`);
  }
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject things like 2026-02-31 that JS silently rolls over
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${str}`);
  }
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(str, days) {
  const d = parseDate(str);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

// Adds months from the ORIGINAL day, clamping to month-end:
// Jan 31 -> Feb 28 -> Mar 31 (not Mar 28)
function addMonths(str, months) {
  const [y, m, d] = str.split('-').map(Number);
  parseDate(str); // validate
  const target = m - 1 + months;
  const daysInTarget = new Date(Date.UTC(y, target + 1, 0)).getUTCDate();
  return formatDate(new Date(Date.UTC(y, target, Math.min(d, daysInTarget))));
}

// ---------- Expanding records into dated cash events ----------

// An installment with remainingPayments = 3 becomes 3 monthly payments.
// Paid installments are ignored. remainingPayments defaults to 1.
function expandInstallments(installments, untilDate) {
  const events = [];
  for (const inst of installments) {
    if (inst.status === 'paid') continue;
    const count = inst.remainingPayments ?? 1;
    for (let i = 0; i < count; i++) {
      const dueDate = addMonths(inst.dueDate, i);
      if (dueDate > untilDate) break;
      events.push({ date: dueDate, amount: inst.amount });
    }
  }
  return events;
}

// frequency: 'once' (default), 'weekly', or 'monthly'
function expandAllowances(allowances, untilDate) {
  const events = [];
  for (const a of allowances) {
    const freq = a.frequency || 'once';
    if (freq === 'once') {
      if (a.expectedDate <= untilDate) {
        events.push({ date: a.expectedDate, amount: a.amount });
      }
      continue;
    }
    let i = 0;
    let date = a.expectedDate;
    while (date <= untilDate) {
      events.push({ date, amount: a.amount });
      i += 1;
      date = freq === 'weekly' ? addDays(a.expectedDate, 7 * i) : addMonths(a.expectedDate, i);
    }
  }
  return events;
}

function expenseEvents(expenses, untilDate) {
  return expenses
    .filter((e) => e.date <= untilDate)
    .map((e) => ({ date: e.date, amount: e.amount }));
}

const total = (events) => events.reduce((sum, e) => sum + e.amount, 0);

// ---------- Core formulas ----------

// ProjectedAvailable(t) = opening + inflows up to t - expenses up to t - installments up to t
function projectedBalance(opening, allowances, expenses, installments, date) {
  parseDate(date);
  return (
    opening +
    total(expandAllowances(allowances, date)) -
    total(expenseEvents(expenses, date)) -
    total(expandInstallments(installments, date))
  );
}

// ScenarioImpact(t) = Baseline(t) - Simulated(t)
function scenarioImpact(baseline, simulated) {
  return baseline - simulated;
}

// Reminder goes out 3 days before the due date
function reminderDate(dueDate) {
  return addDays(dueDate, -3);
}

// Warning only when STRICTLY below the reserve
function isBelowThreshold(balance, reserveThreshold) {
  return balance < reserveThreshold;
}

// ---------- Range helpers (used by dashboard and simulator) ----------

// The balance only changes on event dates, so the lowest point is either
// the start date or one of the event dates inside the range.
function lowestBalance(opening, allowances, expenses, installments, startDate, endDate) {
  const eventDates = [
    ...expandAllowances(allowances, endDate),
    ...expenseEvents(expenses, endDate),
    ...expandInstallments(installments, endDate),
  ]
    .map((e) => e.date)
    .filter((d) => d >= startDate);

  const candidates = [...new Set([startDate, ...eventDates])].sort();

  let lowest = null;
  for (const date of candidates) {
    const amount = projectedBalance(opening, allowances, expenses, installments, date);
    if (lowest === null || amount < lowest.amount) lowest = { date, amount };
  }
  return lowest;
}

// Compare the baseline against a hypothetical plan
// plan = { amount, dueDate, remainingPayments }
function simulatePlan({ opening, allowances, expenses, installments, reserveThreshold }, plan, startDate, endDate) {
  const baseline = lowestBalance(opening, allowances, expenses, installments, startDate, endDate);
  const simulatedInstallments = [
    ...installments,
    { ...plan, remainingPayments: plan.remainingPayments ?? 1, status: 'pending' },
  ];
  const simulated = lowestBalance(opening, allowances, expenses, simulatedInstallments, startDate, endDate);

  return {
    baseline,
    simulated,
    impact: scenarioImpact(baseline.amount, simulated.amount),
    baselineWarning: isBelowThreshold(baseline.amount, reserveThreshold),
    simulatedWarning: isBelowThreshold(simulated.amount, reserveThreshold),
  };
}

export {
  parseDate,
  addDays,
  addMonths,
  expandInstallments,
  expandAllowances,
  projectedBalance,
  scenarioImpact,
  reminderDate,
  isBelowThreshold,
  lowestBalance,
  simulatePlan,
};