// server/src/routes/crud.js
// List / add / edit / delete for one collection. installments, allowances and
// expenses are all this router with different rules.
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { validate } from '../services/validation.js';

// Firestore auto-ids and our own ids only ever look like this
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// The client makes one random key per "Add" form. Saving the same form twice (for example after
// a server error) sends the same key, so the server updates one record instead of creating two.
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function createCrudRouter({ store, collection, label, schema, defaults, extraOnCreate = {} }) {
  const router = Router();

  const notFound = () => new ApiError(404, `${label} not found.`, 'not-found');
  router.param('id', (req, res, next, id) => (ID_PATTERN.test(id) ? next() : next(notFound())));

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await store.list(req.user.uid, collection));
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const value = validate(schema, req.body, { defaults });
      const key = req.get('Idempotency-Key');
      if (key !== undefined && !KEY_PATTERN.test(key)) {
        throw new ApiError(400, 'Idempotency-Key must be 8 to 64 letters, numbers, - or _.', 'validation/failed');
      }
      const record = await store.create(
        req.user.uid,
        collection,
        { ...value, ...extraOnCreate },
        key ? { id: `k_${key}` } : undefined
      );
      res.status(201).json(record);
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const value = validate(schema, req.body, { partial: true });
      const record = await store.update(req.user.uid, collection, req.params.id, value);
      if (!record) throw notFound();
      res.json(record);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const removed = await store.remove(req.user.uid, collection, req.params.id);
      if (!removed) throw notFound();
      res.json({ id: req.params.id, deleted: true });
    })
  );

  return router;
}