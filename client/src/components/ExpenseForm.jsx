import { useState } from 'react';
import FormField from './FormField.jsx';
import { useToast } from '../hooks/useToast.js';
import { validateExpense, normalizeExpense } from '../services/validation.js';

const CATEGORIES = ['Food', 'Transport', 'School', 'Projects', 'Load/Data', 'Leisure', 'Other'];

export default function ExpenseForm({ initial, defaultDate, onSubmit, onCancel, saving, serverError }) {
  const [values, setValues] = useState({
    amount: initial?.amount ?? '',
    date: initial?.date ?? defaultDate,
    category: initial?.category ?? '',
    essential: initial?.essential ?? true,
  });
  const toast = useToast();
  const [errors, setErrors] = useState({});

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  function handleSubmit(e) {
    e.preventDefault();
    const check = validateExpense(values);
    setErrors(check.errors);
    if (check.isValid) onSubmit(normalizeExpense(values));
    else toast.error('Please fix the highlighted fields.');
  }

  const cls = (field) => 'input' + (errors[field] ? ' invalid' : '');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && <div className="banner banner-error" role="alert">{serverError}</div>}

      <FormField label="Amount (₱)" htmlFor="amount" error={errors.amount}>
        <input id="amount" className={cls('amount')} type="number" inputMode="decimal" step="0.01" value={values.amount} onChange={change('amount')} />
      </FormField>
      <FormField label="Date" htmlFor="date" error={errors.date}>
        <input id="date" className={cls('date')} type="date" value={values.date} onChange={change('date')} />
      </FormField>
      <FormField label="Category" htmlFor="category" error={errors.category}>
        <input id="category" className={cls('category')} list="expense-categories" value={values.category} onChange={change('category')} placeholder="Pick or type one" />
        <datalist id="expense-categories">
          {CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </FormField>
      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={values.essential}
            onChange={(e) => setValues((v) => ({ ...v, essential: e.target.checked }))}
          />
          Essential expense (needed, not optional)
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
