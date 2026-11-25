
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import DatePicker from 'react-datepicker';
import apiRequest from '../services/api';
import CustomDropdown from '../components/CustomDropdown';

import ConfirmDialog from '../components/ConfirmDialog';

function Installments() {
  const [installments, setInstallments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [originalStatus, setOriginalStatus] = useState('unpaid');
  const [selectedInstallmentId, setSelectedInstallmentId] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formStep, setFormStep] = useState(1);

  const selectedInstallment = installments.find(
    (item) => item.id === selectedInstallmentId
  );

  const emptyForm = {
    provider: '',
    description: '',
    totalAmount: '',
    amountPerPayment: '',
    dueDate: '',
    totalPayments: '1',
    paidPayments: '0',
    paymentFrequency: 'monthly',
    status: 'unpaid',
  };

  const [form, setForm] = useState(emptyForm);

  const editingInstallment = installments.find(
    (item) => item.id === editingId
  );

  const hasRecordedPayments =
    editingId !== null &&
    Number(editingInstallment?.paidPayments || 0) > 0;

  // Load installments from Firestore through the backend
  
const loadInstallments = async () => {
  try {
    setError('');
    setLoadError('');
    setLoading(true);

    const result = await apiRequest('/api/installments');

    window.dispatchEvent(
      new Event('duewise:notifications-updated')
    );

    const loadedInstallments = result.data || [];

    setInstallments(loadedInstallments);

  } catch (err) {
    const message =
      err.message || 'Failed to load installments.';

    setError(message);
    setLoadError(message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadInstallments();
  }, []);

  // Handle form input changes
  
const handleChange = (event) => {
  const { name, value } = event.target;

  setForm((previous) => {
    const updated = {
      ...previous,
      [name]: value,
    };

    if (name === 'totalAmount' || name === 'totalPayments') {
      const totalAmount = Number(updated.totalAmount);
      const totalPayments = Number(updated.totalPayments);

      updated.amountPerPayment =
        updated.totalAmount !== '' &&
        updated.totalPayments !== '' &&
        totalAmount > 0 &&
        totalPayments > 0
          ? (totalAmount / totalPayments).toFixed(2)
          : '';
    }

    return updated;
  });

  setFieldErrors((previous) => ({
    ...previous,
    [name]: '',
    ...(name === 'totalAmount' || name === 'totalPayments'
      ? { amountPerPayment: '' }
      : {}),
  }));
};

const handleDueDateChange = (date) => {
  if (!date) {
    setForm((previous) => ({
      ...previous,
      dueDate: '',
    }));

    // Clear due date error
    setFieldErrors((previous) => ({
      ...previous,
      dueDate: '',
    }));

    return;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  setForm((previous) => ({
    ...previous,
    dueDate: `${year}-${month}-${day}`,
  }));

  // Clear due date error
  setFieldErrors((previous) => ({
    ...previous,
    dueDate: '',
  }));
};

  const validateForm = (fieldsToValidate) => {
  const errors = {};
  const shouldValidate = (field) =>
    !fieldsToValidate || fieldsToValidate.includes(field);

  if (shouldValidate('provider') && !form.provider.trim()) {
    errors.provider = 'Please enter the BNPL provider.';
  }

  if (shouldValidate('description') && !form.description.trim()) {
    errors.description = 'Please enter the purchase name.';
  }

  const totalAmount = Number(form.totalAmount);

  if (shouldValidate('totalAmount') && form.totalAmount === '') {
    errors.totalAmount = 'Please enter the total purchase amount.';
  } else if (
    shouldValidate('totalAmount') &&
    (!Number.isFinite(totalAmount) || totalAmount <= 0)
  ) {
    errors.totalAmount = 'Amount must be greater than ₱0.';
  }

  const totalPayments = Number(form.totalPayments);

  if (shouldValidate('totalPayments') && form.totalPayments === '') {
    errors.totalPayments = 'Please enter the number of payments.';
  } else if (
    shouldValidate('totalPayments') &&
    (!Number.isInteger(totalPayments) || totalPayments < 1)
  ) {
    errors.totalPayments = 'Enter a valid whole number of payments.';
  }

  const amountPerPayment = Number(form.amountPerPayment);

  if (
    shouldValidate('amountPerPayment') &&
    (!form.amountPerPayment ||
      !Number.isFinite(amountPerPayment) ||
      amountPerPayment <= 0)
  ) {
    errors.amountPerPayment =
      'Unable to calculate the payment amount. Check your total amount and number of payments.';
  }

  if (shouldValidate('paymentFrequency') && !form.paymentFrequency) {
    errors.paymentFrequency = 'Please select a payment frequency.';
  }

  if (shouldValidate('dueDate') && !form.dueDate) {
    errors.dueDate = 'Please select the next due date.';
  } else if (
    shouldValidate('dueDate') &&
    Number.isNaN(new Date(`${form.dueDate}T00:00:00`).getTime())
  ) {
    errors.dueDate = 'Please select a valid due date.';
  }

  setFieldErrors(errors);

  return Object.keys(errors).length === 0;
};

  const handleContinue = () => {
    const purchaseFields = [
      'provider',
      'description',
      'totalAmount',
      'amountPerPayment',
      'totalPayments',
    ];

    if (validateForm(purchaseFields)) {
      setFormStep(2);
    }
  };

  // Create or update an installment
  
  // Show confirmation before saving
  const handleSubmit = (event) => {
    event.preventDefault();

    if (!editingId && formStep === 1) {
      handleContinue();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setError('');
    setShowConfirm(true);
  };

 
  // Save only after user confirms
  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      setError('');

      const installmentData = {
        provider: form.provider.trim(),
        description: form.description.trim(),
        totalAmount: Number(form.totalAmount),
        amountPerPayment: Number(form.amountPerPayment),
        dueDate: form.dueDate,
        totalPayments: Number(form.totalPayments),
        paymentFrequency: form.paymentFrequency,
      };

      if (editingId) {
        // Editing does not modify payment progress or next due date.
        await apiRequest(`/api/installments/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(installmentData),
        });
      } else {
        // New installments always start unpaid.
        await apiRequest('/api/installments', {
          method: 'POST',
          body: JSON.stringify({
            ...installmentData,
            nextDueDate: form.dueDate,
            paidPayments: 0,
            status: 'unpaid',
          }),
        });
      }

      await loadInstallments();

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setFormStep(1);
      setShowConfirm(false);
    } catch (err) {
      setError(err.message || 'Failed to save installment.');
    } finally {
      setSaving(false);
    }
  };

  // Open custom payment confirmation
const handleRecordPayment = (item) => {
  const remainingPayments =
    Number(item.totalPayments || 0) -
    Number(item.paidPayments || 0);

  if (remainingPayments <= 0 || item.status === 'paid') {
    setError('This installment is already fully paid.');
    return;
  }

  setError('');
  setPendingPayment(item);
};

  // Record payment after confirmation
  const handleConfirmPayment = async () => {
    if (!pendingPayment || recordingPayment) return;

    try {
      setRecordingPayment(true);
      setError('');

      await apiRequest(
          `/api/installments/${pendingPayment.id}/record-payment`,
          { method: 'POST' }
        );

        // Immediately refresh the app's notification dropdown
        window.dispatchEvent(
          new Event('duewise:notifications-updated')
        );

        setPendingPayment(null);
        await loadInstallments();
    } catch (error) {
      console.error('Record payment error:', error);
      setError('Failed to record payment. Please try again.');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Edit an existing installment
  const handleEdit = (item) => {
    setForm({
      provider: item.provider || '',
      description: item.description || '',
      totalAmount: String(item.totalAmount ?? ''),
      amountPerPayment: String(item.amountPerPayment ?? ''),
      dueDate: item.nextDueDate || item.dueDate || '',
      totalPayments: String(item.totalPayments ?? 1),
      paidPayments: String(item.paidPayments ?? 0),
      paymentFrequency: item.paymentFrequency || 'monthly',
      status: item.status || 'unpaid',
    });

    setEditingId(item.id);
    setOriginalStatus(item.status || 'unpaid');
    setShowForm(true);
    setFormStep(1);
    setError('');
    setFieldErrors({});
  };

  // Open custom delete confirmation
  const handleDelete = (id) => {
    setPendingDeleteId(id);
  };

  // Delete only after confirmation
  const handleConfirmDelete = async () => {
    try {
      setError('');

      await apiRequest(`/api/installments/${pendingDeleteId}`, {
        method: 'DELETE',
      });

      setPendingDeleteId(null);
      await loadInstallments();
    } catch (err) {
      setError(err.message || 'Failed to delete installment.');
    }
  };

  // Cancel form
  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOriginalStatus('unpaid');
    setShowForm(false);
    setFormStep(1);
    setError('');
    setOriginalStatus('unpaid');
    setFieldErrors({});
  };

  // Currency formatter
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

  // Convert backend status into display labels
  const getStatusLabel = (status) => {
    if (status === 'paid') return 'Paid';
    if (status === 'partially_paid') return 'Partially Paid';
    return 'Pending';
  };

  // Search and filter
  const filteredInstallments = installments.filter((item) => {
    const description = (
      item.description || ''
    ).toLowerCase();

    const provider = (
      item.provider || ''
    ).toLowerCase();

    const searchTerm = search.trim().toLowerCase();

    const matchesSearch =
      description.includes(searchTerm) ||
      provider.includes(searchTerm);

    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && item.status === 'unpaid') ||
      (filter === 'Partially Paid' &&
        item.status === 'partially_paid') ||
      (filter === 'Paid' && item.status === 'paid');

    return matchesSearch && matchesFilter;
  });

  // Summary calculations
  const pendingTotal = installments
    .filter((item) => item.status !== 'paid')
    .reduce(
      (total, item) =>
        total +
        Number(item.amountPerPayment || 0) *
          Math.max(
            0,
            Number(item.totalPayments || 0) -
              Number(item.paidPayments || 0)
          ),
      0
    );

  const paidTotal = installments
    .reduce(
      (total, item) =>
        total +
        Number(item.amountPerPayment || 0) *
          Number(item.paidPayments || 0),
      0
    );

  const currentMonthKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

  const getNextScheduledDate = (dateString, frequency) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (frequency === 'weekly') {
      date.setUTCDate(date.getUTCDate() + 7);
    } else if (frequency === 'biweekly') {
      date.setUTCDate(date.getUTCDate() + 14);
    } else if (frequency === 'monthly') {
      const nextMonth = new Date(Date.UTC(year, month, 1));
      const lastDay = new Date(
        Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)
      ).getUTCDate();
      nextMonth.setUTCDate(Math.min(day, lastDay));
      return nextMonth.toISOString().slice(0, 10);
    } else {
      return dateString;
    }

    return date.toISOString().slice(0, 10);
  };

  const dueThisMonth = installments.reduce((total, item) => {
    if (item.status === 'paid') return total;

    const remainingPayments = Math.max(
      0,
      Number(item.totalPayments || 0) - Number(item.paidPayments || 0)
    );
    if (remainingPayments === 0) return total;

    let dueDate = String(item.nextDueDate || item.dueDate || '').slice(0, 10);
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dueDate)) return total;

    let itemMonthlyTotal = 0;
    for (let index = 0; index < remainingPayments; index++) {
      if (dueDate.slice(0, 7) === currentMonthKey) {
        itemMonthlyTotal += Number(item.amountPerPayment || 0);
      }
      if (index < remainingPayments - 1) {
        dueDate = getNextScheduledDate(dueDate, item.paymentFrequency);
      }
    }

    return total + itemMonthlyTotal;
  }, 0);

  return (
    <div className="installments-page">
      <div className="module-heading">
        <div>
          <h2>Installment Management</h2>
          <p>
            Manage your BNPL purchases and scheduled payments.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setFormStep(1);
            setShowForm(true);
            setError('');
            setFieldErrors({});
          }}
        >
          + Add Installment
        </button>
    </div>

      {error && (
  <div className="error-message" role="alert">
    <p>{error}</p>

    {loadError && (
      <button
        className="text-button"
        onClick={loadInstallments}
        disabled={loading}
      >
        {loading ? 'Retrying...' : 'Retry'}
      </button>
    )}
  </div>
)}

    {!loadError && (
      <>
      <div className="installment-summary">
        <div className="module-stat">
          <span>Total Records</span>
          <strong>{installments.length}</strong>
        </div>

        <div className="module-stat">
          <span>Total Remaining Payments</span>
          <strong>{formatCurrency(pendingTotal)}</strong>
        </div>

        <div className="module-stat">
          <span>Payments Due This Month</span>
          <strong>{formatCurrency(dueThisMonth)}</strong>
        </div>

        <div className="module-stat">
          <span>Paid Payments</span>
          <strong>{formatCurrency(paidTotal)}</strong>
        </div>
      </div>

      

{showForm && (
  <div className="installment-modal-overlay">
    <div
      className="installment-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="installment-modal-title"
    >
      <div className="installment-modal-header">
        <div>
          <h3 id="installment-modal-title">
            {editingId ? 'Edit Installment' : 'Add New Installment'}
          </h3>
          <p>
            {editingId
              ? 'Update your purchase and payment details.'
              : formStep === 1
                ? 'Start with the purchase details.'
                : 'Set the payment schedule and review it.'}
          </p>
        </div>

        <button
          type="button"
          className="modal-close-button"
          onClick={handleCancel}
          disabled={saving}
          aria-label="Close modal"
        >
          ×
        </button>
      </div>

      {!editingId && (
        <ol className="installment-stepper" aria-label="Installment form progress">
          <li
            className={formStep === 1 ? 'active' : 'complete'}
            aria-current={formStep === 1 ? 'step' : undefined}
          >
            <span>1</span>
            <span>Purchase</span>
          </li>
          <li
            className={formStep === 2 ? 'active' : ''}
            aria-current={formStep === 2 ? 'step' : undefined}
          >
            <span>2</span>
            <span>Schedule</span>
          </li>
        </ol>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {(editingId || formStep === 1) && (
          <>
            <div className="form-grid">
              <label>
                BNPL Provider
                <input
                  type="text"
                  name="provider"
                  value={form.provider}
                  onChange={handleChange}
                  placeholder="e.g. Home Credit"
                  aria-invalid={Boolean(fieldErrors.provider)}
                  required
                />
                {fieldErrors.provider && (
                  <span className="field-error">{fieldErrors.provider}</span>
                )}
              </label>

              <label>
                Purchase Name
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="e.g. Smartphone"
                  aria-invalid={Boolean(fieldErrors.description)}
                  required
                />
                {fieldErrors.description && (
                  <span className="field-error">{fieldErrors.description}</span>
                )}
              </label>

              <label>
                Total Purchase Amount (₱)
                <input
                  type="number"
                  name="totalAmount"
                  value={form.totalAmount}
                  onChange={handleChange}
                  disabled={hasRecordedPayments}
                  min="0.01"
                  step="0.01"
                  aria-invalid={Boolean(fieldErrors.totalAmount)}
                  required
                />
                {fieldErrors.totalAmount && (
                  <span className="field-error">{fieldErrors.totalAmount}</span>
                )}
              </label>

              {editingId && (
                <label>
                  Amount Per Payment (₱)
                  <input
                    type="number"
                    name="amountPerPayment"
                    value={form.amountPerPayment}
                    onChange={handleChange}
                    readOnly
                    disabled={hasRecordedPayments}
                    min="0.01"
                    step="0.01"
                    aria-invalid={Boolean(fieldErrors.amountPerPayment)}
                    required
                  />
                  {fieldErrors.amountPerPayment && (
                    <span className="field-error">{fieldErrors.amountPerPayment}</span>
                  )}
                </label>
              )}

              <label>
                Total Number of Payments
                <input
                  type="number"
                  name="totalPayments"
                  value={form.totalPayments}
                  onChange={handleChange}
                  disabled={hasRecordedPayments}
                  min="1"
                  step="1"
                  aria-invalid={Boolean(fieldErrors.totalPayments)}
                  required
                />
                {fieldErrors.totalPayments && (
                  <span className="field-error">{fieldErrors.totalPayments}</span>
                )}
              </label>

              {editingId && (
                <label>
                  Payment Frequency
                  <div className="payment-frequency-control">
                    <CustomDropdown
                      value={form.paymentFrequency}
                      options={[
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'biweekly', label: 'Every two weeks' },
                        { value: 'monthly', label: 'Monthly' },
                      ]}
                      onChange={(value) => {
                        setForm((previous) => ({
                          ...previous,
                          paymentFrequency: value,
                        }));
                        setFieldErrors((previous) => ({
                          ...previous,
                          paymentFrequency: '',
                        }));
                      }}
                    />
                  </div>
                  {fieldErrors.paymentFrequency && (
                    <span className="field-error">{fieldErrors.paymentFrequency}</span>
                  )}
                </label>
              )}

              {editingId && (
                <label>
                  Next Due Date
                  <DatePicker
                    selected={
                      form.dueDate
                        ? new Date(`${form.dueDate}T00:00:00`)
                        : null
                    }
                    onChange={handleDueDateChange}
                    dateFormat="MM/dd/yyyy"
                    placeholderText="Select next due date"
                    className="duewise-datepicker"
                    calendarClassName="duewise-calendar"
                    popperClassName="duewise-datepicker-popper"
                    popperPlacement="bottom-start"
                    portalId="root"
                    showPopperArrow={false}
                    aria-invalid={Boolean(fieldErrors.dueDate)}
                    required
                  />
                  {fieldErrors.dueDate && (
                    <span className="field-error">{fieldErrors.dueDate}</span>
                  )}
                </label>
              )}

              {editingId && (
                <label>
                  Payment Status
                  <input
                    type="text"
                    value={`${getStatusLabel(form.status)} (${form.paidPayments}/${form.totalPayments} payments)`}
                    disabled
                  />
                </label>
              )}
            </div>

            {hasRecordedPayments && (
              <p className="installment-locked-terms-note" role="note">
                Purchase amount and payment count are locked because a payment
                has been recorded. Changing them would affect how your remaining
                balance is calculated.
              </p>
            )}

            {!editingId && (
              <div className="installment-payment-preview">
                <span>Estimated payment per installment</span>
                <strong>
                  {form.amountPerPayment
                    ? formatCurrency(form.amountPerPayment)
                    : 'Enter an amount and payment count'}
                </strong>
              </div>
            )}
          </>
        )}

        {(!editingId && formStep === 2) && (
          <>
            <div className="form-grid">
              <label>
                Payment Frequency
                <div className="payment-frequency-control">
                  <CustomDropdown
                    value={form.paymentFrequency}
                    options={[
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'biweekly', label: 'Every two weeks' },
                      { value: 'monthly', label: 'Monthly' },
                    ]}
                    onChange={(value) => {
                      setForm((previous) => ({
                        ...previous,
                        paymentFrequency: value,
                      }));
                      setFieldErrors((previous) => ({
                        ...previous,
                        paymentFrequency: '',
                      }));
                    }}
                  />
                </div>
                {fieldErrors.paymentFrequency && (
                  <span className="field-error">{fieldErrors.paymentFrequency}</span>
                )}
              </label>

              <label>
                Next Due Date
                <DatePicker
                  selected={
                    form.dueDate
                      ? new Date(`${form.dueDate}T00:00:00`)
                      : null
                  }
                  onChange={handleDueDateChange}
                  dateFormat="MM/dd/yyyy"
                  placeholderText="Select next due date"
                  className="duewise-datepicker"
                  calendarClassName="duewise-calendar"
                  popperClassName="duewise-datepicker-popper"
                  popperPlacement="bottom-start"
                  portalId="root"
                  showPopperArrow={false}
                  aria-invalid={Boolean(fieldErrors.dueDate)}
                  required
                />
                {fieldErrors.dueDate && (
                  <span className="field-error">{fieldErrors.dueDate}</span>
                )}
              </label>
            </div>

            <div className="installment-schedule-summary">
              <div>
                <span>Purchase</span>
                <strong>{form.description || '—'}</strong>
              </div>
              <div>
                <span>Total purchase</span>
                <strong>{formatCurrency(form.totalAmount)}</strong>
              </div>
              <div>
                <span>Each payment</span>
                <strong>{formatCurrency(form.amountPerPayment)}</strong>
              </div>
              <div>
                <span>Schedule</span>
                <strong>
                  {form.totalPayments} payments ·{' '}
                  {form.paymentFrequency === 'biweekly'
                    ? 'Every two weeks'
                    : form.paymentFrequency[0].toUpperCase() +
                      form.paymentFrequency.slice(1)}
                </strong>
              </div>
              <div>
                <span>First due date</span>
                <strong>
                  {form.dueDate
                    ? new Date(`${form.dueDate}T00:00:00`).toLocaleDateString(
                        'en-PH',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )
                    : 'Choose a date'}
                </strong>
              </div>
            </div>
          </>
        )}

        <div className="form-actions">
          {editingId ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : formStep === 1 ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleContinue}
                disabled={saving}
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFormStep(1)}
                disabled={saving}
              >
                Back
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                Add Installment
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  </div>
)}

      
      <div className="installment-record-layout">
        {/* LEFT: INSTALLMENT RECORDS */}
        <div className="installment-record-list">
          <h3>My Installments</h3>

          <div className="module-toolbar">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search installments..."
            />

            <CustomDropdown
              value={filter}
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Partially Paid', label: 'Partially Paid' },
                { value: 'Paid', label: 'Paid' },
              ]}
              onChange={(value) => {
                setFilter(value);
                setSelectedInstallmentId(null);
              }}
            />
          </div>

          
<div className="installment-record-items">
  {loading ? (
    <p>Loading installments...</p>
  ) : filteredInstallments.length > 0 ? (
    filteredInstallments.map((item) => (
      <button
        type="button"
        key={item.id}
        className={`installment-record-item ${
          selectedInstallmentId === item.id ? 'active' : ''
        }`}
        onClick={() => setSelectedInstallmentId(item.id)}
      >
        <span>
          <strong>{item.description}</strong>
          <br />
          <small>{item.provider}</small>
        </span>

        <span
          className={`status ${
            item.status === 'paid'
              ? 'paid'
              : item.status === 'partially_paid'
                ? 'partial'
                : 'pending'
          }`}
        >
          {getStatusLabel(item.status)}
        </span>
      </button>
    ))
  ) : (
    <p className="empty-message">No installment records found.</p>
  )}
  </div>
</div>


        {/* RIGHT: SELECTED INSTALLMENT DETAILS */}
        <div className="installment-record-details">
          {selectedInstallment &&
            (
              filter === 'All' ||
              filteredInstallments.some(
                (item) => item.id === selectedInstallmentId
              )
            ) ? (
            <>
              <h3>Installment Details</h3>

              <div className="receipt-details">
                <p className="receipt-label">PURCHASE NAME</p>
                <h2>{selectedInstallment.description}</h2>

                <hr />

                <p className="receipt-label">BNPL PROVIDER</p>
                <strong>{selectedInstallment.provider}</strong>

                <p className="receipt-label">TOTAL PURCHASE AMOUNT</p>
                <h3>{formatCurrency(selectedInstallment.totalAmount)}</h3>

                <p className="receipt-label">AMOUNT PER PAYMENT</p>
                <strong>{formatCurrency(selectedInstallment.amountPerPayment)}</strong>

                <p className="receipt-label">PAYMENT PROGRESS</p>
                <strong>
                  {selectedInstallment.paidPayments || 0} of{' '}
                  {selectedInstallment.totalPayments} payments
                </strong>

                <p className="receipt-label">PAYMENT FREQUENCY</p>
                <strong>{selectedInstallment.paymentFrequency}</strong>

                <p className="receipt-label">NEXT DUE DATE</p>
                <strong>
                  {selectedInstallment.status === 'paid'
                    ? 'No remaining payment'
                    : selectedInstallment.nextDueDate ||
                      selectedInstallment.dueDate}
                </strong>

                <p className="receipt-label">PAYMENT STATUS</p>
                <span
                  className={`status ${
                    selectedInstallment.status === 'paid'
                      ? 'paid'
                      : selectedInstallment.status === 'partially_paid'
                        ? 'partial'
                        : 'pending'
                  }`}
                >
                  {getStatusLabel(selectedInstallment.status)}
                </span>
              </div>

              <div className="form-actions">
                {selectedInstallment.status !== 'paid' && (
                  <button
                    className="primary-button"
                    onClick={() => handleRecordPayment(selectedInstallment)}
                  >
                    Confirm Payment
                  </button>
                )}

                <button
                  className="edit-button"
                  onClick={() => handleEdit(selectedInstallment)}
                >
                  Edit
                </button>

                <button
                  className="delete-button"
                  onClick={() => handleDelete(selectedInstallment.id)}
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="empty-message">
              <h3>No Installment Selected</h3>
              <p>Select an installment from the left to view its details.</p>
            </div>
          )}
        </div>
      </div>
      </>
    )}
    {pendingPayment && (
      <div className="payment-confirm-overlay">
        <div
          className="payment-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-confirm-title"
        >
          <div className="payment-confirm-icon">
            <Wallet size={28} strokeWidth={2} />
          </div>

          <h2 id="payment-confirm-title">Confirm Payment</h2>

          <p className="payment-confirm-message">
            Are you sure you have paid this installment?
          </p>

          <div className="payment-confirm-details">
            <div>
              <span>Purchase</span>
              <strong>
                {pendingPayment.description || 'Installment'}
              </strong>
            </div>

            <div>
              <span>Provider</span>
              <strong>{pendingPayment.provider}</strong>
            </div>

            <div>
              <span>Payment Number</span>
              <strong>
                {Number(pendingPayment.paidPayments || 0) + 1} of{' '}
                {pendingPayment.totalPayments}
              </strong>
            </div>

            <div>
              <span>Payment Amount</span>
              <strong className="payment-confirm-amount">
                {formatCurrency(pendingPayment.amountPerPayment)}
              </strong>
            </div>
          </div>

          <div className="payment-confirm-actions">
            <button
              type="button"
              className="payment-confirm-cancel"
              onClick={() => setPendingPayment(null)}
              disabled={recordingPayment}
            >
              Cancel
            </button>

            <button
              type="button"
              className="payment-confirm-submit"
              onClick={handleConfirmPayment}
              disabled={recordingPayment}
            >
              {recordingPayment ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>
    )}
    {showConfirm && (
      <ConfirmDialog
        title={
          editingId &&
          originalStatus !== 'paid' &&
          form.status === 'paid'
            ? 'Confirm Payment?'
            : editingId
              ? 'Save Installment Changes?'
              : 'Add New Installment?'
        }
        message={
          editingId &&
          originalStatus !== 'paid' &&
          form.status === 'paid'
            ? 'Are you sure you want to mark this installment as paid? This will update your payment records.'
            : editingId
              ? 'Are you sure you want to save the changes to this installment?'
              : 'Please confirm that you want to add this installment to your records.'
        }
        confirmText={
          editingId &&
          originalStatus !== 'paid' &&
          form.status === 'paid'
            ? 'Confirm Payment'
            : editingId
              ? 'Save Changes'
              : 'Add Installment'
        }
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      />
    )}
    {pendingDeleteId && (
      <ConfirmDialog
        title="Delete Installment?"
        message="Are you sure you want to delete this installment? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    )}
    </div>
  );
}

export default Installments;
