import { useContext } from 'react';
import { ToastContext } from '../context/toastContext.js';

const noop = () => {};

// const toast = useToast();  toast.error('Something went wrong');  toast.success('Saved.');
// Outside a ToastProvider this quietly does nothing instead of crashing.
export function useToast() {
  return useContext(ToastContext) ?? { error: noop, success: noop };
}