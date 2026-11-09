import { useMemo, useRef, useState } from 'react';
import {
  getAllowances, addAllowance, updateAllowance, deleteAllowance,
  getExpenses, addExpense, updateExpense, deleteExpense,
  newIdempotencyKey,
  todayString,
} from '../services/api';
import { formatPeso, formatDate } from '../services/format';
import { useRecords } from '../hooks/useRecords';
import Modal from '../components/Modal.jsx';
import RecordList from '../components/RecordList.jsx';
import AllowanceForm from '../components/AllowanceForm.jsx';
import ExpenseForm from '../components/ExpenseForm.jsx';
import { useToast } from '../hooks/useToast.js';

const FREQ = { once: 'One time', weekly: 'Weekly', monthly: 'Monthly' };

// Everything that differs between the two record types lives here
const TYPES = {
  allowance: { add: addAllowance, update: updateAllowance, remove: deleteAllowance, noun: 'allowance' },
  expense: { add: addExpense, update: updateExpense, remove: deleteExpense, noun: 'expense' },
};

export default function Allowance() {
  const toast = useToast();
  const allowances = useRecords(getAllowances);
  const expenses = useRecords(getExpenses);
  const lists = { allowance: allowances, expense: expenses };

  const [modal, setModal] = useState(null); // { type, record } or null
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const submitKey = useRef(null); // one key per "Add" form, reused if the same form is saved again
  const today = todayString();

  const sortedAllowances = useMemo(
    () => [...allowances.items].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)),
    [allowances.items]
  );
  const sortedExpenses = useMemo(
    () => [...expenses.items].sort((a, b) => b.date.localeCompare(a.date)),
    [expenses.items]
  );

  const open = (type, record = null) => {
    if (!record) submitKey.current = newIdempotencyKey();
    setFormError('');
    setModal({ type, record });
  };
  const close = () => setModal(null);

  async function handleSave(values) {
    const { type, record } = modal;
    setSaving(true);
    setFormError('');
    try {
      if (record) await TYPES[type].update(record.id, values);
      else await TYPES[type].add(values, { idempotencyKey: submitKey.current });
      setModal(null);
      await lists[type].reload({ silent: true });
      const noun = TYPES[type].noun;
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} ${record ? 'updated' : 'added'}.`);
    } catch (err) {
      const message = err.message || 'Could not save. Please try again.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type, record, name) {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await TYPES[type].remove(record.id);
      await lists[type].reload({ silent: true });
      toast.success(`Deleted "${name}".`);
    } catch (err) {
      toast.error(err.message || 'Could not delete. Please try again.');
    }
  }

  function renderSection({ type, title, addLabel, list, sorted, emptyTitle, emptyText, listProps }) {
    return (
      <section className="section">
        <div className="page-header">
          <h2>{title}</h2>
          <button className="btn btn-primary" onClick={() => open(type)}>{addLabel}</button>
        </div>
        {list.error && (
          <div className="banner banner-error" role="alert">
            <span>{list.error}</span>
            <button className="btn btn-sm" onClick={() => list.reload()}>Retry</button>
          </div>
        )}
        {list.loading ? (
          <p className="muted">Loading…</p>
        ) : sorted.length === 0 && !list.error ? (
          <div className="card empty"><h3>{emptyTitle}</h3><p>{emptyText}</p></div>
        ) : (
          <RecordList items={sorted} onEdit={(r) => open(type, r)} {...listProps} />
        )}
      </section>
    );
  }

  const modalTitle = modal ? `${modal.record ? 'Edit' : 'Add'} ${TYPES[modal.type].noun}` : '';
  const formProps = modal && {
    initial: modal.record,
    defaultDate: today,
    onSubmit: handleSave,
    onCancel: close,
    saving,
    serverError: formError,
  };

  return (
    <div>
      <div className="page-header"><h1>Allowance &amp; Expenses</h1></div>

      {renderSection({
        type: 'allowance',
        title: 'Allowance (money coming in)',
        addLabel: '+ Add allowance',
        list: allowances,
        sorted: sortedAllowances,
        emptyTitle: 'No allowance yet',
        emptyText: 'Add your allowance so the projection knows when money comes in.',
        listProps: {
          tone: 'in',
          getTitle: (a) => a.label,
          getMeta: (a) => `${FREQ[a.frequency] ?? a.frequency} · ${a.frequency === 'once' ? 'on' : 'starting'} ${formatDate(a.expectedDate)}`,
          getAmount: (a) => `+${formatPeso(a.amount)}`,
          onDelete: (a) => handleDelete('allowance', a, a.label),
        },
      })}

      {renderSection({
        type: 'expense',
        title: 'Expenses (money going out)',
        addLabel: '+ Add expense',
        list: expenses,
        sorted: sortedExpenses,
        emptyTitle: 'No expenses yet',
        emptyText: 'Add your regular spending so the projection stays realistic.',
        listProps: {
          tone: 'out',
          getTitle: (e) => e.category,
          getMeta: (e) => `${formatDate(e.date)} · ${e.essential ? 'Essential' : 'Not essential'}`,
          getAmount: (e) => `−${formatPeso(e.amount)}`,
          onDelete: (e) => handleDelete('expense', e, e.category),
        },
      })}

      {modal && (
        <Modal title={modalTitle} onClose={close}>
          {modal.type === 'allowance' ? <AllowanceForm {...formProps} /> : <ExpenseForm {...formProps} />}
        </Modal>
      )}
    </div>
  );
}
