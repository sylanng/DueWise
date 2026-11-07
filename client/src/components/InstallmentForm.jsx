import { useState } from 'react';
import FormField from './FormField.jsx';
import { useToast } from '../hooks/useToast.js';
import { validateInstallment, normalizeInstallment } from '../services/validation.js';

// initial: an existing installment (edit) or null (add)
export default function InstallmentForm({ initial, defaultDate, onSubmit, onCancel, saving, serverError }) {
  const [values, setValues] = useState({
    provider: initial?.provider ?? '',
    amount: initial?.amount ?? '',
    dueDate: initial?.dueDate ?? defaultDate,
    remainingPayments: initial?.remainingPayments ?? 1,
    status: initial?.status ?? 'pending',
  });
  const toast = useToast();
  const [errors, setErrors] = useState({});

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear that field's error while typing
  };

  function handleSubmit(e) {
    e.preventDefault();
    const check = validateInstallment(values);
    setErrors(check.errors);
    if (check.isValid) onSubmit(normalizeInstallment(values));
    else toast.error('Please fix the highlighted fields.');
  }

  const cls = (field) => 'input' + (errors[field] ? ' invalid' : '');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && <div className="banner banner-error" role="alert">{serverError}</div>}

      <FormField label="Provider" htmlFor="provider" error={errors.provider}>
        <input id="provider" className={cls('provider')} value={values.provider} onChange={change('provider')} placeholder="e.g. SPayLater, Atome" />
      </FormField>

      <FormField label="Amount per payment (₱)" htmlFor="amount" error={errors.amount}>
        <input id="amount" className={cls('amount')} type="number" inputMode="decimal" step="0.01" value={values.amount} onChange={change('amount')} />
      </FormField>

      <FormField label="Next due date" htmlFor="dueDate" error={errors.dueDate}>
        <input id="dueDate" className={cls('dueDate')} type="date" value={values.dueDate} onChange={change('dueDate')} />
      </FormField>

      <FormField label="Remaining payments" htmlFor="remainingPayments" error={errors.remainingPayments}>
        <input id="remainingPayments" className={cls('remainingPayments')} type="number" step="1" min="1" value={values.remainingPayments} onChange={change('remainingPayments')} />
      </FormField>

      <FormField label="Status" htmlFor="status" error={errors.status}>
        <select id="status" className={cls('status')} value={values.status} onChange={change('status')}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
      </FormField>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add installment'}
        </button>
      </div>
    </form>
  );
}
