// server/src/services/memoryStore.js
// Same interface as firestore.js but in memory. Used by the automated tests
// (and handy if you ever want to run the API without Firebase).

import { DEFAULT_SETTINGS } from './defaults.js';

export function createMemoryStore() {
  const data = new Map(); // `${uid}/${name}` -> Map(id -> record)
  const settings = new Map(); // uid -> settings
  let counter = 0;

  const bucket = (uid, name) => {
    const key = `${uid}/${name}`;
    if (!data.has(key)) data.set(key, new Map());
    return data.get(key);
  };

  return {
    async list(uid, name) {
      return [...bucket(uid, name).values()].map((r) => ({ ...r }));
    },
    async get(uid, name, id) {
      const r = bucket(uid, name).get(id);
      return r ? { ...r } : null;
    },
    async create(uid, name, record, { id: fixedId } = {}) {
      const id = fixedId ?? `id${++counter}`;
      bucket(uid, name).set(id, { id, ...record }); // same fixed id = same record, overwritten
      return { id, ...record };
    },
    async update(uid, name, id, patch) {
      const b = bucket(uid, name);
      if (!b.has(id)) return null;
      const next = { ...b.get(id), ...patch, id };
      b.set(id, next);
      return { ...next };
    },
    async remove(uid, name, id) {
      return bucket(uid, name).delete(id);
    },
    async getSettings(uid) {
      return { ...DEFAULT_SETTINGS, ...(settings.get(uid) || {}) };
    },
    async updateSettings(uid, patch) {
      settings.set(uid, { ...(settings.get(uid) || {}), ...patch });
      return { ...DEFAULT_SETTINGS, ...settings.get(uid) };
    },
  };
}