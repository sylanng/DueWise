
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import apiRequest from '../services/api';

function PurchaseSimulator() {
  const [currentProjectedBalance, setCurrentProjectedBalance] = useState(0);
  const [reserveLimit, setReserveLimit] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({
    purchaseName: '',
    purchaseAmount: '',
    installmentCount: '6',
    firstDueDate: '',
  });

  const [result, setResult] = useState(null);

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

    setResult(null);
  };

  const handleFirstDueDateChange = (date) => {
    if (!date) {
      setForm((previous) => ({
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

    setResult(null);
  };

  
const handleSimulation = (event) => {
  event.preventDefault();

  const purchaseAmount = Number(form.purchaseAmount);
  const installmentCount = Number(form.installmentCount);

  if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
    alert('Please enter a purchase amount greater than zero.');
    return;
  }

  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 60
  ) {
    alert('Please enter between 1 and 60 installments.');
    return;
  }

  if (!form.firstDueDate) {
    alert('Please select the first payment due date.');
    return;
  }

  const paymentPerInstallment = purchaseAmount / installmentCount;

  // Generate the proposed monthly payment schedule.
  const firstDate = new Date(`${form.firstDueDate}T12:00:00`);
  const paymentSchedule = [];

  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(firstDate);
    const originalDay = firstDate.getDate();

    dueDate.setDate(1);
    dueDate.setMonth(firstDate.getMonth() + i);

    const lastDayOfMonth = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth() + 1,
      0
    ).getDate();

    dueDate.setDate(Math.min(originalDay, lastDayOfMonth));

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
};


  const handleReset = () => {
    setForm({
      purchaseName: '',
      purchaseAmount: '',
      installmentCount: '6',
      firstDueDate: '',
    });

    setResult(null);
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

      <div className="simulator-balance-card">
        <span>Current Projected Balance</span>
        <strong>{formatCurrency(currentProjectedBalance)}</strong>
        <small>
          Minimum reserve limit: {formatCurrency(reserveLimit)}
        </small>
      </div>

      <div className="form-card simulator-form-card">
        <h3>Purchase Details</h3>
        <p className="projection-description">
          Enter the details of the purchase you want to evaluate.
        </p>

        <form onSubmit={handleSimulation}>
          <div className="form-grid">
            <label>
              Purchase Name
              <input
                type="text"
                name="purchaseName"
                value={form.purchaseName}
                onChange={handleChange}
                placeholder="e.g. New Smartphone"
                required
              />
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
                required
              />
            </label>

            <label>
              Number of Installments
              <select
                name="installmentCount"
                value={form.installmentCount}
                onChange={handleChange}
              >
                <option value="3">3 Installments</option>
                <option value="6">6 Installments</option>
                <option value="9">9 Installments</option>
                <option value="12">12 Installments</option>
                <option value="18">18 Installments</option>
                <option value="24">24 Installments</option>
              </select>
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
                className="duewise-datepicker"
                calendarClassName="duewise-calendar"
                showPopperArrow={false}
                required
              />
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

      {result && (
        <div className="simulator-results">
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

  <div>
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
      )}
      </>
      )}
    </div>
  );
}

export default PurchaseSimulator;
