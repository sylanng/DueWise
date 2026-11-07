import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../services/api';
import { validateSettings, normalizeSettings } from '../services/validation';
import FormField from '../components/FormField.jsx';
import { useToast } from '../hooks/useToast.js';

// Phase 1: balance settings only. Phase 2 adds Google connection status,
// Phase 4 adds notification toggles.
export default function Settings() {
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (!cancelled) {
          setValues({
            openingBalance: s.openingBalance,
            reserveThreshold: s.reserveThreshold,
            planningHorizonDays: s.planningHorizonDays,
          });
        }
      })
      .catch((err) => !cancelled && setLoadError(err.message || 'Could not load settings.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const check = validateSettings(values);
    setErrors(check.errors);
    if (!check.isValid) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await updateSettings(normalizeSettings(values));
      toast.success('Settings saved.');
    } catch (err) {
      const message = err.message || 'Could not save settings.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const cls = (field) => 'input' + (errors[field] ? ' invalid' : '');

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      {loadError && <div className="banner banner-error" role="alert">{loadError}</div>}
      {!values && !loadError && <p className="muted">Loading settings…</p>}

      {values && (
        <form className="card settings-card" onSubmit={handleSubmit} noValidate>
          <h2>Balance settings</h2>
          {saveError && <div className="banner banner-error" role="alert">{saveError}</div>}

          <FormField label="Opening balance (₱)" htmlFor="openingBalance" error={errors.openingBalance}>
            <input id="openingBalance" className={cls('openingBalance')} type="number" step="0.01" value={values.openingBalance} onChange={change('openingBalance')} />
            <span className="hint muted">Money you have before any of your recorded allowances and expenses are counted.</span>
          </FormField>

          <FormField label="Reserve threshold (₱)" htmlFor="reserveThreshold" error={errors.reserveThreshold}>
            <input id="reserveThreshold" className={cls('reserveThreshold')} type="number" step="0.01" value={values.reserveThreshold} onChange={change('reserveThreshold')} />
            <span className="hint muted">You get a warning when your projected balance drops below this amount.</span>
          </FormField>

          <FormField label="Planning horizon (days)" htmlFor="planningHorizonDays" error={errors.planningHorizonDays}>
            <input id="planningHorizonDays" className={cls('planningHorizonDays')} type="number" step="1" value={values.planningHorizonDays} onChange={change('planningHorizonDays')} />
            <span className="hint muted">How far ahead the dashboard and simulator look (7 to 180 days).</span>
          </FormField>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
