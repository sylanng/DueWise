import { createCrudRouter } from './crud.js';
import { allowanceSchema, allowanceDefaults } from '../services/validation.js';

export const allowancesRouter = (store) =>
  createCrudRouter({
    store,
    collection: 'allowances',
    label: 'Allowance',
    schema: allowanceSchema,
    defaults: allowanceDefaults,
  });