// server/src/services/cashflow.test.js
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert';
import {
  projectedBalance,
  scenarioImpact,
  reminderDate,
  isBelowThreshold,
  addMonths,
  lowestBalance,
  simulatePlan,
} from './cashflow.js';

test('2000 baseline minus 600 installment = 1400', () => {
  const result = projectedBalance(2000, [], [], [{ amount: 600, dueDate: '2026-11-20' }], '2026-11-20');
  assert.strictEqual(result, 1400);
});

test('no installments and no expenses: balance equals opening + allowance', () => {
  assert.strictEqual(projectedBalance(1500, [], [], [], '2026-11-30'), 1500);
  const allowances = [{ amount: 500, expectedDate: '2026-11-10', frequency: 'once' }];
  assert.strictEqual(projectedBalance(1500, allowances, [], [], '2026-11-30'), 2000);
});

test('multiple installments on the same day are all deducted', () => {
  const installments = [
    { amount: 500, dueDate: '2026-11-15' },
    { amount: 700, dueDate: '2026-11-15' },
  ];
  assert.strictEqual(projectedBalance(3000, [], [], installments, '2026-11-15'), 1800);
});

test('items after the chosen date are not counted', () => {
  const installments = [{ amount: 600, dueDate: '2026-11-20' }];
  assert.strictEqual(projectedBalance(2000, [], [], installments, '2026-11-19'), 2000);
});

test('expenses are deducted', () => {
  const expenses = [{ amount: 250, date: '2026-11-08' }];
  assert.strictEqual(projectedBalance(1000, [], expenses, [], '2026-11-08'), 750);
});

test('multi-payment installment recurs monthly with month-end clamping', () => {
  assert.strictEqual(addMonths('2027-01-31', 1), '2027-02-28');
  assert.strictEqual(addMonths('2027-01-31', 2), '2027-03-31');
  const installments = [{ amount: 100, dueDate: '2027-01-31', remainingPayments: 3 }];
  assert.strictEqual(projectedBalance(1000, [], [], installments, '2027-02-28'), 800);
  assert.strictEqual(projectedBalance(1000, [], [], installments, '2027-03-31'), 700);
});

test('paid installments are ignored', () => {
  const installments = [{ amount: 600, dueDate: '2026-11-20', status: 'paid' }];
  assert.strictEqual(projectedBalance(2000, [], [], installments, '2026-11-30'), 2000);
});

test('weekly and monthly allowances repeat', () => {
  const weekly = [{ amount: 500, expectedDate: '2026-11-02', frequency: 'weekly' }];
  assert.strictEqual(projectedBalance(0, weekly, [], [], '2026-11-22'), 1500); // Nov 2, 9, 16
  const monthly = [{ amount: 5000, expectedDate: '2026-11-01', frequency: 'monthly' }];
  assert.strictEqual(projectedBalance(0, monthly, [], [], '2026-12-31'), 10000); // Nov 1, Dec 1
});

test('reminder date is due minus 3 days, across month, year and leap boundaries', () => {
  assert.strictEqual(reminderDate('2026-12-02'), '2026-11-29');
  assert.strictEqual(reminderDate('2027-03-02'), '2027-02-27'); // non-leap February
  assert.strictEqual(reminderDate('2028-03-02'), '2028-02-28'); // leap year
  assert.strictEqual(reminderDate('2027-01-02'), '2026-12-30'); // year boundary
  assert.strictEqual(reminderDate('2026-11-30'), '2026-11-27'); // month-end due date
});

test('threshold: balance exactly equal to reserve gives no warning', () => {
  assert.strictEqual(isBelowThreshold(500, 500), false);
  assert.strictEqual(isBelowThreshold(499.99, 500), true);
  assert.strictEqual(isBelowThreshold(800, 500), false);
});

test('scenarioImpact = baseline - simulated', () => {
  assert.strictEqual(scenarioImpact(2000, 1400), 600);
});

test('lowestBalance finds the lowest point in the range', () => {
  const expenses = [{ amount: 500, date: '2026-11-10' }];
  const installments = [{ amount: 600, dueDate: '2026-11-20' }];
  const low = lowestBalance(2000, [], expenses, installments, '2026-11-07', '2026-12-31');
  assert.deepStrictEqual(low, { date: '2026-11-20', amount: 900 });
});

test('simulated plan dips below the threshold while the baseline does not', () => {
  const base = {
    opening: 2000,
    allowances: [],
    expenses: [{ amount: 500, date: '2026-11-10' }],
    installments: [{ amount: 600, dueDate: '2026-11-20' }],
    reserveThreshold: 500,
  };
  const plan = { amount: 400, dueDate: '2026-11-15', remainingPayments: 3 };
  const result = simulatePlan(base, plan, '2026-11-07', '2026-12-31');

  assert.strictEqual(result.baseline.amount, 900);
  assert.deepStrictEqual(result.simulated, { date: '2026-12-15', amount: 100 });
  assert.strictEqual(result.impact, 800);
  assert.strictEqual(result.baselineWarning, false);
  assert.strictEqual(result.simulatedWarning, true);
});

test('invalid dates throw', () => {
  assert.throws(() => reminderDate('2026-02-31'));
  assert.throws(() => reminderDate('11/20/2026'));
});