import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { describeAuthError } from '../services/authErrors.js';
import { MOCK_MODE } from '../services/api.js';

export default function Login() {
  const { user, loading, signIn, notice, clearNotice } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (MOCK_MODE) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h1>DueWise</h1>
          <p className="muted">Demo mode is on, so no sign-in is needed.</p>
          <p style={{ marginTop: 'var(--space-4)' }}><Link to="/">Go to the dashboard</Link></p>
        </div>
      </div>
    );
  }

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSignIn() {
    setBusy(true);
    setError('');
    clearNotice();
    try {
      await signIn();
    } catch (err) {
      const message = describeAuthError(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>DueWise</h1>
        <p className="muted">Track your Buy Now, Pay Later installments and see problems before they happen.</p>

        {notice && <div className="banner banner-warning" role="alert" style={{ marginTop: 'var(--space-4)' }}>{notice}</div>}
        {error && <div className="banner banner-error" role="alert" style={{ marginTop: 'var(--space-4)' }}>{error}</div>}

        <p style={{ marginTop: 'var(--space-4)' }}>Signing in with Google lets DueWise:</p>
        <ul className="login-perms">
          <li>Send reminder emails to your own Gmail (send only, it cannot read your inbox)</li>
          <li>Add installment due dates to your Google Calendar</li>
        </ul>

        <button className="btn btn-primary btn-block" onClick={handleSignIn} disabled={busy || loading}>
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
        <p className="muted login-note">Prototype for CIT 210. Only approved test accounts can sign in.</p>
      </div>
    </div>
  );
}
