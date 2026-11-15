
import { useEffect, useState } from 'react';
import apiRequest from '../services/api';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

import { auth } from "../services/firebase";

import {
  getPasswordRequirements,
  getPasswordStrength,
} from "../utils/passwordUtils";

const getLocalDateString = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

function Settings() {
  const { user, updateUserProfile, refreshUser } = useAuth();

  const [settings, setSettings] = useState({
  fullName: user?.displayName || 'User',
  email: user?.email || '',
  openingBalance: '0',
  reserveLimit: '2000',
  trackingStartDate: getLocalDateString(),
  currency: 'PHP',
  emailNotifications: true,
  dueDateReminders: true,
  lowBalanceAlerts: true,
});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNameConfirmation, setShowNameConfirmation] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState('');
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [pictureSuccess, setPictureSuccess] = useState('');
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [showPictureConfirmation, setShowPictureConfirmation] = useState(false);

  // Account Security states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Load saved settings from the backend.
 const loadSettings = async () => {
  try {
    setLoading(true);
    setError('');
    setLoadError('');

    const response = await apiRequest('/api/settings');

    if (response.data) {
      setSettings((previous) => ({
        ...previous,
        ...response.data,
        fullName: response.data.fullName || user?.displayName || 'User',
        email: response.data.email || user?.email || '',
        openingBalance: String(response.data.openingBalance ?? 0),
        reserveLimit: String(response.data.reserveLimit ?? 2000),
        trackingStartDate:
          response.data.trackingStartDate || getLocalDateString(),
      }));
    } else {
      setSettings((previous) => ({
        ...previous,
        fullName: user?.displayName || 'User',
        email: user?.email || '',
      }));
    }
  } catch (err) {
    const message = err.message || 'Unable to load settings.';

    setError(message);
    setLoadError(message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setSettings((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));

    setSaved(false);
    setError('');
  };

  const handleTrackingDateChange = (date) => {
    if (!date) return;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    setSettings((previous) => ({
      ...previous,
      trackingStartDate: `${year}-${month}-${day}`,
    }));

    setSaved(false);
    setError('');
  };

  // Save settings permanently through the backend.
  const handleSubmit = async (event, confirmedNameChange = false) => {
    event?.preventDefault();

    const nameChanged =
      settings.fullName.trim() !== (user?.displayName || '').trim();

      console.log('Entered name:', settings.fullName);
      console.log('Current Firebase name:', user?.displayName);
      console.log('Name changed:', nameChanged);

    if (nameChanged && !confirmedNameChange) {
      setShowNameConfirmation(true);
      return;
    }

    const openingBalance = Number(settings.openingBalance);
    const reserveLimit = Number(settings.reserveLimit);

    if (
      !Number.isFinite(openingBalance) ||
      !Number.isFinite(reserveLimit) ||
      openingBalance < 0 ||
      reserveLimit < 0
    ) {
      setError('Financial amounts must be valid non-negative numbers.');
      return;
    }

    try {
      setSaving(true);
      setSaved(false);
      setError('');

      const payload = {
        fullName: settings.fullName,
        email: settings.email,
        openingBalance,
        reserveLimit,
        currency: settings.currency,
        emailNotifications: settings.emailNotifications,
        dueDateReminders: settings.dueDateReminders,
        lowBalanceAlerts: settings.lowBalanceAlerts,
        trackingStartDate: settings.trackingStartDate,
      };

      const response = await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      // Refresh Firebase user information after saving the full name.
      try {
        await refreshUser();
      } catch (refreshError) {
        console.error('Unable to refresh user profile:', refreshError);
      }

      if (response.data) {
        setSettings((previous) => ({
          ...previous,
          ...response.data,
          openingBalance: String(response.data.openingBalance ?? openingBalance),
          reserveLimit: String(response.data.reserveLimit ?? reserveLimit),
          trackingStartDate:
            response.data.trackingStartDate || settings.trackingStartDate,
        }));
      }

      setSaved(true);
      setShowNameConfirmation(false);
    } catch (err) {
      setError(err.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setPasswordError("");
    setPasswordSuccess("");

    const requirements = getPasswordRequirements(newPassword);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (requirements.some((requirement) => !requirement.met)) {
      setPasswordError("Please meet all password requirements.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("Your new password must be different.");
      return;
    }

    try {
      setChangingPassword(true);

      const currentUser = auth.currentUser;

      if (!currentUser || !currentUser.email) {
        throw new Error("No authenticated user found.");
      }

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setPasswordSuccess("Your password has been updated successfully.");
    } catch (err) {
      const messages = {
        "auth/wrong-password": "Your current password is incorrect.",
        "auth/invalid-credential": "Your current password is incorrect.",
        "auth/weak-password": "Please choose a stronger password.",
        "auth/requires-recent-login": "Please sign in again before changing your password.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
      };

      setPasswordError(
        messages[err.code] || err.message || "Unable to update your password."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePictureChange = (event) => {
  const file = event.target.files[0];

  setPictureError('');
  setPictureSuccess('');

  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    setPictureError('Please select a JPG, PNG, or WebP image.');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setPictureError('Image size must not exceed 5 MB.');
    return;
  }

  setSelectedPicture(file);
  setPicturePreview(URL.createObjectURL(file));
};

  const handlePictureUpload = async () => {
    if (!selectedPicture) {
      setPictureError('Please select a picture first.');
      return;
    }

    try {
      setUploadingPicture(true);
      setPictureError('');
      setPictureSuccess('');

      const formData = new FormData();
      formData.append('profilePicture', selectedPicture);

      const response = await apiRequest('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      await updateUserProfile({
        photoURL: response.data.photoURL,
      });

      setSelectedPicture(null);
      setPicturePreview('');
      setPictureSuccess('Profile picture updated successfully.');
    } catch (err) {
      setPictureError(err.message || 'Unable to upload profile picture.');
    } finally {
      setUploadingPicture(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <h2>Settings</h2>
        <p>Loading your settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="module-heading">
        <div>
          <h2>Settings</h2>
          <p>Manage your profile and financial preferences.</p>
        </div>
      </div>

      {loadError && (
  <div className="error-message" role="alert">
    <p>{loadError}</p>

    <button
      type="button"
      className="text-button"
      onClick={loadSettings}
      disabled={loading}
    >
      {loading ? 'Retrying...' : 'Retry'}
    </button>
  </div>
)}
    
      {!loadError && (
      <form onSubmit={handleSubmit}>
        <div className="form-card settings-card">
          <h3>Profile Information</h3>
          <p className="settings-description">
            Manage your personal account information.
          </p>

          <div className="profile-picture-section">
            <div className="profile-picture-preview">
              <img
                src={
                  picturePreview ||
                  user?.photoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    settings.fullName || 'User'
                  )}&background=EEF2FF&color=4338CA`
                }
                alt="Profile"
              />
            </div>

            <div className="profile-picture-controls">
              <strong>Profile Picture</strong>

              <p>
                Personalize your DueWise account with your favorite photo.
              </p>

              <button
                type="button"
                className="change-picture-button"
                onClick={() => {
                  setPictureError('');
                  setPictureSuccess('');
                  setShowPictureModal(true);
                }}
              >
                Change Profile Picture
              </button>

              {pictureError && (
                <p className="settings-error">{pictureError}</p>
              )}

              {pictureSuccess && (
                <p className="settings-saved">{pictureSuccess}</p>
              )}
            </div>
          </div>


          <div className="form-grid">
            <label>
              Full Name
              <input
                type="text"
                name="fullName"
                value={settings.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                placeholder="Enter your email address"
              />
            </label>
          </div>
        </div>

        {/* Account Security */}
        <div className="form-card settings-card">
          <div className="settings-card-header">
            <div>
              <h2>Account Security</h2>
              <p className="settings-description">
                Manage your sign-in method and protect your account.
              </p>
            </div>
          </div>

          {auth.currentUser?.providerData?.some(
            (provider) => provider.providerId === "password"
          ) ? (
            <div className="settings-security-content">
              {/* Keep the existing password change fields here */}
              <div className="settings-field">
                <label>Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="settings-field">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div className="password-requirements">
                  <strong>Password requirements</strong>
                  {getPasswordRequirements(newPassword).map((requirement) => (
                    <div key={requirement.label}>
                      <span>{requirement.met ? "✓" : "○"}</span>
                      {requirement.label}
                    </div>
                  ))}
                  <p>
                    Password strength:{" "}
                    <strong>{getPasswordStrength(newPassword).label}</strong>
                  </p>
                </div>
              )}

              <div className="settings-field">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmNewPassword(!showConfirmNewPassword)
                    }
                  >
                    {showConfirmNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {passwordError && (
                <p className="settings-error">{passwordError}</p>
              )}

              {passwordSuccess && (
                <p className="settings-saved">{passwordSuccess}</p>
              )}

              <button
                type="button"
                className="settings-security-button"
                onClick={handlePasswordChange}
                disabled={changingPassword}
              >
                {changingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          ) : (
            <div className="google-security-content">
              <div className="google-security-account">
                <div className="google-security-icon">
                  <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6c4.51-4.18 7.06-10.33 7.06-17.65z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-3-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  </svg>
                </div>

                <div className="google-security-details">
                  <strong>Google Account</strong>
                  <span>{user?.email || auth.currentUser?.email}</span>
                  <small>Connected sign-in method</small>
                </div>

                <span className="google-security-status">
                  Connected
                </span>
              </div>

              <div className="google-security-notice">
                <strong>Protect your account</strong>
                <p>
                  Your DueWise account uses Google Sign-In. Your password
                  and sign-in security are managed directly through Google.
                  Enable two-step verification for additional protection.
                </p>
              </div>

              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="settings-security-button google-security-link"
              >
                Manage Google Security
                <span>↗</span>
              </a>
            </div>
          )}
        </div>

        <div className="form-card settings-card">
          <h3>Financial Preferences</h3>
          <p className="settings-description">
            Set your starting balance and minimum reserve amount.
          </p>

          <div className="form-grid">
            <label>
              Starting Balance (₱)
              <input
                type="number"
                name="openingBalance"
                value={settings.openingBalance}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </label>

            <label>
              Tracking Start Date
              <DatePicker
                selected={
                  settings.trackingStartDate
                    ? new Date(`${settings.trackingStartDate}T00:00:00`)
                    : null
                }
                onChange={handleTrackingDateChange}
                dateFormat="MM/dd/yyyy"
                placeholderText="Select tracking start date"
                className="duewise-datepicker"
                calendarClassName="duewise-calendar"
                showPopperArrow={false}
                required
              />
              <small>
                The date you started tracking your finances in DueWise.
              </small>
            </label>

            <label>
              Minimum Reserve Limit (₱)
              <input
                type="number"
                name="reserveLimit"
                value={settings.reserveLimit}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </label>

            <label>
              Currency
              <select
                name="currency"
                value={settings.currency}
                disabled
              >
                <option value="PHP">PHP - Philippine Peso (₱)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="form-card settings-card">
          <h3>Notification Preferences</h3>
          <p className="settings-description">
            Choose which financial reminders you want to receive.
          </p>

          <div className="settings-toggle">
            <div>
              <strong>Email Notifications</strong>
              <span>Receive account notifications through email.</span>
            </div>

            <input
              type="checkbox"
              name="emailNotifications"
              checked={settings.emailNotifications}
              onChange={handleChange}
            />
          </div>

          <div className="settings-toggle">
            <div>
              <strong>Due Date Reminders</strong>
              <span>Receive reminders about upcoming installments.</span>
            </div>

            <input
              type="checkbox"
              name="dueDateReminders"
              checked={settings.dueDateReminders}
              onChange={handleChange}
            />
          </div>

          <div className="settings-toggle">
            <div>
              <strong>Low Balance Alerts</strong>
              <span>Receive alerts when your projected balance is low.</span>
            </div>

            <input
              type="checkbox"
              name="lowBalanceAlerts"
              checked={settings.lowBalanceAlerts}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="settings-actions">
          {error && (
            <span className="settings-error">{error}</span>
          )}

          {saved && (
            <span className="settings-saved">
              Settings saved successfully!
            </span>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
      )}

      {showNameConfirmation && (
        <div className="picture-modal-overlay">
          <div className="picture-modal confirmation-modal">
            <div className="picture-modal-icon">✦</div>

            <h3>Update Your Profile Name?</h3>

            <p className="picture-modal-description">
              Are you sure you want to change your DueWise profile name to:
            </p>

            <strong className="name-confirmation-value">
              {settings.fullName.trim()}
            </strong>

            <div className="picture-modal-actions">
              <button
                type="button"
                className="picture-cancel-button"
                onClick={() => {
                  setSettings((previous) => ({
                    ...previous,
                    fullName: user?.displayName || 'User',
                  }));

                  setShowNameConfirmation(false);
                  setError('');
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="change-picture-button"
                disabled={saving}
                onClick={() => handleSubmit(null, true)}
              >
                {saving ? 'Updating...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPictureModal && (
        <div
          className="picture-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowPictureModal(false);
              setSelectedPicture(null);
              setPicturePreview('');
              setPictureError('');
            }
          }}
        >
          <div className="picture-modal">
            <button
              type="button"
              className="picture-modal-close"
              onClick={() => setShowPictureModal(false)}
            >
              ×
            </button>

            <div className="picture-modal-icon">✦</div>

            <h3>Change Profile Picture</h3>
            <p className="picture-modal-description">
              Choose a new photo for your DueWise account.
            </p>

            <div className="picture-modal-preview">
              <img
                src={
                  picturePreview ||
                  user?.photoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    settings.fullName || 'User'
                  )}`
                }
                alt="Profile preview"
              />
            </div>

            <label className="picture-modal-select">
              Choose Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePictureChange}
              />
            </label>

            {selectedPicture && (
              <span className="selected-picture-name">
                {selectedPicture.name}
              </span>
            )}

            {pictureError && (
              <p className="settings-error">{pictureError}</p>
            )}

            <div className="picture-modal-actions">
              <button
                type="button"
                className="picture-cancel-button"
                onClick={() => {
                  setShowPictureModal(false);
                  setSelectedPicture(null);
                  setPicturePreview('');
                  setPictureError('');
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="change-picture-button"
                disabled={!selectedPicture}
                onClick={() => {
                  setShowPictureModal(false);
                  setShowPictureConfirmation(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showPictureConfirmation && (
        <div className="picture-modal-overlay">
          <div className="picture-modal confirmation-modal">
            <div className="picture-modal-icon">?</div>

            <h3>Update Profile Picture?</h3>
            <p className="picture-modal-description">
              Are you sure you want to use this photo as your new
              DueWise profile picture?
            </p>

            {picturePreview && (
              <div className="picture-modal-preview confirmation-preview">
                <img src={picturePreview} alt="Selected profile" />
              </div>
            )}

            {pictureError && (
              <p className="settings-error">{pictureError}</p>
            )}

            <div className="picture-modal-actions">
              <button
                type="button"
                className="picture-cancel-button"
                disabled={uploadingPicture}
                onClick={() => {
                  setShowPictureConfirmation(false);
                  setShowPictureModal(true);
                }}
              >
                Go Back
              </button>

              <button
                type="button"
                className="change-picture-button"
                disabled={uploadingPicture}
                onClick={async () => {
                  await handlePictureUpload();

                  if (!pictureError) {
                    setShowPictureConfirmation(false);
                  }
                }}
              >
                {uploadingPicture ? 'Updating...' : 'Yes, Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
