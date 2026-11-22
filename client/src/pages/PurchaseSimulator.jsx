
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import apiRequest from '../services/api';
import CustomDropdown from '../components/CustomDropdown';

function PurchaseSimulator() {
  const [currentProjectedBalance, setCurrentProjectedBalance] = useState(0);
  const [reserveLimit, setReserveLimit] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    purchaseName: '',
    purchaseAmount: '',
    installmentCount: '',
    firstDueDate: '',
  });

  const [result, setResult] = useState(null);
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [showResultsModal, setShowResultsModal] = useState(false);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);

    const loadFinancialData = async () => {
  try {
    setLoading(true);
    setError('');
    setLoadError('');

    const [
      allowanceResponse,
      expenseResponse,
      installmentResponse,
      settingsResponse,
    ] = await Promise.all([
      apiRequest('/api/allowances'),
      apiRequest('/api/expenses'),
      apiRequest('/api/installments'),
      apiRequest('/api/settings'),
    ]);

    const allowances = allowanceResponse.data || [];
    const expenses = expenseResponse.data || [];
    const installments = installmentResponse.data || [];

    const totalAllowances = allowances.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalExpenses = expenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const remainingInstallments = installments.reduce(
      (sum, item) => {
        if (item.status === 'paid') return sum;

        const remainingPayments = Math.max(
          0,
          Number(item.totalPayments || 0) -
            Number(item.paidPayments || 0)
        );

        return (
          sum +
          Number(item.amountPerPayment || 0) *
            remainingPayments
        );
      },
      0
    );

    const savedSettings = settingsResponse.data || {};

    const openingBalance = Number(
      savedSettings.openingBalance ?? 0
    );

    const savedReserveLimit = Number(
      savedSettings.reserveLimit ?? 2000
    );

    setReserveLimit(savedReserveLimit);

    const projectedBalance =
      openingBalance +
      totalAllowances -
      totalExpenses -
      remainingInstallments;

    setCurrentProjectedBalance(projectedBalance);
  } catch (err) {
    console.error('Purchase Simulator Error:', err);

    const message =
      err.message || 'Unable to load your financial information.';

    setError(message);
    setLoadError(message);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadFinancialData();
}, []);

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

    setResult(null);
  };

  const handleFirstDueDateChange = (date) => {
    if (!date) {
      setForm((previous) => ({
        ...previous,
        firstDueDate: '',
      }));

      setFieldErrors((previous) => ({
        ...previous,
        firstDueDate: '',
      }));

      setResult(null);
      return;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    setForm((previous) => ({
      ...previous,
      firstDueDate: `${year}-${month}-${day}`,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      firstDueDate: '',
    }));

    setResult(null);
  };

  
const handleSimulation = (event) => {
  event.preventDefault();

  const errors = {};
  const purchaseAmount = Number(form.purchaseAmount);
  const installmentCount = Number(form.installmentCount);

  // Purchase name
  if (!form.purchaseName.trim()) {
    errors.purchaseName = 'Please enter a purchase name.';
  } else if (form.purchaseName.trim().length < 2) {
    errors.purchaseName = 'Purchase name must contain at least 2 characters.';
  }

  // Purchase amount
  if (form.purchaseAmount.trim() === '') {
    errors.purchaseAmount = 'Please enter the purchase amount.';
  } else if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
    errors.purchaseAmount = 'Purchase amount must be greater than ₱0.';
  } else if (purchaseAmount > 10000000) {
    errors.purchaseAmount = 'Purchase amount cannot exceed ₱10,000,000.';
  } else if (Math.round(purchaseAmount * 100) !== purchaseAmount * 100) {
    errors.purchaseAmount = 'Please enter no more than 2 decimal places.';
  }

  // Number of installments
  if (form.installmentCount.trim() === '') {
    errors.installmentCount = 'Please enter the number of installments.';
  } else if (!Number.isInteger(installmentCount)) {
    errors.installmentCount = 'Installment count must be a whole number.';
  } else if (installmentCount < 1 || installmentCount > 60) {
    errors.installmentCount = 'Enter between 1 and 60 installments.';
  }

  // First payment due date
  if (!form.firstDueDate) {
    errors.firstDueDate = 'Please select the first payment due date.';
  } else if (
    Number.isNaN(new Date(`${form.firstDueDate}T00:00:00`).getTime())
  ) {
    errors.firstDueDate = 'Please select a valid payment due date.';
  }

  setFieldErrors(errors);

  if (Object.keys(errors).length > 0) {
    return;
  }

  const paymentPerInstallment = purchaseAmount / installmentCount;

  // Generate the proposed monthly payment schedule.
  const firstDate = new Date(`${form.firstDueDate}T12:00:00`);
  const paymentSchedule = [];

  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(firstDate);

    if (paymentFrequency === 'weekly') {
      dueDate.setDate(firstDate.getDate() + i * 7);
    } else if (paymentFrequency === 'biweekly') {
      dueDate.setDate(firstDate.getDate() + i * 14);
    } else if (paymentFrequency === 'monthly') {
      const originalDay = firstDate.getDate();

      dueDate.setDate(1);
      dueDate.setMonth(firstDate.getMonth() + i);

      const lastDayOfMonth = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth() + 1,
        0
      ).getDate();

      dueDate.setDate(Math.min(originalDay, lastDayOfMonth));
    }

    const projectedBalance =
      currentProjectedBalance - paymentPerInstallment * (i + 1);

    paymentSchedule.push({
      paymentNumber: i + 1,
      dueDate: dueDate.toISOString().slice(0, 10),
      paymentAmount: paymentPerInstallment,
      projectedBalance,
    });
  }

  const projectedBalanceAfterPayment =
    paymentSchedule[0].projectedBalance;

  const remainingBalanceAfterPurchase =
    currentProjectedBalance - purchaseAmount;

  const lowestProjectedBalance = Math.min(
    ...paymentSchedule.map((payment) => payment.projectedBalance)
  );

  let status;

  if (lowestProjectedBalance < 0) {
    status = {
      label: 'Insufficient Funds',
      description:
        'Your projected balance becomes negative during the installment schedule.',
      className: 'danger',
    };
  } else if (lowestProjectedBalance < reserveLimit) {
    status = {
      label: 'High Financial Risk',
      description:
        'At least one future installment would bring your balance below your reserve limit.',
      className: 'warning',
    };
  } else {
    status = {
      label: 'Affordable Based on Payment Schedule',
      description:
        'Your projected balance remains above your reserve limit throughout the proposed payment schedule.',
      className: 'healthy',
    };
  }

  setResult({
    purchaseAmount,
    installmentCount,
    paymentPerInstallment,
    projectedBalanceAfterPayment,
    remainingBalanceAfterPurchase,
    lowestProjectedBalance,
    paymentSchedule,
    status,
  });
  setShowResultsModal(true);
};


  const handleReset = () => {
    setForm({
      purchaseName: '',
      purchaseAmount: '',
      installmentCount: '',
      firstDueDate: '',
    });

    setFieldErrors({});
    setPaymentFrequency('monthly');
    setResult(null);
    setShowResultsModal(false);
  };

  if (loading) {
    return <p>Loading your financial information...</p>;
  }

  return (
    <div className="simulator-page">
      <div className="module-heading">
        <div>
          <h2>Purchase Simulator</h2>
          <p>
            Evaluate a possible BNPL purchase before committing to it.
          </p>
        </div>

        <span className="demo-label">HYPOTHETICAL</span>
      </div>

      {error && (
  <div className="error-message" role="alert">
    <p>{error}</p>

    {loadError && (
      <button
        className="text-button"
        onClick={loadFinancialData}
        disabled={loading}
      >
        {loading ? 'Retrying...' : 'Retry'}
      </button>
    )}
  </div>
)}

    {!loadError && (
    <>
      <div className="simulator-notice">
        <strong>Simulation only</strong>
        <p>
          This tool estimates the financial impact of a proposed purchase.
          It will not create or save an installment record.
        </p>
      </div>

      <div
        className={`simulator-balance-card ${
          currentProjectedBalance < 0
            ? 'balance-danger'
            : currentProjectedBalance < reserveLimit
              ? 'balance-warning'
              : 'balance-healthy'
        }`}
      >
        <span>Current Projected Balance</span>

        <strong>{formatCurrency(currentProjectedBalance)}</strong>

        <small>
          Minimum reserve limit: {formatCurrency(reserveLimit)}
        </small>

        <div className="balance-status-label">
          {currentProjectedBalance < 0
            ? 'Insufficient Funds'
            : currentProjectedBalance < reserveLimit
              ? 'Below Minimum Reserve'
              : 'Healthy Balance'}
        </div>
      </div>

      <div className="form-card simulator-form-card">
        <h3>Purchase Details</h3>
        <p className="projection-description">
          Enter the details of the purchase you want to evaluate.
        </p>

        <form onSubmit={handleSimulation} noValidate>
          <div className="form-grid">
            <label>
              Purchase Name
              <input
                type="text"
                name="purchaseName"
                value={form.purchaseName}
                onChange={handleChange}
                placeholder="e.g. New Smartphone"
                className={fieldErrors.purchaseName ? 'field-invalid' : ''}
                aria-invalid={Boolean(fieldErrors.purchaseName)}
              />
              {fieldErrors.purchaseName && (
                <span className="field-error">{fieldErrors.purchaseName}</span>
              )}
            </label>

            <label>
              Total Purchase Amount (₱)
              <input
                type="number"
                name="purchaseAmount"
                value={form.purchaseAmount}
                onChange={handleChange}
                min="0.01"
                step="0.01"
                placeholder="e.g. 12000"
                className={fieldErrors.purchaseAmount ? 'field-invalid' : ''}
                aria-invalid={Boolean(fieldErrors.purchaseAmount)}
              />
              {fieldErrors.purchaseAmount && (
                <span className="field-error">{fieldErrors.purchaseAmount}</span>
              )}
            </label>

            <label>
              Number of Installments

              <div className="installment-input-wrapper">
                <input
                  type="number"
                  name="installmentCount"
                  value={form.installmentCount}
                  onChange={handleChange}
                  min="1"
                  max="60"
                  step="1"
                  placeholder="Enter number"
                  className={fieldErrors.installmentCount ? 'field-invalid' : ''}
                  aria-invalid={Boolean(fieldErrors.installmentCount)}
                />

                <span>
                  {Number(form.installmentCount) === 1
                    ? 'Installment'
                    : 'Installments'}
                </span>
              </div>

              {fieldErrors.installmentCount && (
                <span className="field-error">{fieldErrors.installmentCount}</span>
              )}
            </label>

            <label>
              Payment Frequency

              <div className="payment-frequency-control">
                <CustomDropdown
                  value={paymentFrequency}
                  options={[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'biweekly', label: 'Every two weeks' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  onChange={(value) => {
                    setPaymentFrequency(value);
                    setResult(null);
                  }}
                />
              </div>

              <small className="installment-frequency-note">
                Payments are scheduled {
                  paymentFrequency === 'weekly'
                    ? 'every week.'
                    : paymentFrequency === 'biweekly'
                      ? 'every two weeks.'
                      : 'every month.'
                }
              </small>
            </label>

            <label>
              First Payment Due Date
              <DatePicker
                selected={
                  form.firstDueDate
                    ? new Date(`${form.firstDueDate}T00:00:00`)
                    : null
                }
                onChange={handleFirstDueDateChange}
                dateFormat="MM/dd/yyyy"
                placeholderText="Select first payment due date"
                className={`duewise-datepicker ${
                  fieldErrors.firstDueDate ? 'field-invalid' : ''
                }`}
                calendarClassName="duewise-calendar"
                showPopperArrow={false}
              />
              {fieldErrors.firstDueDate && (
                <span className="field-error">{fieldErrors.firstDueDate}</span>
              )}
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleReset}
            >
              Reset
            </button>

            <button type="submit" className="primary-button">
              Simulate Purchase
            </button>
          </div>
        </form>
      </div>

      {result && showResultsModal && (
        <div className="simulator-results-modal-overlay">
          <div className="simulator-results-modal">
            <div className="simulator-results-modal-header">
              <span>Purchase Simulation</span>
              <button
                type="button"
                className="simulator-results-close"
                onClick={() => setShowResultsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="form-card">
            <h3>Simulation Results</h3>

            <p className="simulator-purchase-name">
              {form.purchaseName}
            </p>

            <div className="simulator-result-grid">
              <div className="module-stat">
                <span>Total Purchase Amount</span>
                <strong>{formatCurrency(result.purchaseAmount)}</strong>
              </div>

              <div className="module-stat">
                <span>Payment per Installment</span>
                <strong>
                  {formatCurrency(result.paymentPerInstallment)}
                </strong>
              </div>

              <div className="module-stat">
                <span>Number of Payments</span>
                <strong>{result.installmentCount}</strong>
              </div>
            </div>

            <div className={`financial-status ${result.status.className}`}>
              <strong>{result.status.label}</strong>
              <span>{result.status.description}</span>
            </div>

            
          <div className="projection-breakdown">
            <div>
              <span>Current Projected Balance</span>
              <strong>{formatCurrency(currentProjectedBalance)}</strong>
            </div>

            <div>
              <span>First Installment Payment</span>
              <strong className="projection-negative">
                - {formatCurrency(result.paymentPerInstallment)}
              </strong>
            </div>

            <div className="projection-total">
              <span>Balance After First Payment</span>
              <strong>
                {formatCurrency(result.projectedBalanceAfterPayment)}
              </strong>
            </div>

            <div
              className={
                result.remainingBalanceAfterPurchase < 0
                  ? 'projection-balance-negative'
                  : result.remainingBalanceAfterPurchase > 0
                  ? 'projection-balance-positive'
                  : 'projection-balance-zero'
              }
            >
              <span>Balance If Entire Purchase Is Paid Now</span>
              <strong>
                {formatCurrency(result.remainingBalanceAfterPurchase)}
              </strong>
            </div>
          </div>

          <div className="simulator-schedule-card">
            <h3>Projected Installment Schedule</h3>
            <p className="projection-description">
              Review your estimated balance after each scheduled payment.
            </p>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Due Date</th>
                    <th>Payment Amount</th>
                    <th>Projected Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {result.paymentSchedule.map((payment) => {
                    const [year, month, day] = payment.dueDate.split('-');

                    const formattedDate = new Date(
                      Number(year),
                      Number(month) - 1,
                      Number(day)
                    ).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <tr key={payment.paymentNumber}>
                        <td>Payment {payment.paymentNumber}</td>
                        <td>{formattedDate}</td>
                        <td>{formatCurrency(payment.paymentAmount)}</td>
                        <td>{formatCurrency(payment.projectedBalance)}</td>
                        <td>
                          <span
                            className={
                              payment.projectedBalance < 0
                                ? 'status-danger'
                                : payment.projectedBalance < reserveLimit
                                ? 'status-warning'
                                : 'status-paid'
                            }
                          >
                            {payment.projectedBalance < 0
                              ? 'Insufficient'
                              : payment.projectedBalance < reserveLimit
                              ? 'Below Reserve'
                              : 'Healthy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="simulator-disclaimer">
            This simulation evaluates every proposed installment payment using
            your current projected balance. It assumes equal monthly payments
            without interest, fees, or additional future income and expenses.
            Actual provider terms may differ.
          </p>
          </div>
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
}

export default PurchaseSimulator;
