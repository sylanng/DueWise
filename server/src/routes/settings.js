import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, settingsSchema } from '../services/validation.js';

export function settingsRouter(store) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await store.getSettings(req.user.uid));
    })
  );

  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const patch = validate(settingsSchema, req.body, { partial: true });
      res.json(await store.updateSettings(req.user.uid, patch));
    })
  );

  return router;
}