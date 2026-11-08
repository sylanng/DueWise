
import { useCallback, useEffect, useState } from 'react';
import { getProjection } from '../services/api';
import { formatPeso, formatDate } from '../services/format';
import { daysUntil, getDisplayStatus } from '../services/installmentView';
import SummaryCard from '../components/SummaryCard.jsx';
import BalanceChart from '../components/BalanceChart.jsx';

const MAX_UPCOMING = 8;

export default function Dashboard() {
  const [proj, setProj] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setProj(await getProjection());
    } catch (err) {
      setError(err.message || 'Could not load your projection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* Dashboard Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          {proj && (
            <span className="muted">
              Your financial overview as of {formatDate(proj.asOf)}
              {' · '}
              Next {daysUntil(proj.asOf, proj.horizonEnd)} days
            </span>
          )}
        </div>

        <button
          className="btn btn-sm"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Loading */}
      {loading && !proj && (
        <p className="muted">Loading your financial overview...</p>
      )}

      {/* Error */}
      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {proj && (
        <>
          {/* Financial Warning */}
          {proj.warning ? (
            <div className="banner banner-warning" role="alert">
              <span>
                <strong>Low balance warning:</strong>{' '}
                Your projected balance will fall below your{' '}
                {formatPeso(proj.reserveThreshold)} reserve threshold on{' '}
                {formatDate(proj.firstWarningDate)}.
                {' '}Your lowest projected balance is{' '}
                {formatPeso(proj.lowest.amount)} on{' '}
                {formatDate(proj.lowest.date)}.
              </span>
            </div>
          ) : (
            <div className="banner banner-success">
              <span>
                <strong>You're on track!</strong>{' '}
                Your projected balance stays above your{' '}
                {formatPeso(proj.reserveThreshold)} reserve through{' '}
                {formatDate(proj.horizonEnd)}.
              </span>
            </div>
          )}

          {/* Financial Summary */}
          <div className="summary-grid">
            <SummaryCard
              label="Current balance"
              value={formatPeso(proj.currentBalance)}
              sub="Available balance today"
            />

            <SummaryCard
              label="Lowest projected balance"
              value={formatPeso(proj.lowest.amount)}
              sub={formatDate(proj.lowest.date)}
              tone={proj.warning ? 'danger' : 'success'}
            />

            <SummaryCard
              label="Reserve threshold"
              value={formatPeso(proj.reserveThreshold)}
              sub="Minimum balance target"
            />

            <SummaryCard
              label="End-of-period balance"
              value={formatPeso(proj.endBalance)}
              sub={formatDate(proj.horizonEnd)}
            />
          </div>

          {/* Cash Flow Projection */}
          <section className="card section">
            <h2>Projected Cash Flow</h2>

            <p className="muted">
              Track how your available balance changes based on
              recorded allowances, expenses, and BNPL installments.
            </p>

            <BalanceChart
              timeline={proj.timeline}
              threshold={proj.reserveThreshold}
            />
          </section>

          {/* Upcoming BNPL Payments */}
          <section className="card section">
            <div className="page-header">
              <div>
                <h2>Upcoming BNPL Installments</h2>
                <p className="muted">
                  Review your upcoming payment obligations and
                  scheduled early reminder dates.
                </p>
              </div>

              <span className="badge">
                {proj.upcomingDue.length} payments
              </span>
            </div>

            {proj.upcomingDue.length === 0 ? (
              <p className="muted">
                No installments are due within this planning period.
              </p>
            ) : (
              <div className="rec-list">
                {proj.upcomingDue
                  .slice(0, MAX_UPCOMING)
                  .map((u) => {
                    const status = getDisplayStatus(
                      {
                        status: 'pending',
                        dueDate: u.dueDate,
                      },
                      proj.asOf
                    );

                    const label =
                      status.key === 'pending'
                        ? `In ${u.daysUntil} days`
                        : status.label;

                    const reminderIsPast =
                      u.reminderDate < proj.asOf;

                    return (
                      <div
                        className="rec-row"
                        key={`${u.installmentId}-${u.dueDate}`}
                      >
                        <div className="rec-main">
                          <div className="rec-title">
                            {u.provider || 'BNPL Payment'}
                          </div>

                          <div className="rec-meta muted">
                            Due: {formatDate(u.dueDate)}
                          </div>

                          <div className="rec-meta muted">
                            Early reminder date:{' '}
                            {formatDate(u.reminderDate)}
                          </div>
                        </div>

                        <span
                          className={`badge badge-${status.key}`}
                        >
                          {label}
                        </span>

                        <div className="rec-amount rec-amount-out">
                          {formatPeso(u.amount)}
                        </div>
                      </div>
                    );
                  })}

                {proj.upcomingDue.length > MAX_UPCOMING && (
                  <p className="muted">
                    And {proj.upcomingDue.length - MAX_UPCOMING}
                    {' '}more upcoming payments.
                  </p>
                )}
              </div>
            )}

            <p className="muted">
              Reminder dates are calculated three calendar days
              before each installment due date. Actual notification
              delivery is not verified by this dashboard.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
