
import { useEffect, useState } from 'react';
import apiRequest from '../services/api';

function Projection() {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProjectionData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiRequest('/api/projection');

      if (!response.data) {
        throw new Error('Financial projection data is unavailable.');
      }

      setProjection(response.data);
    } catch (err) {
      console.error('Projection loading error:', err);
      setError(err.message || 'Unable to load financial projection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectionData();
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

  const formatDate = (date) => {
    if (!date) return 'Not available';

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not available';
    }

    return parsedDate.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="projection-page">
        <h2>Loading financial projection...</h2>
      </div>
    );
  }

  if (error || !projection) {
    return (
      <div className="projection-page">
        <div className="module-heading">
          <div>
            <h2>Financial Projection</h2>
            <p>Review your actual and projected financial position.</p>
          </div>
        </div>

        <div className="error-message" role="alert">
          <p>{error || 'Financial projection data is unavailable.'}</p>

          <button
            type="button"
            className="text-button"
            onClick={loadProjectionData}
            disabled={loading}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const {
    summary,
    futureCashFlows,
    projectionTimeline,
    trackingStartDate,
  } = projection;

  const financialStatus =
    summary.projectedBalance < 0
      ? {
          label: 'Insufficient Balance',
          description: 'Your expected outflows exceed your available funds.',
          className: 'danger',
        }
      : summary.projectedBalance <= summary.reserveLimit
        ? {
            label: 'Low Balance Warning',
            description: 'Your projected balance is at or below your reserve limit.',
            className: 'warning',
          }
        : {
            label: 'Healthy Balance',
            description: 'Your projected balance is above your reserve limit.',
            className: 'healthy',
          };
  
  const getBalanceClass = (balance) => {
  const value = Number(balance);
  const reserve = Number(summary.reserveLimit) || 0;

  if (value < 0) {
    return 'projection-negative';
  }

  if (value <= reserve) {
    return 'projection-warning';
  }

  return 'projection-positive';
};

  return (
    <div className="projection-page">
      <div className="module-heading">
        <div>
          <h2>Financial Projection</h2>
          <p>
            Monitor your current balance and estimate your future
            financial position.
          </p>
        </div>

        <span className="demo-label">LIVE DATA</span>
      </div>

      <div
        className={`projection-main-card ${
          summary.actualBalance < 0
            ? 'actual-balance-danger'
            : summary.actualBalance < summary.reserveLimit
              ? 'actual-balance-warning'
              : 'actual-balance-healthy'
        }`}
      >
        <div className="projection-label">
          <span>Actual Available Balance</span>
          <span className="projection-icon">₱</span>
        </div>

        <h1>{formatCurrency(summary.actualBalance)}</h1>

        <p>
          Your balance based on recorded income, expenses, and confirmed payments.
        </p>

        <div
          className={`financial-status ${
            summary.actualBalance < 0
              ? 'danger'
              : summary.actualBalance < summary.reserveLimit
                ? 'warning'
                : 'healthy'
          }`}
        >
          <strong>
            {summary.actualBalance < 0
              ? 'Insufficient Funds'
              : summary.actualBalance < summary.reserveLimit
                ? 'Below Reserve Limit'
                : 'Above Reserve Limit'}
          </strong>

          <span>
            Your minimum reserve is {formatCurrency(summary.reserveLimit)}.
          </span>
        </div>
      </div>

      <div className="installment-summary projection-summary">
        <div className="module-stat">
          <span>Total Income Received</span>
          <strong className="projection-positive">
            {formatCurrency(summary.totalReceived)}
          </strong>
        </div>

        <div className="module-stat">
          <span>Total Recorded Expenses</span>
          <strong className="projection-negative">
            {formatCurrency(summary.totalExpenses)}
          </strong>
        </div>

        <div className="module-stat">
          <span>Confirmed BNPL Payments</span>
          <strong className="projection-negative">
            {formatCurrency(summary.totalBNPLPaid)}
          </strong>
        </div>
      </div>

      <div className="projection-content-grid">
        <div className="form-card">
          <h3>Financial Position</h3>

          <p className="projection-description">
            Your financial position from your selected tracking start date.
          </p>

          <div className="projection-breakdown">
            <div>
              <span>Starting Balance</span>
              <strong>{formatCurrency(summary.startingBalance)}</strong>
            </div>

            <div>
              <span>Income Received</span>
              <strong className="projection-positive">
                + {formatCurrency(summary.totalReceived)}
              </strong>
            </div>

            <div>
              <span>Recorded Expenses</span>
              <strong className="projection-negative">
                - {formatCurrency(summary.totalExpenses)}
              </strong>
            </div>

            <div>
              <span>Confirmed BNPL Payments</span>
              <strong className="projection-negative">
                - {formatCurrency(summary.totalBNPLPaid)}
              </strong>
            </div>

            <div className="projection-total">
              <span>Actual Available Balance</span>
              <strong>{formatCurrency(summary.actualBalance)}</strong>
            </div>
          </div>
        </div>

        <div className="form-card">
          <h3>Future Financial Outlook</h3>

          <p className="projection-description">
            Your balance after all currently recorded future cash flows.
          </p>

          <div className="projection-breakdown">
            <div>
              <span>Actual Available Balance</span>
              <strong>{formatCurrency(summary.actualBalance)}</strong>
            </div>

            <div>
              <span>Remaining BNPL Obligations</span>
              <strong className="projection-negative">
                {formatCurrency(summary.remainingBNPLBalance)}
              </strong>
            </div>

            <div className="projection-total">
              <span>Projected Balance</span>
              <strong className={getBalanceClass(summary.projectedBalance)}>
                {formatCurrency(summary.projectedBalance)}
              </strong>
            </div>
          </div>

          <div className={`financial-status ${financialStatus.className}`}>
            <strong>{financialStatus.label}</strong>
            <span>{financialStatus.description}</span>
          </div>
        </div>
      </div>

      <div className="form-card">
        <h3>Upcoming Financial Activities</h3>

        <p className="projection-description">
          Future income, expenses, and installment payments included
          in your projection.
        </p>

        {futureCashFlows.length === 0 ? (
          <div className="empty-state">
            <p>No future financial activities recorded yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Projected Balance</th>
                </tr>
              </thead>

              <tbody>
                {projectionTimeline.map((item, index) => (
                  <tr key={`${item.installmentId || item.description}-${index}`}>
                    <td>{formatDate(item.date)}</td>
                    <td>
                      {item.description}
                      {item.provider && (
                        <small> ({item.provider})</small>
                      )}
                    </td>
                    <td>
                      {item.type === 'income'
                        ? 'Income'
                        : item.type === 'expense'
                          ? 'Expense'
                          : 'Installment'}
                    </td>
                    <td className={
                      item.type === 'income'
                        ? 'projection-positive'
                        : 'projection-negative'
                    }>
                      {item.type === 'income' ? '+' : '-'}
                      {formatCurrency(item.amount)}
                    </td>
                    <td className={getBalanceClass(item.projectedBalance)}>
                      {formatCurrency(item.projectedBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="form-card projection-formula">
        <h3>Projection Information</h3>

        <p>
          Actual Balance = Starting Balance + Income Received
          − Recorded Expenses − Confirmed BNPL Payments
        </p>

        <p>
          Projected Balance = Actual Balance + Future Income
          − Future Expenses − Future Installment Payments
        </p>

        <p>
          Tracking Start Date: <strong>{formatDate(trackingStartDate)}</strong>
        </p>

        <p>
          Remaining BNPL obligations are displayed separately from
          your actual available balance.
        </p>
      </div>
    </div>
  );
}

export default Projection;
