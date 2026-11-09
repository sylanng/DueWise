// server/src/Createapp.js
// Builds the Express app from its dependencies, so tests can plug in a fake
// token verifier and an in-memory store. app.js plugs in the real ones.
import express from 'express';
import { buildCors } from './config/cors.js';
import { createVerifyToken } from './middleware/verifyToken.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { installmentsRouter } from './routes/installments.js';
import { allowancesRouter } from './routes/allowances.js';
import { expensesRouter } from './routes/expenses.js';
import { settingsRouter } from './routes/settings.js';
import { projectionRouter } from './routes/projection.js';

export function createApp({ verifyIdToken, store, allowedOrigins }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(buildCors(allowedOrigins));
  app.use(express.json({ limit: '100kb' }));

  // The only route that needs no sign-in
  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  const api = express.Router();
  api.use(createVerifyToken(verifyIdToken));
  api.use('/installments', installmentsRouter(store));
  api.use('/allowances', allowancesRouter(store));
  api.use('/expenses', expensesRouter(store));
  api.use('/settings', settingsRouter(store));
  api.use('/', projectionRouter(store));
  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}