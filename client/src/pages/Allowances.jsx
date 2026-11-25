
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import apiRequest from '../services/api';
import CustomDropdown from '../components/CustomDropdown';

import ConfirmDialog from '../components/ConfirmDialog';

function Allowances() {
  const [allowances, setAllowances] = useState([]);

  const emptyForm = {
    source: '',
    amount: '',
    dateReceived: '',
    description: '',
  };

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [selectedAllowanceId, setSelectedAllowanceId] = useState(null);

  const selectedAllowance = allowances.find(
    (item) => item.id === selectedAllowanceId
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
  const errors = {};

  if (!form.source?.trim()) {
    errors.source = 'Please enter the allowance source.';
  }

  const amount = Number(form.amount);

  if (form.amount === '') {
    errors.amount = 'Please enter the amount received.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than ₱0.';
  }

  if (!form.dateReceived) {
    errors.dateReceived = 'Please select the date received.';
  } else if (
    Number.isNaN(new Date(`${form.dateReceived}T00:00:00`).getTime())
  ) {
    errors.dateReceived = 'Please select a valid date.';
  }

  setFieldErrors(errors);
  return Object.keys(errors).length === 0;
};

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

  // LOAD ALLOWANCES FROM FIRESTORE THROUGH THE BACKEND
  
const loadAllowances = async () => {
  try {
    setLoading(true);
    setError('');
    setLoadError('');

    const response = await apiRequest('/api/allowances');

    setAllowances(response.data || []);
  } catch (err) {
    const message =
      err.message || 'Unable to load allowance records.';

    setError(message);
    setLoadError(message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadAllowances();
  }, []);

  const totalAllowances = allowances.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const currentMonthKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

  const monthlyAllowances = allowances
    .filter((item) => String(item.dateReceived || '').slice(0, 7) === currentMonthKey)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const latestAllowance =
    allowances.length > 0
      ? [...allowances].sort(
          (a, b) =>
            new Date(b.dateReceived) - new Date(a.dateReceived)
        )[0]
      : null;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleDateReceivedChange = (date) => {
      setFieldErrors((previous) => ({
        ...previous,
        dateReceived: '',
      }));

    if (!date) {
      setForm((previous) => ({
        ...previous,
        dateReceived: '',
      }));
      return;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    setForm((previous) => ({
      ...previous,
      dateReceived: `${year}-${month}-${day}`,
    }));
  };

  // ADD OR UPDATE ALLOWANCE
  
  // Validate the form and ask for confirmation
  const handleSubmit = (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  setShowConfirm(true);
};

  // Save only after user confirms
  const handleConfirmSave = async () => {
    const amount = Number(form.amount);

    const allowanceData = {
      source: form.source.trim(),
      amount,
      dateReceived: form.dateReceived,
      description: form.description.trim(),
    };

    try {
      setSaving(true);
      setError('');

      if (editingId !== null) {
        await apiRequest(`/api/allowances/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(allowanceData),
        });
      } else {
        await apiRequest('/api/allowances', {
          method: 'POST',
          body: JSON.stringify(allowanceData),
        });
      }

      await loadAllowances();

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setShowConfirm(false);
    } catch (err) {
      setError(err.message || 'Unable to save allowance record.');
    } finally {
      setSaving(false);
    }
  };

  // EDIT ALLOWANCE
  const handleEdit = (item) => {
    setForm({
      source: item.source,
      amount: String(item.amount),
      dateReceived: item.dateReceived,
      description: item.description || '',
    });

    setEditingId(item.id);
    setShowForm(true);
  };

  // DELETE ALLOWANCE
  // Open delete confirmation
const handleDelete = (id) => {
  setPendingDeleteId(id);
};

// Delete only after confirmation
const handleConfirmDelete = async () => {
  try {
    setError('');

    await apiRequest(`/api/allowances/${pendingDeleteId}`, {
      method: 'DELETE',
    });

    setPendingDeleteId(null);
    await loadAllowances();
  } catch (err) {
    setError(err.message || 'Unable to delete allowance record.');
  }
};

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFieldErrors({});
  };

  const allowanceSources = [
  ...new Set(
    allowances
      .map((item) => item.source?.trim())
      .filter(Boolean)
  ),
];

const filteredAllowances = allowances.filter((item) => {
  const matchesSearch =
    `${item.source} ${item.description || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());

  const matchesSource =
    sourceFilter === 'All' || item.source === sourceFilter;

  return matchesSearch && matchesSource;
});

  return (
    <div className="allowances-page">
      <div className="module-heading">
        <div>
          <h2>Allowances Management</h2>
          <p>Record and monitor your income and allowances.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setFieldErrors({});
            setError('');
            setShowForm(true);
          }}
        >
          + Add Allowance
        </button>
      </div>

      
{error && (
  <div className="error-message" role="alert">
    <p>{error}</p>

    {loadError && (
      <button
        className="text-button"
        onClick={loadAllowances}
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
          <span>Total Allowance Records</span>
          <strong>{allowances.length}</strong>
        </div>

        <div className="module-stat">
          <span>Total Allowances Received</span>
          <strong>{formatCurrency(totalAllowances)}</strong>
        </div>

        <div className="module-stat">
          <span>Allowances This Month</span>
          <strong>{formatCurrency(monthlyAllowances)}</strong>
        </div>

        <div className="module-stat">
          <span>Latest Allowance</span>
          <strong>
            {formatCurrency(latestAllowance?.amount || 0)}
          </strong>
        </div>
      </div>

      
{showForm && (
  <div className="installment-modal-overlay">
    <div
      className="installment-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="allowance-modal-title"
    >
      <div className="installment-modal-header">
        <div>
          <h3 id="allowance-modal-title">
            {editingId !== null ? 'Edit Allowance' : 'Add New Allowance'}
          </h3>
          <p>Enter your allowance and income details.</p>
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


          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <label>
                Allowance Source
                <input
                  type="text"
                  name="source"
                  value={form.source}
                  onChange={handleChange}
                  placeholder="e.g. Monthly Allowance"
                  aria-invalid={Boolean(fieldErrors.source)}
                  required
                />
                {fieldErrors.source && (
                  <span className="field-error">{fieldErrors.source}</span>
                )}
              </label>

              <label>
                Amount Received (₱)
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 5000"
                  aria-invalid={Boolean(fieldErrors.amount)}
                  required
                />
                {fieldErrors.amount && (
                  <span className="field-error">{fieldErrors.amount}</span>
                )}
              </label>

              <label>
                Date Received
                <DatePicker
                  selected={
                    form.dateReceived
                      ? new Date(`${form.dateReceived}T00:00:00`)
                      : null
                  }
                  onChange={handleDateReceivedChange}
                  dateFormat="MM/dd/yyyy"
                  placeholderText="Select date received"
                  className="duewise-datepicker"
                  calendarClassName="duewise-calendar"
                  showPopperArrow={false}
                  aria-invalid={Boolean(fieldErrors.dateReceived)}
                  required
                />
                {fieldErrors.dateReceived && (
                  <span className="field-error">{fieldErrors.dateReceived}</span>
                )}
              </label>

              <label>
                Description
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Optional details"
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
                  : editingId !== null
                    ? 'Save Changes'
                    : 'Add Allowance'}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      <div className="installment-record-layout allowance-record-layout">
                {/* LEFT: ALLOWANCE RECORDS */}
                <div className="installment-record-list">
                  <h3>My Allowances</h3>

                  <div className="module-toolbar">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search allowance records..."
                  />

                  <CustomDropdown
                    value={sourceFilter}
                    options={[
                      { value: 'All', label: 'All Sources' },
                      ...allowanceSources.map((source) => ({
                        value: source,
                        label: source,
                      })),
                    ]}
                    onChange={setSourceFilter}
                  />
                </div>

                <div className="installment-record-items">
                  {loading ? (
                    <p>Loading allowance records...</p>
                  ) : filteredAllowances.length > 0 ? (
                    filteredAllowances.map((item) => (

                  <button
                    type="button"
                    key={item.id}
                    className={`installment-record-item ${
                      selectedAllowanceId === item.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedAllowanceId(item.id)}
                  >
                    <span>
                      <strong>{item.source}</strong>
                      <br />
                      <small>{formatCurrency(item.amount)}</small>
                    </span>
                    <span className="status paid">Received</span>
                </button>

                
              ))
            ) : (
              <p className="empty-message">No allowance records found.</p>
            )}
          </div>
          </div>

          {/* RIGHT: SELECTED ALLOWANCE DETAILS */}
                <div className="installment-record-details">
                  {selectedAllowance ? (
                    <>
                      <h3>Allowance Details</h3>

                      <div className="receipt-details">
                        <p className="receipt-label">ALLOWANCE SOURCE</p>
                        <h2>{selectedAllowance.source}</h2>

                        <hr />

                        <p className="receipt-label">AMOUNT RECEIVED</p>
                        <h3>{formatCurrency(selectedAllowance.amount)}</h3>

                        <p className="receipt-label">DATE RECEIVED</p>
                        <strong>{selectedAllowance.dateReceived}</strong>

                        <p className="receipt-label">DESCRIPTION</p>
                        <strong>
                          {selectedAllowance.description || 'No description provided'}
                        </strong>
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(selectedAllowance)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(selectedAllowance.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-message">
                      <h3>No Allowance Selected</h3>
                      <p>Select an allowance from the left to view its details.</p>
                    </div>
                  )}
                </div>
      </div>
      </>
    )}
    
      {showConfirm && (
        <ConfirmDialog
          title={
            editingId !== null
              ? 'Save Allowance Changes?'
              : 'Add New Allowance?'
          }
          message={
            editingId !== null
              ? 'Are you sure you want to save the changes to this allowance?'
              : 'Please confirm that you want to add this allowance to your records.'
          }
          confirmText={
            editingId !== null ? 'Save Changes' : 'Add Allowance'
          }
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirm(false)}
          loading={saving}
        />
      )}
      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete Allowance?"
          message="Are you sure you want to delete this allowance record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}

export default Allowances;
