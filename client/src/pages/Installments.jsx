import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getInstallments,
  addInstallment,
  updateInstallment,
  deleteInstallment,
  todayString,
} from '../services/api';
import { filterInstallments, getDisplayStatus } from '../services/installmentView';
import { formatPeso, formatDate } from '../services/format';
import Modal from '../components/Modal.jsx';
import InstallmentForm from '../components/InstallmentForm.jsx';
import { useToast } from '../hooks/useToast.js';

const NO_FILTERS = { search: '', status: 'all', due: 'all' };

export default function Installments() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = adding
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const today = todayString();

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      setItems(await getInstallments());
    } catch (err) {
      setLoadError(err.message || 'Could not load installments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => filterInstallments(items, filters, today), [items, filters, today]);
  const filtersActive = filters.search !== '' || filters.status !== 'all' || filters.due !== 'all';

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  function openAdd() {
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  }
  function openEdit(inst) {
    setEditing(inst);
    setFormError('');
    setFormOpen(true);
  }
  const closeForm = useCallback(() => setFormOpen(false), []);

  async function handleSave(values) {
    setSaving(true);
    setFormError('');
    const wasEditing = Boolean(editing);
    try {
      if (wasEditing) await updateInstallment(editing.id, values);
      else await addInstallment(values);
      setFormOpen(false);
      await load({ silent: true });
      toast.success(wasEditing ? 'Installment updated.' : 'Installment added.');
    } catch (err) {
      const message = err.message || 'Could not save. Please try again.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, successMessage) {
    try {
      await action();
      await load({ silent: true });
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    }
  }

  const handleDelete = (inst) => {
    if (window.confirm(`Delete the ${inst.provider} installment?`)) {
      runAction(() => deleteInstallment(inst.id), 'Installment deleted.');
    }
  };
  const handleTogglePaid = (inst) =>
    runAction(
      () => updateInstallment(inst.id, { status: inst.status === 'paid' ? 'pending' : 'paid' }),
      inst.status === 'paid' ? 'Marked as pending.' : 'Marked as paid.'
    );

  return (
    <div>
      <div className="page-header">
        <h1>Installments</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add installment</button>
      </div>

      {loadError && (
        <div className="banner banner-error" role="alert">
          <span>{loadError}</span>
          <button className="btn btn-sm" onClick={() => load()}>Retry</button>
        </div>
      )}

      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search by provider…"
          aria-label="Search by provider"
          value={filters.search}
          onChange={setFilter('search')}
        />
        <select className="input" aria-label="Filter by status" value={filters.status} onChange={setFilter('status')}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        <select className="input" aria-label="Filter by due date" value={filters.due} onChange={setFilter('due')}>
          <option value="all">Any due date</option>
          <option value="next7">Due in 7 days</option>
          <option value="next30">Due in 30 days</option>
        </select>
        {filtersActive && (
          <button className="btn" onClick={() => setFilters(NO_FILTERS)}>Clear</button>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading installments…</p>
      ) : items.length === 0 && !loadError ? (
        <div className="card empty">
          <h3>No installments yet</h3>
          <p>Add your first BNPL installment to start projecting your allowance.</p>
        </div>
      ) : visible.length === 0 && !loadError ? (
        <div className="card empty">
          <h3>No results</h3>
          <p>No installments match your search or filters.</p>
        </div>
      ) : (
        <div className="inst-list">
          <div className="inst-row inst-head" aria-hidden="true">
            <div>Provider</div><div>Amount</div><div>Next due</div><div>Left</div><div>Status</div><div />
          </div>
          {visible.map((inst) => {
            const status = getDisplayStatus(inst, today);
            return (
              <div className="inst-row" key={inst.id}>
                <div className="cell cell-provider" data-label="Provider">{inst.provider}</div>
                <div className="cell" data-label="Amount">{formatPeso(inst.amount)}</div>
                <div className="cell" data-label="Next due">{formatDate(inst.dueDate)}</div>
                <div className="cell" data-label="Payments left">{inst.remainingPayments}</div>
                <div className="cell" data-label="Status">
                  <span className={`badge badge-${status.key}`}>{status.label}</span>
                </div>
                <div className="cell-actions">
                  <button className="btn btn-sm" onClick={() => handleTogglePaid(inst)}>
                    {inst.status === 'paid' ? 'Mark pending' : 'Mark paid'}
                  </button>
                  <button className="btn btn-sm" onClick={() => openEdit(inst)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(inst)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <Modal title={editing ? 'Edit installment' : 'Add installment'} onClose={closeForm}>
          <InstallmentForm
            initial={editing}
            defaultDate={today}
            onSubmit={handleSave}
            onCancel={closeForm}
            saving={saving}
            serverError={formError}
          />
        </Modal>
      )}
    </div>
  );
}
