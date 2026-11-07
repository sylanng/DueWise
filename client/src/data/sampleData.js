// client/src/data/sampleData.js
// Sample data for mock mode. Dates are relative to "today" so the dashboard
// always shows upcoming due dates, whenever you open the app.
// Field names match the Firestore model.

import { addDays } from '../services/cashflow.js';

export function createSampleData(today) {
  return {
    settings: {
      openingBalance: 3000,
      reserveThreshold: 500,
      planningHorizonDays: 30,
      notifyOnAdd: true,
      notifyDueSoon: true,
    },

    allowances: [
      {
        id: 'allow_1',
        label: 'Monthly allowance',
        amount: 4000,
        expectedDate: addDays(today, 9),
        frequency: 'monthly',
      },
    ],

    expenses: [
      { id: 'exp_1', amount: 350, date: addDays(today, -2), category: 'Food', essential: true },
      { id: 'exp_2', amount: 120, date: addDays(today, 1), category: 'Transport', essential: true },
      { id: 'exp_3', amount: 400, date: addDays(today, 6), category: 'Projects', essential: true },
      { id: 'exp_4', amount: 250, date: addDays(today, 14), category: 'Leisure', essential: false },
    ],

    installments: [
      {
        id: 'inst_1',
        provider: 'SPayLater',
        amount: 450,
        dueDate: addDays(today, 5),
        status: 'pending',
        remainingPayments: 3,
        calendarEventId: null,
        calendarSyncStatus: 'none',
      },
      {
        id: 'inst_2',
        provider: 'Atome',
        amount: 800,
        dueDate: addDays(today, 12),
        status: 'pending',
        remainingPayments: 2,
        calendarEventId: null,
        calendarSyncStatus: 'none',
      },
      {
        id: 'inst_3',
        provider: 'GGives',
        amount: 1200,
        dueDate: addDays(today, 20),
        status: 'pending',
        remainingPayments: 4,
        calendarEventId: null,
        calendarSyncStatus: 'none',
      },
    ],
  };
}