import { useState } from 'react';
import FormField from './FormField.jsx';
import { useToast } from '../hooks/useToast.js';
import { validateAllowance, normalizeAllowance } from '../services/validation.js';

export default function AllowanceForm({ initial, defaultDate, onSubmit, onCancel, saving, serverError }) {
  const [values, setValues] = useState({
    label: initial?.label ?? '',
    amount: initial?.amount ?? '',
    expectedDate: initial?.expectedDate ?? defaultDate,
    frequency: initial?.frequency ?? 'once',
  });
  const toast = useToast();
  const [errors, setErrors] = useState({});

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  function handleSubmit(e) {
    e.preventDefault();
    const check = validateAllowance(values);
    setErrors(check.errors);
    if (check.isValid) onSubmit(normalizeAllowance(values));
    else toast.error('Please fix the highlighted fields.');
  }

  const cls = (field) => 'input' + (errors[field] ? ' invalid' : '');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && <div className="banner banner-error" role="alert">{serverError}</div>}

      <FormField label="Label" htmlFor="label" error={errors.label}>
        <input id="label" className={cls('label')} value={values.label} onChange={change('label')} placeholder="e.g. Monthly allowance" />
      </FormField>
      <FormField label="Amount (₱)" htmlFor="amount" error={errors.amount}>
        <input id="amount" className={cls('amount')} type="number" inputMode="decimal" step="0.01" value={values.amount} onChange={change('amount')} />
      </FormField>
      <FormField label="Expected date (first one)" htmlFor="expectedDate" error={errors.expectedDate}>
        <input id="expectedDate" className={cls('expectedDate')} type="date" value={values.expectedDate} onChange={change('expectedDate')} />
      </FormField>
      <FormField label="How often" htmlFor="frequency" error={errors.frequency}>
        <select id="frequency" className={cls('frequency')} value={values.frequency} onChange={change('frequency')}>
          <option value="once">One time</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </FormField>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add allowance'}
        </button>
      </div>
    </form>
  );
}
