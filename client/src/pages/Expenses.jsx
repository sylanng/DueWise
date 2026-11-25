
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import apiRequest from '../services/api';
import CustomDropdown from '../components/CustomDropdown';

import ConfirmDialog from '../components/ConfirmDialog';

function Expenses() {
  const [expenses, setExpenses] = useState([]);

  const emptyForm = {
    title: '',
    category: 'Food',
    amount: '',
    date: '',
    description: '',
  };

  const categories = [
    'Food',
    'Transportation',
    'Education',
    'Shopping',
    'Bills',
    'Others',
  ];

  const [form, setForm] = useState(emptyForm);
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
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const selectedExpense = expenses.find(
    (item) => item.id === selectedExpenseId
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

  // LOAD EXPENSES FROM FIRESTORE THROUGH THE BACKEND
  
const loadExpenses = async () => {
  try {
    setLoading(true);
    setError('');
    setLoadError('');

    const response = await apiRequest('/api/expenses');

    setExpenses(response.data || []);
  } catch (err) {
    const message = err.message || 'Unable to load expenses.';

    setError(message);
    setLoadError(message);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    loadExpenses();
  }, []);

  const totalExpenses = expenses.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const currentMonthKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

  const monthlyExpenses = expenses
    .filter((item) => String(item.date || '').slice(0, 7) === currentMonthKey)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const handleChange = (event) => {
  const { name, value } = event.target;

  setForm((previous) => ({
    ...previous,
    [name]: value,
  }));

  setFieldErrors((previous) => ({
    ...previous,
    [name]: '',
  }));
};

  const handleExpenseDateChange = (date) => {
  if (!date) {
    setForm((previous) => ({
      ...previous,
      date: '',
    }));

    setFieldErrors((previous) => ({
      ...previous,
      date: '',
    }));

    return;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  setForm((previous) => ({
    ...previous,
    date: `${year}-${month}-${day}`,
  }));

  setFieldErrors((previous) => ({
    ...previous,
    date: '',
  }));
};

  const validateForm = () => {
  const errors = {};

  if (!form.title.trim()) {
    errors.title = 'Please enter the expense name.';
  }

  if (!form.category) {
    errors.category = 'Please select an expense category.';
  }

  const amount = Number(form.amount);

  if (form.amount === '') {
    errors.amount = 'Please enter the expense amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than ₱0.';
  }

  if (!form.date) {
    errors.date = 'Please select the expense date.';
  } else if (
    Number.isNaN(new Date(`${form.date}T00:00:00`).getTime())
  ) {
    errors.date = 'Please select a valid expense date.';
  }

  setFieldErrors(errors);
  return Object.keys(errors).length === 0;
};

  // ADD OR UPDATE EXPENSE
  // OPEN CONFIRMATION BEFORE ADDING OR UPDATING
const handleSubmit = (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  setError('');
  setShowConfirm(true);
};

// SAVE EXPENSE AFTER CONFIRMATION
const handleConfirmSave = async () => {
  const amount = Number(form.amount);

  const expenseData = {
    title: form.title.trim(),
    category: form.category,
    amount,
    date: form.date,
    description: form.description.trim(),
  };

  try {
    setSaving(true);
    setError('');

    if (editingId !== null) {
      await apiRequest(`/api/expenses/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(expenseData),
      });
    } else {
      await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseData),
      });
    }

    await loadExpenses();

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setShowConfirm(false);
  } catch (err) {
    setError(err.message || 'Unable to save expense.');
  } finally {
    setSaving(false);
  }
};

  // EDIT EXPENSE
  const handleEdit = (item) => {
    setForm({
      title: item.title,
      category: item.category,
      amount: String(item.amount),
      date: item.date,
      description: item.description || '',
    });

    setEditingId(item.id);
    setShowForm(true);
  };

  // DELETE EXPENSE
  // OPEN DELETE CONFIRMATION
const handleDelete = (id) => {
  setPendingDeleteId(id);
};

// DELETE EXPENSE AFTER CONFIRMATION
const handleConfirmDelete = async () => {
  try {
    setError('');

    await apiRequest(`/api/expenses/${pendingDeleteId}`, {
      method: 'DELETE',
    });

    setPendingDeleteId(null);
    await loadExpenses();
  } catch (err) {
    setError(err.message || 'Unable to delete expense.');
  }
};

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFieldErrors({});
  };

  // SEARCH AND CATEGORY FILTER
  const filteredExpenses = expenses.filter((item) => {
    const matchesSearch =
      `${item.title} ${item.description || ''} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesFilter =
      filter === 'All' || item.category === filter;

    return matchesSearch && matchesFilter;
  });

  // CALCULATE CATEGORY TOTALS
  const categoryTotals = categories.map((category) => ({
    name: category,
    total: expenses
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }));

  const highestCategory = categoryTotals.reduce(
    (highest, item) =>
      item.total > highest.total ? item : highest,
    { name: 'None', total: 0 }
  );

  return (
    <div className="expenses-page">
      <div className="module-heading">
        <div>
          <h2>Expenses Management</h2>
          <p>Track and manage your daily spending.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setFieldErrors({});
            setShowForm(true);
            setError('');
          }}
        >
          + Add Expense
        </button>
      </div>

      
{error && (
  <div className="error-message" role="alert">
    <p>{error}</p>

    {loadError && (
      <button
        className="text-button"
        onClick={loadExpenses}
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
          <span>Total Expense Records</span>
          <strong>{expenses.length}</strong>
        </div>

        <div className="module-stat">
          <span>Total Expenses</span>
          <strong>{formatCurrency(totalExpenses)}</strong>
        </div>

        <div className="module-stat">
          <span>Expenses This Month</span>
          <strong>{formatCurrency(monthlyExpenses)}</strong>
        </div>

        <div className="module-stat">
          <span>Highest Spending Category</span>
          <strong>{highestCategory.name}</strong>
        </div>
      </div>

      
{showForm && (
  <div className="installment-modal-overlay">
    <div
      className="installment-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div className="installment-modal-header">
        <div>
          <h3 id="expense-modal-title">
            {editingId !== null ? 'Edit Expense' : 'Add New Expense'}
          </h3>
          <p>Enter your expense and spending details.</p>
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
                Expense Name
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Grocery Shopping"
                  aria-invalid={Boolean(fieldErrors.title)}
                />

                {fieldErrors.title && (
                  <span className="field-error">{fieldErrors.title}</span>
                )}
              </label>

              <label>
                Category
                <div className="expense-category-control">
                  <CustomDropdown
                    value={form.category}
                    options={categories.map((category) => ({
                      value: category,
                      label: category,
                    }))}
                    onChange={(value) => {
                      setForm((previous) => ({
                        ...previous,
                        category: value,
                      }));

                      setFieldErrors((previous) => ({
                        ...previous,
                        category: '',
                      }));
                    }}
                  />
                </div>

                {fieldErrors.category && (
                  <span className="field-error">{fieldErrors.category}</span>
                )}
              </label>

              <label>
                Amount (₱)
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 500"
                  aria-invalid={Boolean(fieldErrors.amount)}
                />

                {fieldErrors.amount && (
                  <span className="field-error">{fieldErrors.amount}</span>
                )}
              </label>

              <label>
                Expense Date
                <DatePicker
                  selected={
                    form.date
                      ? new Date(`${form.date}T00:00:00`)
                      : null
                  }
                  onChange={handleExpenseDateChange}
                  dateFormat="MM/dd/yyyy"
                  placeholderText="Select expense date"
                  className="duewise-datepicker"
                  calendarClassName="duewise-calendar"
                  showPopperArrow={false}
                  ariaInvalid={Boolean(fieldErrors.date)}
                />

                {fieldErrors.date && (
                  <span className="field-error">{fieldErrors.date}</span>
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
                    : 'Add Expense'}
              </button>
            </div>
            </form>
            </div>
          </div>
        )}

      <div className="installment-record-layout expense-record-layout">
        {/* LEFT: EXPENSE RECORDS */}
        <div className="installment-record-list">
          <h3>My Expenses</h3>
          <div className="module-toolbar">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search expenses..."
          />

          <CustomDropdown
            value={filter}
            options={[
              { value: 'All', label: 'All Categories' },
              ...categories.map((category) => ({
                value: category,
                label: category,
              })),
            ]}
            onChange={(value) => {
              setFilter(value);
              setSelectedExpenseId(null);
            }}
          />
        </div>

        <div className="installment-record-items">
          {loading ? (
            <p>Loading expenses...</p>
          ) : filteredExpenses.length > 0 ? (
            filteredExpenses.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`installment-record-item ${
                  selectedExpenseId === item.id ? 'active' : ''
                }`}
                onClick={() => setSelectedExpenseId(item.id)}
              >
                <span>
                  <strong>{item.title}</strong>
                  <br />
                  <small>{item.category}</small>
                </span>

                <strong>{formatCurrency(item.amount)}</strong>
              </button>
            ))
          ) : (
            <p className="empty-message">No expense records found.</p>
          )}
          </div>
        </div>

        {/* RIGHT: SELECTED EXPENSE DETAILS */}
        <div className="installment-record-details">
          {selectedExpense ? (
            <>
              <h3>Expense Details</h3>

              <div className="receipt-details">
                <p className="receipt-label">EXPENSE NAME</p>
                <h2>{selectedExpense.title}</h2>

                <hr />

                <p className="receipt-label">AMOUNT SPENT</p>
                <h3>{formatCurrency(selectedExpense.amount)}</h3>

                <p className="receipt-label">CATEGORY</p>
                <strong>{selectedExpense.category}</strong>

                <p className="receipt-label">EXPENSE DATE</p>
                <strong>{selectedExpense.date}</strong>

                <p className="receipt-label">DESCRIPTION</p>
                <strong>
                  {selectedExpense.description || 'No description provided'}
                </strong>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="edit-button"
                  onClick={() => handleEdit(selectedExpense)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() => handleDelete(selectedExpense.id)}
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="empty-message">
              <h3>No Expense Selected</h3>
              <p>Select an expense from the left to view its details.</p>
            </div>
          )}
        </div>
      </div>

      <div className="form-card category-breakdown">
        <h3>Expense Breakdown by Category</h3>

        {categoryTotals.map((item) => (
          <div className="category-row" key={item.name}>
            <span>{item.name}</span>
            <strong>{formatCurrency(item.total)}</strong>
          </div>
        ))}
      </div>
      </>
    )}
          {showConfirm && (
        <ConfirmDialog
          title={editingId !== null ? 'Save Expense Changes?' : 'Add New Expense?'}
          message={
            editingId !== null
              ? 'Are you sure you want to save the changes to this expense?'
              : 'Please confirm that you want to add this expense to your records.'
          }
          confirmText={editingId !== null ? 'Save Changes' : 'Add Expense'}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirm(false)}
          loading={saving}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete Expense?"
          message="Are you sure you want to delete this expense record? This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
      
    </div>
  );
}

export default Expenses;
