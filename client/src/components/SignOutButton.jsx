import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import Modal from './Modal.jsx';

// "Sign out" button that asks first. Used in the sidebar and in Settings.
export default function SignOutButton({ className = 'btn' }) {
  const { signOutUser } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  async function confirm() {
    setBusy(true);
    try {
      await signOutUser();
      toast.success('You have signed out.');
    } catch {
      toast.error('Could not sign out. Please try again.');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>Sign out</button>
      {open &&
        createPortal(
          <Modal title="Sign out?" onClose={close}>
            <p className="muted">
              You will need to sign in with Google again to use DueWise. Your data is saved and will be here when you
              come back.
            </p>
            <div className="form-actions">
              <button className="btn" onClick={close} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>
                {busy ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </Modal>,
          document.body
        )}
    </>
  );
}
