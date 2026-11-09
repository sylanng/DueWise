import { createCrudRouter } from './crud.js';
import { expenseSchema, expenseDefaults } from '../services/validation.js';

export const expensesRouter = (store) =>
  createCrudRouter({
    store,
    collection: 'expenses',
    label: 'Expense',
    schema: expenseSchema,
    defaults: expenseDefaults,
  });