
import { useEffect, useState } from 'react';
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
};


const handleDueDateChange = (date) => {
  if (!date) {
    setForm((previous) => ({
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
};


  // Create or update an installment
  
  // Show confirmation before saving
  const handleSubmit = (event) => {
    event.preventDefault();
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
      setShowConfirm(false);
    } catch (err) {
      setError(err.message || 'Failed to save installment.');
    } finally {
      setSaving(false);
    }
  };

  // Record one installment payment
const handleRecordPayment = async (item) => {
  const remainingPayments =
    Number(item.totalPayments || 0) -
    Number(item.paidPayments || 0);

  if (remainingPayments <= 0 || item.status === 'paid') {
    setError('This installment is already fully paid.');
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you have paid installment ${Number(item.paidPayments || 0) + 1} of ${item.totalPayments} for ${item.provider}?`
  );

  if (!confirmed) return;

  try {
    setError('');

    await apiRequest(
      `/api/installments/${item.id}/record-payment`,
      { method: 'POST' }
    );

    await loadInstallments();
  } catch (error) {
    console.error('Record payment error:', error);
    setError('Failed to record payment. Please try again.');
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
    setError('');
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
    setError('');
    setOriginalStatus('unpaid');
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

    const matchesSearch =
      description.includes(search.toLowerCase()) ||
      provider.includes(search.toLowerCase());

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
            setShowForm(true);
            setError('');
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
          <span>Remaining Payments</span>
          <strong>{formatCurrency(pendingTotal)}</strong>
        </div>

        <div className="module-stat">
          <span>Paid Payments</span>
          <strong>{formatCurrency(paidTotal)}</strong>
        </div>
      </div>

      
{showForm && (
  <div
    className="installment-modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) {
        handleCancel();
      }
    }}
  >
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
          <p>Enter your purchase and payment details.</p>
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


          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                BNPL Provider
                <input
                  type="text"
                  name="provider"
                  value={form.provider}
                  onChange={handleChange}
                  placeholder="e.g. Home Credit"
                  required
                />
              </label>

              <label>
                Purchase Name
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="e.g. Smartphone"
                  required
                />
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
                  required
                />
              </label>

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
                  required
                />
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
                  showPopperArrow={false}
                  required
                />
              </label>

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
                  required
                />
              </label>

              <label>
                Payment Frequency
                <select
                  name="paymentFrequency"
                  value={form.paymentFrequency}
                  onChange={handleChange}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>

              <label>
                Payment Status
                <input
                  type="text"
                  value={`${getStatusLabel(form.status)} (${form.paidPayments}/${form.totalPayments} payments)`}
                  disabled
                />
              </label>
            </div>

            <div className="form-actions">
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
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Save Changes'
                    : 'Add Installment'}
              </button>
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
