import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [notificationSaving, setNotificationSaving] = useState(false);
const [notificationSaveSuccess, setNotificationSaveSuccess] = useState('');
const [notificationSaveError, setNotificationSaveError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [openingBalanceError, setOpeningBalanceError] = useState('');
  const [trackingDateError, setTrackingDateError] = useState('');
  const [reserveLimitError, setReserveLimitError] = useState('');
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

  if (name === 'email') {
    setEmailError('');
  }

  if (name === 'openingBalance') {
  setOpeningBalanceError('');
}

if (name === 'reserveLimit') {
  setReserveLimitError('');
}

  if (name === 'fullName') {
    setError('');
  }

  setSaved(false);
};

const handleNotificationToggle = async (event) => {
  const { name, checked } = event.target;

  const allowedFields = [
    'emailNotifications',
    'dueDateReminders',
    'lowBalanceAlerts',
  ];

  if (!allowedFields.includes(name) || notificationSaving || saving) {
    return;
  }

  const previousValue = settings[name];

  // Update the toggle immediately.
  setSettings((previous) => ({
    ...previous,
    [name]: checked,
  }));

  setNotificationSaveSuccess('');
  setNotificationSaveError('');
  setNotificationSaving(true);

  try {
    await apiRequest('/api/settings/notifications', {
      method: 'PATCH',
      body: JSON.stringify({
        [name]: checked,
      }),
    });

    setNotificationSaveSuccess(
      'Notification preferences saved successfully.'
    );
  } catch (err) {
    // Restore the previous toggle value if saving fails.
    setSettings((previous) => ({
      ...previous,
      [name]: previousValue,
    }));

    setNotificationSaveError(
      err.message || 'Unable to save notification preferences.'
    );
  } finally {
    setNotificationSaving(false);
  }
};

  const handleTrackingDateChange = (date) => {
  if (!date) {
    setSettings((previous) => ({
      ...previous,
      trackingStartDate: '',
    }));

    setTrackingDateError('');
    setSaved(false);
    return;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  setSettings((previous) => ({
    ...previous,
    trackingStartDate: `${year}-${month}-${day}`,
  }));

  setTrackingDateError('');
  setSaved(false);
};

  // Save settings permanently through the backend.
  
const handleSubmit = async (event, confirmedNameChange = false) => {
  event?.preventDefault();

  // Clear previous validation errors
  setError('');
  setEmailError('');
  setOpeningBalanceError('');
  setTrackingDateError('');
  setReserveLimitError('');

  // Get and normalize form values
  const fullName = settings.fullName.trim();
  const email = settings.email.trim();

  const openingBalanceInput = settings.openingBalance.trim();
  const reserveLimitInput = settings.reserveLimit.trim();

  const openingBalance = Number(openingBalanceInput);
  const reserveLimit = Number(reserveLimitInput);

  // Validate Full Name and Email together
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const nameIsInvalid = !fullName;
  const emailIsInvalid = !email || !emailPattern.test(email);

  if (nameIsInvalid) {
    setError('Please enter your full name.');
  }

  if (emailIsInvalid) {
    setEmailError(
      !email
        ? 'Please enter your email address.'
        : 'Please enter a valid email address.'
    );
  }

  
  // Financial Preferences validation

  const openingBalanceIsInvalid =
    !openingBalanceInput ||
    !Number.isFinite(openingBalance) ||
    openingBalance < 0;

  const reserveLimitIsInvalid =
    !reserveLimitInput ||
    !Number.isFinite(reserveLimit) ||
    reserveLimit < 0;

  const trackingDateIsInvalid = !settings.trackingStartDate;

  if (openingBalanceIsInvalid) {
    setOpeningBalanceError(
      'Please enter a valid non-negative starting balance.'
    );
  }

  if (reserveLimitIsInvalid) {
    setReserveLimitError(
      'Please enter a valid non-negative reserve limit.'
    );
  }

  if (trackingDateIsInvalid) {
    setTrackingDateError(
      'Please select your tracking start date.'
    );
  }

  // Stop saving only after checking ALL form fields
if (
  nameIsInvalid ||
  emailIsInvalid ||
  openingBalanceIsInvalid ||
  reserveLimitIsInvalid ||
  trackingDateIsInvalid
) {
  return;
}

  // Confirm all settings changes before saving
if (!confirmedNameChange) {
  setShowNameConfirmation(true);
  return;
}

  try {
    setSaving(true);
    setSaved(false);
    setError('');
    setEmailError('');

    const payload = {
      fullName,
      email,
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

    // Refresh Firebase user information
    try {
      await refreshUser();
    } catch (refreshError) {
      console.error(
        'Unable to refresh user profile:',
        refreshError
      );
    }

    if (response.data) {
      setSettings((previous) => ({
        ...previous,
        ...response.data,
        openingBalance: String(
          response.data.openingBalance ?? openingBalance
        ),
        reserveLimit: String(
          response.data.reserveLimit ?? reserveLimit
        ),
        trackingStartDate:
          response.data.trackingStartDate ||
          settings.trackingStartDate,
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
    return false;
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

    return true;
  } catch (err) {
    setPictureError(
      err.message || 'Unable to upload profile picture.'
    );

    return false;
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
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-card settings-card profile-information-card">
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
  <label className="profile-form-field">
    Full Name

    <input
      type="text"
      name="fullName"
      value={settings.fullName}
      onChange={handleChange}
      placeholder="Enter your full name"
      required
      aria-invalid={!!error}
    />

    {error && (
      <span className="profile-field-error" role="alert">
        {error}
      </span>
    )}
  </label>

  <label>
  Email Address
  <input
    type="email"
    name="email"
    value={settings.email}
    onChange={handleChange}
    placeholder="Enter your email address"
    readOnly={auth.currentUser?.providerData?.some(
      (provider) => provider.providerId === "google.com"
    )}
    className={
      auth.currentUser?.providerData?.some(
        (provider) => provider.providerId === "google.com"
      )
        ? "google-email-readonly"
        : ""
    }
  />
  {auth.currentUser?.providerData?.some(
    (provider) => provider.providerId === "google.com"
  ) && (
    <small className="field-hint">
      Your email is managed by your connected Google account.
    </small>
  )}
</label>
</div>

          <div className="settings-actions profile-save-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
          
        {saved && (
          <div className="profile-save-success" role="status">
            <span className="profile-success-icon">✓</span>
            Settings saved successfully!
          </div>
        )}
        </div>

        {/* Account Security */}
        <div className="form-card settings-card account-security-card">
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
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? (
                      <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
                        stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 9 5 9 7s-4 7-9 7a10 10 0 0 1-5.2-1.5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
                        stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
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
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? (
                      <svg viewBox="0 0 24 24" width="21" height="21"
                        fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 9 5 9 7s-4 7-9 7a10 10 0 0 1-5.2-1.5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="21" height="21"
                        fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
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
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmNewPassword ? (
                      <svg viewBox="0 0 24 24" width="21" height="21"
                        fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 9 5 9 7s-4 7-9 7a10 10 0 0 1-5.2-1.5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="21" height="21"
                        fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
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
            
<label className="profile-form-field">
  Starting Balance (₱)

  <input
    type="number"
    name="openingBalance"
    value={settings.openingBalance}
    onChange={handleChange}
    min="0"
    step="0.01"
    required
    aria-invalid={!!openingBalanceError}
  />

  {openingBalanceError && (
    <span className="profile-field-error" role="alert">
      {openingBalanceError}
    </span>
  )}
</label>

            
<label className="profile-form-field">
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
  className={`duewise-datepicker ${
    trackingDateError ? 'financial-input-error' : ''
  }`}
  calendarClassName="duewise-calendar"
  showPopperArrow={false}
  isClearable
  clearButtonTitle="Clear tracking start date"
  required
  ariaInvalid={!!trackingDateError}
/>

  <small>
    The date you started tracking your finances in DueWise.
  </small>

  {trackingDateError && (
    <span className="profile-field-error" role="alert">
      {trackingDateError}
    </span>
  )}
</label>

            
<label className="profile-form-field">
  Minimum Reserve Limit (₱)

  <input
    type="number"
    name="reserveLimit"
    value={settings.reserveLimit}
    onChange={handleChange}
    min="0"
    step="0.01"
    required
    aria-invalid={!!reserveLimitError}
  />

  {reserveLimitError && (
    <span className="profile-field-error" role="alert">
      {reserveLimitError}
    </span>
  )}
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
          <div className="settings-actions financial-save-actions">
            <div className="financial-save-feedback">
              {saved && (
                <span className="settings-saved" role="status">
                  ✓ Settings saved successfully
                </span>
              )}
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
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
              onChange={handleNotificationToggle}
              disabled={notificationSaving || saving}
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
              onChange={handleNotificationToggle}
              disabled={notificationSaving || saving}
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
              onChange={handleNotificationToggle}
              disabled={notificationSaving || saving}
            />
          </div>
          <div className="notification-save-feedback" aria-live="polite">
            {notificationSaving && (
              <span className="notification-saving">
                Saving notification preferences...
              </span>
            )}

            {!notificationSaving && notificationSaveSuccess && (
              <span className="notification-save-success">
                ✓ {notificationSaveSuccess}
              </span>
            )}

            {!notificationSaving && notificationSaveError && (
              <span className="notification-save-error" role="alert">
                {notificationSaveError}
              </span>
            )}
          </div>
        </div>
      </form>
      )}

      {showNameConfirmation && createPortal(
        <div className="picture-modal-overlay">
          <div className="picture-modal confirmation-modal">
            <div className="picture-modal-icon">✦</div>

           <h3>Save Your Settings?</h3>

          <p className="picture-modal-description">
            Are you sure you want to save your changes to your DueWise account settings?
          </p>

            <div className="picture-modal-actions">
              <button
                type="button"
                className="picture-cancel-button"
                onClick={() => setShowNameConfirmation(false)}
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
                {saving ? 'Saving...' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {showPictureModal && (
        <div className="picture-modal-overlay">
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
                  const success = await handlePictureUpload();

                  if (success) {
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
