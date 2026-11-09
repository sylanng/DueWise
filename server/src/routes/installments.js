import { createCrudRouter } from './crud.js';
import { installmentSchema, installmentDefaults } from '../services/validation.js';

export const installmentsRouter = (store) =>
  createCrudRouter({
    store,
    collection: 'installments',
    label: 'Installment',
    schema: installmentSchema,
    defaults: installmentDefaults,
    // Set by the server only (Phase 3). Clients can never write these directly.
    extraOnCreate: { calendarEventId: null, calendarSyncStatus: 'none' },
  });