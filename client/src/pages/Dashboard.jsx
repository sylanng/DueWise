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
      <div className="page-header">
        <h1>Dashboard</h1>
        {proj && (
          <span className="muted">
            As of {formatDate(proj.asOf)} · next {daysUntil(proj.asOf, proj.horizonEnd)} days
          </span>
        )}
      </div>

      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      {loading && !proj && <p className="muted">Loading your projection…</p>}

      {proj && (
        <>
          {proj.warning ? (
            <div className="banner banner-warning" role="alert">
              <span>
                <strong>Heads up:</strong> your balance is projected to fall below your{' '}
                {formatPeso(proj.reserveThreshold)} reserve on {formatDate(proj.firstWarningDate)}. Lowest point:{' '}
                {formatPeso(proj.lowest.amount)} on {formatDate(proj.lowest.date)}.
              </span>
            </div>
          ) : (
            <div className="banner banner-success">
              <span>
                <strong>You're on track:</strong> your balance stays above your {formatPeso(proj.reserveThreshold)}{' '}
                reserve through {formatDate(proj.horizonEnd)}.
              </span>
            </div>
          )}

          <div className="summary-grid">
            <SummaryCard label="Current balance" value={formatPeso(proj.currentBalance)} sub="Today" />
            <SummaryCard
              label="Lowest projected balance"
              value={formatPeso(proj.lowest.amount)}
              sub={formatDate(proj.lowest.date)}
              tone={proj.warning ? 'danger' : 'success'}
            />
            <SummaryCard label="Reserve threshold" value={formatPeso(proj.reserveThreshold)} sub="Warning level" />
            <SummaryCard label="Balance at end of period" value={formatPeso(proj.endBalance)} sub={formatDate(proj.horizonEnd)} />
          </div>

          <section className="card section">
            <h2>Projected balance</h2>
            <BalanceChart timeline={proj.timeline} threshold={proj.reserveThreshold} />
          </section>

          <section className="card section">
            <h2>Upcoming due dates</h2>
            {proj.upcomingDue.length === 0 ? (
              <p className="muted">No installments are due in this period.</p>
            ) : (
              <div className="rec-list">
                {proj.upcomingDue.slice(0, MAX_UPCOMING).map((u) => {
                  const status = getDisplayStatus({ status: 'pending', dueDate: u.dueDate }, proj.asOf);
                  const label = status.key === 'pending' ? `In ${u.daysUntil}d` : status.label;
                  return (
                    <div className="rec-row" key={`${u.installmentId}-${u.dueDate}`}>
                      <div className="rec-main">
                        <div className="rec-title">{u.provider}</div>
                        <div className="rec-meta muted">Due {formatDate(u.dueDate)}</div>
                      </div>
                      <span className={`badge badge-${status.key}`}>{label}</span>
                      <div className="rec-amount rec-amount-out">{formatPeso(u.amount)}</div>
                    </div>
                  );
                })}
                {proj.upcomingDue.length > MAX_UPCOMING && (
                  <p className="muted">…and {proj.upcomingDue.length - MAX_UPCOMING} more.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
