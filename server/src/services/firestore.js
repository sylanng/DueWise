// server/src/services/firestore.js
// ALL Firestore access lives here. Data is stored per user:
//   users/{uid}/installments/{id}   users/{uid}/allowances/{id}   users/{uid}/expenses/{id}
//   users/{uid}/settings/main
// Every function takes the uid, so one user can never reach another user's data.
//
// Writes use a document id chosen BEFORE the first attempt, so retrying a write
// (ours, or the user clicking Save again with the same Idempotency-Key) can never
// create a second copy.

import { DEFAULT_SETTINGS } from './defaults.js';
import { withRetry } from './retry.js';

export function createFirestoreStore(db) {
  const col = (uid, name) => db.collection('users').doc(uid).collection(name);

  return {
    // Opens the connection and fetches credentials now, so the first real request isn't slow
    async warmUp() {
      await withRetry(() => db.collection('system').doc('warmup').get());
    },

    async list(uid, name) {
      const snap = await withRetry(() => col(uid, name).get());
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async get(uid, name, id) {
      const doc = await withRetry(() => col(uid, name).doc(id).get());
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    // options.id: a fixed id (from the Idempotency-Key). Same id again = same record, overwritten.
    async create(uid, name, data, { id } = {}) {
      const ref = id ? col(uid, name).doc(id) : col(uid, name).doc();
      await withRetry(() => ref.set(data));
      return { id: ref.id, ...data };
    },

    // Merges `data` into the record. Returns null if it doesn't exist.
    async update(uid, name, id, data) {
      const ref = col(uid, name).doc(id);
      const doc = await withRetry(() => ref.get());
      if (!doc.exists) return null;
      await withRetry(() => ref.update(data));
      return { id, ...doc.data(), ...data };
    },

    async remove(uid, name, id) {
      const ref = col(uid, name).doc(id);
      const doc = await withRetry(() => ref.get());
      if (!doc.exists) return false;
      await withRetry(() => ref.delete());
      return true;
    },

    async getSettings(uid) {
      const doc = await withRetry(() => col(uid, 'settings').doc('main').get());
      return { ...DEFAULT_SETTINGS, ...(doc.exists ? doc.data() : {}) };
    },

    async updateSettings(uid, patch) {
      const ref = col(uid, 'settings').doc('main');
      await withRetry(() => ref.set(patch, { merge: true }));
      const doc = await withRetry(() => ref.get());
      return { ...DEFAULT_SETTINGS, ...doc.data() };
    },
  };
}