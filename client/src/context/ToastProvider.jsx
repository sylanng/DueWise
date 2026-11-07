import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toastContext.js';

const MAX_TOASTS = 4;

// Wrap the app once (see App.jsx). Anything inside can call useToast().
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message, duration) => {
      const id = nextId.current++;
      setToasts((list) => {
        // Don't stack identical messages (e.g. repeated clicks)
        if (list.some((t) => t.type === type && t.message === message)) return list;
        return [...list.slice(-(MAX_TOASTS - 1)), { id, type, message }];
      });
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      error: (message) => show('error', message, 6000),
      success: (message) => show('success', message, 3500),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            <button className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
