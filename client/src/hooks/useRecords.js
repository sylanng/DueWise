import { useCallback, useEffect, useState } from 'react';

// Loads a list through one of the api.js getters and tracks loading/error state.
// fetchFn must be a stable function (the api.js exports are).
export function useRecords(fetchFn) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        setItems(await fetchFn());
      } catch (err) {
        setError(err.message || 'Could not load data.');
      } finally {
        setLoading(false);
      }
    },
    [fetchFn]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, setError, reload: load };
}