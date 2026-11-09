import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { describeAuthError } from '../services/authErrors.js';
import { MOCK_MODE } from '../services/api.js';
import SignOutButton from './SignOutButton.jsx';

const STATUS = {
  connected: {
    badge: 'badge-paid',
    label: 'Connected',
    text: 'DueWise can send reminder emails and add events to your Google Calendar. Google access lasts about an hour.',
  },
  expired: {
    badge: 'badge-overdue',
    label: 'Expired',
    text: 'Google access lasts about an hour and has run out. Reconnect to keep emails and Calendar working.',
  },
  disconnected: {
    badge: 'badge-muted',
    label: 'Not connected',
    text: 'Reconnect to allow reminder emails and Calendar events. You stay signed in to DueWise either way.',
  },
};

export default function GoogleConnectionCard() {
  const { user, googleStatus, reconnectGoogle } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (MOCK_MODE) {
    return (
      <div className="card settings-card">
        <h2>Google connection</h2>
        <p className="muted">
          Demo mode is on (sample data), so Google is not connected. Set VITE_MOCK_MODE=false in client/.env to use your
          real account.
        </p>
      </div>
    );
  }

  const status = STATUS[googleStatus] ?? STATUS.disconnected;

  async function handleReconnect() {
    setBusy(true);
    try {
      await reconnectGoogle();
      toast.success('Google connected.');
    } catch (err) {
      toast.error(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card settings-card">
      <h2>Google connection</h2>
      <p className="muted">Signed in as {user?.email ?? 'unknown'}</p>
      <p className="google-status">
        <span className={`badge ${status.badge}`}>{status.label}</span>
      </p>
      <p className="muted">{status.text}</p>
      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button className={googleStatus === 'connected' ? 'btn' : 'btn btn-primary'} onClick={handleReconnect} disabled={busy}>
          {busy ? 'Opening Google…' : 'Reconnect Google'}
        </button>
        <SignOutButton />
      </div>
    </div>
  );
}
