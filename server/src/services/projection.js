// server/src/services/projection.js
// Builds the JSON the dashboard and simulator read. The response shapes here
// match the client's mock mode exactly (client/src/services/api.js).

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

const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

function buildTimeline(opening, allowances, expenses, installments, today, end) {
  const timeline = [];
  for (let d = 0; d <= daysBetween(today, end); d++) {
    const date = addDays(today, d);
    timeline.push({ date, balance: projectedBalance(opening, allowances, expenses, installments, date) });
  }
  return timeline;
}

export function buildProjection({ settings, allowances, expenses, installments, today }) {
  const { openingBalance: opening, reserveThreshold, planningHorizonDays } = settings;
  const end = addDays(today, planningHorizonDays);

  const timeline = buildTimeline(opening, allowances, expenses, installments, today, end);
  const lowest = lowestBalance(opening, allowances, expenses, installments, today, end);
  const firstWarning = timeline.find((p) => isBelowThreshold(p.balance, reserveThreshold));

  const upcomingDue = installments
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
    lowest,
    warning: Boolean(firstWarning),
    firstWarningDate: firstWarning ? firstWarning.date : null,
    upcomingDue,
    timeline,
  };
}

// plan = { amount, dueDate, remainingPayments }
export function buildSimulation({ settings, allowances, expenses, installments, today, plan }) {
  const { openingBalance: opening, reserveThreshold, planningHorizonDays } = settings;
  const end = addDays(today, planningHorizonDays);

  const result = simulatePlan({ opening, allowances, expenses, installments, reserveThreshold }, plan, today, end);
  const simulatedInstallments = [...installments, { ...plan, status: 'pending' }];

  return {
    ...result,
    reserveThreshold,
    asOf: today,
    horizonEnd: end,
    baselineTimeline: buildTimeline(opening, allowances, expenses, installments, today, end),
    simulatedTimeline: buildTimeline(opening, allowances, expenses, simulatedInstallments, today, end),
  };
}