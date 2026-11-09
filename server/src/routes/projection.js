// GET /api/projection?today=YYYY-MM-DD   and   POST /api/simulate
// The client sends its own local date as `today` so the projection matches the
// user's timezone (the server runs in UTC).
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { buildProjection, buildSimulation } from '../services/projection.js';
import { validate, resolveToday, simulationSchema, simulationDefaults } from '../services/validation.js';

async function loadAll(store, uid) {
  const [settings, allowances, expenses, installments] = await Promise.all([
    store.getSettings(uid),
    store.list(uid, 'allowances'),
    store.list(uid, 'expenses'),
    store.list(uid, 'installments'),
  ]);
  return { settings, allowances, expenses, installments };
}

export function projectionRouter(store) {
  const router = Router();

  router.get(
    '/projection',
    asyncHandler(async (req, res) => {
      const today = resolveToday(req.query.today);
      res.json(buildProjection({ ...(await loadAll(store, req.user.uid)), today }));
    })
  );

  router.post(
    '/simulate',
    asyncHandler(async (req, res) => {
      const plan = validate(simulationSchema, req.body, { defaults: simulationDefaults });
      const today = resolveToday(req.body.today);
      if (plan.dueDate < today) {
        throw new ApiError(400, 'First payment date cannot be in the past.', 'validation/failed', {
          dueDate: 'First payment date cannot be in the past.',
        });
      }
      res.json(buildSimulation({ ...(await loadAll(store, req.user.uid)), today, plan }));
    })
  );

  return router;
}