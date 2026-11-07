import { useState } from 'react';
import { simulate, todayString } from '../services/api';
import { isBelowThreshold } from '../services/cashflow';
import { formatPeso, formatDate } from '../services/format';
import { validateSimulation, normalizeSimulation } from '../services/validation';
import { useToast } from '../hooks/useToast.js';
import FormField from '../components/FormField.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import BalanceChart from '../components/BalanceChart.jsx';

export default function Simulator() {
  const toast = useToast();
  const today = todayString();
  const [values, setValues] = useState({ amount: '', remainingPayments: 3, dueDate: today });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState(null); // the plan the current result belongs to
  const [running, setRunning] = useState(false);

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const check = validateSimulation(values, today);
    setErrors(check.errors);
    if (!check.isValid) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setRunning(true);
    try {
      const normalized = normalizeSimulation(values);
      setResult(await simulate(normalized));
      setPlan(normalized);
    } catch (err) {
      toast.error(err.message || 'Could not run the simulation. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setValues({ amount: '', remainingPayments: 3, dueDate: today });
    setErrors({});
    setResult(null);
    setPlan(null);
  }

  const cls = (field) => 'input' + (errors[field] ? ' invalid' : '');

  return (
    <div>
      <div className="page-header">
        <h1>Purchase Simulator</h1>
        <span className="muted">See what a new installment would do to your balance</span>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="sim-form">
          <FormField label="Payment amount (₱)" htmlFor="sim-amount" error={errors.amount}>
            <input id="sim-amount" className={cls('amount')} type="number" inputMode="decimal" step="0.01" value={values.amount} onChange={change('amount')} placeholder="e.g. 1500" />
          </FormField>
          <FormField label="Number of payments" htmlFor="sim-payments" error={errors.remainingPayments}>
            <input id="sim-payments" className={cls('remainingPayments')} type="number" step="1" min="1" value={values.remainingPayments} onChange={change('remainingPayments')} />
          </FormField>
          <FormField label="First payment date" htmlFor="sim-date" error={errors.dueDate}>
            <input id="sim-date" className={cls('dueDate')} type="date" value={values.dueDate} onChange={change('dueDate')} />
          </FormField>
          <div className="form-actions">
            {result && <button type="button" className="btn" onClick={handleReset}>Reset</button>}
            <button type="submit" className="btn btn-primary" disabled={running}>{running ? 'Simulating…' : 'Simulate'}</button>
          </div>
        </div>
      </form>

      {result && plan && <Results result={result} plan={plan} />}
    </div>
  );
}

function Results({ result, plan }) {
  const { baseline, simulated, impact, baselineWarning, simulatedWarning, reserveThreshold } = result;
  const reserve = formatPeso(reserveThreshold);
  const firstRisk = result.simulatedTimeline.find((p) => isBelowThreshold(p.balance, reserveThreshold));
  const startsAfterPeriod = plan.dueDate > result.horizonEnd;

  let verdict;
  if (startsAfterPeriod) {
    verdict = (
      <div className="banner banner-success">
        <span>
          <strong>No effect yet:</strong> the first payment falls after {formatDate(result.horizonEnd)}, outside your
          planning period.
        </span>
      </div>
    );
  } else if (simulatedWarning && baselineWarning) {
    verdict = (
      <div className="banner banner-warning" role="alert">
        <span>
          <strong>Not a good idea:</strong> you're already projected below your {reserve} reserve, and this plan lowers
          your lowest balance by {formatPeso(impact)} more.
        </span>
      </div>
    );
  } else if (simulatedWarning) {
    verdict = (
      <div className="banner banner-warning" role="alert">
        <span>
          <strong>Risky:</strong> this plan would push your balance below your {reserve} reserve on{' '}
          {formatDate(firstRisk.date)}. Lowest point: {formatPeso(simulated.amount)} on {formatDate(simulated.date)}.
        </span>
      </div>
    );
  } else {
    verdict = (
      <div className="banner banner-success">
        <span>
          <strong>Looks safe:</strong> with this plan your balance stays above your {reserve} reserve through{' '}
          {formatDate(result.horizonEnd)}. Lowest point: {formatPeso(simulated.amount)} on {formatDate(simulated.date)}.
        </span>
      </div>
    );
  }

  return (
    <div className="section">
      <p className="muted result-caption">
        Results for: {plan.remainingPayments} × {formatPeso(plan.amount)}, starting {formatDate(plan.dueDate)}
      </p>
      {verdict}

      <div className="summary-grid">
        <SummaryCard
          label="Lowest balance now"
          value={formatPeso(baseline.amount)}
          sub={formatDate(baseline.date)}
          tone={baselineWarning ? 'danger' : 'success'}
        />
        <SummaryCard
          label="Lowest balance with this plan"
          value={formatPeso(simulated.amount)}
          sub={formatDate(simulated.date)}
          tone={simulatedWarning ? 'danger' : 'success'}
        />
        <SummaryCard label="Drop in lowest balance" value={formatPeso(impact)} sub="Now minus with this plan" />
        <SummaryCard
          label="Total cost of plan"
          value={formatPeso(plan.amount * plan.remainingPayments)}
          sub={`${plan.remainingPayments} × ${formatPeso(plan.amount)}`}
        />
      </div>

      <section className="card section">
        <h2>Projected balance: now vs with this plan</h2>
        <BalanceChart
          timeline={result.baselineTimeline}
          compareTimeline={result.simulatedTimeline}
          threshold={reserveThreshold}
        />
      </section>
    </div>
  );
}
