
function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <div className="dialog-overlay">
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="dialog-icon">?</div>

        <h3 id="confirm-dialog-title">{title}</h3>

        <p id="confirm-dialog-message">{message}</p>

        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
