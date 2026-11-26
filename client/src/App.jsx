
import { useEffect, useRef, useState } from 'react';
import DueWiseLogo from "./components/DueWiseLogo";
import apiRequest from './services/api';
import { createPortal } from 'react-dom';

import Dashboard from './pages/Dashboard';
import Installments from './pages/Installments';
import Allowances from './pages/Allowances';
import Expenses from './pages/Expenses';
import Transactions from './pages/Transactions';
import Projection from './pages/Projection';
import PurchaseSimulator from './pages/PurchaseSimulator';
import Settings from './pages/Settings';
import Login from './pages/Login';
import LoadingScreen from "./components/LoadingScreen";

import { useAuth } from './context/AuthContext';

import {
  LayoutDashboard,
  CreditCard,
  Wallet,
  ReceiptText,
  ChartNoAxesCombined,
  Calculator,
  History,
  SlidersHorizontal,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Bell,
  CheckCircle2,
  CalendarClock,
  Trash2,
  Undo2,
} from 'lucide-react';

import './App.css';

function App() {
  const {
    user,
    loading,
    logout,
    resendVerificationEmail,
    verificationResendSeconds,
  } = useAuth();

  const [activePage, setActivePage] = useState('Dashboard');
  const [isLoadingVisible, setIsLoadingVisible] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
const [selectedInstallment, setSelectedInstallment] = useState(null);
const [isLoadingNotificationDetails, setIsLoadingNotificationDetails] = useState(false);
const [notificationDetailError, setNotificationDetailError] = useState('');
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read
  ).length;
  const notificationMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const sidebarAccountRef = useRef(null);
  // Fetch notifications from the backend
const loadNotifications = async () => {
  try {
    const response = await apiRequest('/api/notifications');

    if (response.success) {
      setNotifications(response.data || []);
    }
  } catch (error) {
    console.error('Failed to load notifications:', error);
  }
};

const [pendingDeletion, setPendingDeletion] = useState(null);
const [undoSecondsLeft, setUndoSecondsLeft] = useState(10);
const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
const [isDeletingNotification, setIsDeletingNotification] = useState(false);
const [showMarkAllReadConfirm, setShowMarkAllReadConfirm] = useState(false);
const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
const deleteTimeoutRef = useRef(null);
const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

// Mark one notification as read
const handleMarkAsRead = async (id) => {
  try {
    await apiRequest(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });

    setNotifications((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
};

// Permanently finalize the previous deletion if another one starts
const finalizePendingDeletion = async () => {
  if (!pendingDeletion) return;

  clearTimeout(deleteTimeoutRef.current);

  try {
    if (pendingDeletion.type === 'single') {
      await apiRequest(
        `/api/notifications/${pendingDeletion.id}`,
        { method: 'DELETE' }
      );
    } else {
      await apiRequest(
        `/api/notifications/delete-all/${pendingDeletion.batchId}`,
        { method: 'DELETE' }
      );
    }
  } catch (error) {
    console.error('Failed to permanently delete notification:', error);
    await loadNotifications();
  }

  setPendingDeletion(null);
};

// Schedule permanent deletion after 10 seconds
const schedulePermanentDeletion = (deletion) => {
  setPendingDeletion(deletion);

  deleteTimeoutRef.current = setTimeout(async () => {
    try {
      if (deletion.type === 'single') {
        await apiRequest(
          `/api/notifications/${deletion.id}`,
          { method: 'DELETE' }
        );
      } else {
        await apiRequest(
          `/api/notifications/delete-all/${deletion.batchId}`,
          { method: 'DELETE' }
        );
      }
    } catch (error) {
      console.error('Permanent deletion failed:', error);
      await loadNotifications();
    } finally {
      setPendingDeletion(null);
      deleteTimeoutRef.current = null;
    }
  }, 10000);
};

// Delete one notification
const handleDeleteNotification = async (id) => {
  if (isDeletingNotification) return;

  setIsDeletingNotification(true);

  try {
    if (pendingDeletion) {
      await finalizePendingDeletion();
    }

    await apiRequest(`/api/notifications/${id}/delete`, {
      method: 'PATCH',
    });

    setNotifications((previous) =>
      previous.filter((item) => item.id !== id)
    );

    if (selectedNotification?.id === id) {
      closeNotificationModal();
    }

    schedulePermanentDeletion({
      type: 'single',
      id,
    });
  } catch (error) {
    console.error('Delete notification failed:', error);
    await loadNotifications();
  } finally {
    setIsDeletingNotification(false);
  }
};

// Undo individual or bulk deletion
const handleUndoDeletion = async () => {
  if (!pendingDeletion) return;

  clearTimeout(deleteTimeoutRef.current);

  try {
    if (pendingDeletion.type === 'single') {
      await apiRequest(
        `/api/notifications/${pendingDeletion.id}/restore`,
        { method: 'PATCH' }
      );
    } else {
      await apiRequest(
        `/api/notifications/restore-all/${pendingDeletion.batchId}`,
        { method: 'PATCH' }
      );
    }

    setPendingDeletion(null);
    await loadNotifications();
  } catch (error) {
    console.error('Undo deletion failed:', error);
    await loadNotifications();
  }
};

// Delete all notifications
const handleDeleteAllNotifications = async () => {
  try {
    if (pendingDeletion) {
      await finalizePendingDeletion();
    }

    const response = await apiRequest(
      '/api/notifications/delete-all',
      { method: 'PATCH' }
    );

    if (!response.success || !response.batchId) return;

    setNotifications([]);
    setNotificationMenuOpen(true);
    setShowDeleteAllConfirm(false);

    schedulePermanentDeletion({
      type: 'bulk',
      batchId: response.batchId,
    });
  } catch (error) {
    console.error('Delete all notifications failed:', error);
    await loadNotifications();
  }
};

const handleNotificationClick = async (notification) => {
  setSelectedNotification(notification);
  setSelectedInstallment(null);
  setNotificationDetailError('');

  // Mark as read
  if (!notification.read) {
    await handleMarkAsRead(notification.id);
  }

  // Fetch the related installment
  if (notification.installmentId) {
    try {
      setIsLoadingNotificationDetails(true);

      const response = await apiRequest(
        `/api/installments/${notification.installmentId}`
      );

      if (response.success) {
        setSelectedInstallment(response.data);
      } else {
        setNotificationDetailError('Unable to load installment details.');
      }
    } catch (error) {
      console.error('Failed to load installment details:', error);
      setNotificationDetailError('Unable to load installment details.');
    } finally {
      setIsLoadingNotificationDetails(false);
    }
  }
};

const closeNotificationModal = () => {
  setSelectedNotification(null);
  setSelectedInstallment(null);
  setNotificationDetailError('');
};

// Mark all notifications as read
// Mark all notifications as read
const handleMarkAllAsRead = async () => {
  if (isMarkingAllAsRead) return;

  try {
    setIsMarkingAllAsRead(true);

    await apiRequest('/api/notifications/read-all', {
      method: 'PATCH',
    });

    setNotifications((previous) =>
      previous.map((item) => ({ ...item, read: true }))
    );

    setShowMarkAllReadConfirm(false);
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
  } finally {
    setIsMarkingAllAsRead(false);
  }
};
  const [theme, setTheme] = useState(
    () => localStorage.getItem('duewise-theme') || 'light'
  );
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");

  // Apply and save the selected appearance
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('duewise-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (loading) {
      setIsLoadingVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoadingVisible(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
  if (!pendingDeletion) {
    setUndoSecondsLeft(10);
    return;
  }

  setUndoSecondsLeft(10);

  const countdown = setInterval(() => {
    setUndoSecondsLeft((previous) => Math.max(previous - 1, 0));
  }, 1000);

  return () => clearInterval(countdown);
}, [pendingDeletion]);

  // Load notifications and refresh periodically
  useEffect(() => {
  if (!user) return;

  // Load notifications immediately when the app opens
  loadNotifications();

  // Listen for newly created notifications
  const handleNotificationUpdate = () => {
    loadNotifications();
  };

  window.addEventListener(
    'duewise:notifications-updated',
    handleNotificationUpdate
  );

  // Keep periodic refresh as a backup
  const interval = setInterval(() => {
    loadNotifications();
  }, 30000);

  return () => {
    clearInterval(interval);

    window.removeEventListener(
      'duewise:notifications-updated',
      handleNotificationUpdate
    );
  };
}, [user]);
  
useEffect(() => {
  const handleClickOutside = (event) => {
    // Keep dropdown open while a modal or confirmation popup is active.
    if (
      selectedNotification ||
      event.target.closest('.delete-confirm-overlay')
    ) {
      return;
    }

    const clickedInsideNotification =
      notificationMenuRef.current?.contains(event.target);

    const clickedInsideProfile =
      profileMenuRef.current?.contains(event.target) ||
      sidebarAccountRef.current?.contains(event.target);

    if (!clickedInsideNotification) {
      setNotificationMenuOpen(false);
    }

    if (!clickedInsideProfile) {
      setProfileMenuOpen(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [selectedNotification]);

  const toggleTheme = () => {
    setTheme((previous) => previous === 'light' ? 'dark' : 'light');
  };

  const openSettings = () => {
    setActivePage('Settings');
    setProfileMenuOpen(false);
  };

  const openLogoutConfirmation = () => {
    setProfileMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);

    try {
      await logout();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleResendVerification = async () => {
    try {
      setSendingVerification(true);
      setVerificationMessage("");
      setVerificationError("");

      await resendVerificationEmail();

      setVerificationMessage("Verification email sent. Please check your inbox.");
    } catch (error) {
      setVerificationError(error.message || "Unable to send verification email.");
    } finally {
      setSendingVerification(false);
    }
  };

  if (loading || isLoadingVisible) {
    return (
      <LoadingScreen
        message="Preparing your financial dashboard..."
        isExiting={!loading}
      />
    );
  }

  if (!user) {
    return <Login />;
  }

  // Require email verification for email/password accounts.
  if (
    user.providerData.some(
      (provider) => provider.providerId === "password"
    ) &&
    !user.emailVerified
  ) {
    
return (
  <div className="duewise-verification-page">
    <div className="duewise-verification-card">

      <div className="verification-brand">
        <DueWiseLogo size="normal" showText={true} />
      </div>

      <div className="verification-icon">
        ✉
      </div>

      <span className="verification-eyebrow">
        ACCOUNT SECURITY
      </span>

      <h2>Verify Your Email</h2>

      <p className="verification-description">
        We've sent a verification link to:
      </p>

      <div className="verification-email">
        {user.email}
      </div>

      <p className="verification-instruction">
        After you click the verification link, DueWise will continue
        automatically. This page checks your status in the background.
      </p>

      {verificationMessage && (
        <div className="verification-success">
          {verificationMessage}
        </div>
      )}

      {verificationError && (
        <div className="verification-error">
          {verificationError}
        </div>
      )}

      <div className="verification-actions">
        <button
          className="verification-primary-button"
          onClick={handleResendVerification}
          disabled={sendingVerification || verificationResendSeconds > 0}
        >
          {sendingVerification
            ? "Sending..."
            : verificationResendSeconds > 0
            ? `Resend available in ${verificationResendSeconds}s`
            : "Resend Verification Email"}
        </button>

        <button
          className="verification-signout-button"
          onClick={openLogoutConfirmation}
        >
          Sign Out
        </button>
      </div>

      <div className="verification-footer">
        ♢ Secure authentication by DueWise
      </div>

    </div>
  </div>
);
  }

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Installments', icon: CreditCard },
    { name: 'Allowances', icon: Wallet },
    { name: 'Expenses', icon: ReceiptText },
    { name: 'Transactions', icon: History },
    { name: 'Projection', icon: ChartNoAxesCombined },
    { name: 'Purchase Simulator', icon: Calculator },
    { name: 'Financial Preferences', icon: SlidersHorizontal },
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return (
          <Dashboard
            user={user}
            onNavigate={setActivePage}
          />
        );
      case 'Installments':
        return <Installments />;
      case 'Allowances':
        return <Allowances />;
      case 'Expenses':
        return <Expenses />;
      case 'Transactions':
        return <Transactions />;
      case 'Projection':
        return <Projection />;
      case 'Purchase Simulator':
        return <PurchaseSimulator />;
      case 'Settings':
        return <Settings />;
      case 'Financial Preferences':
        return <Settings financialOnly />;
      default:
        return <p>Page under development.</p>;
    }
  };

  const profileImage = user.photoURL;

  const profileInitial = (
    user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'
  ).toUpperCase();

  const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const notificationType = selectedNotification?.type;

const installmentName =
  selectedInstallment?.description ||
  selectedInstallment?.provider ||
  'Installment';

const reminderBalance = Math.max(
  0,
  Number(selectedInstallment?.totalAmount || 0) -
    Number(selectedInstallment?.paidPayments || 0) *
      Number(selectedInstallment?.amountPerPayment || 0)
);

const notificationVisuals = {
  installment_added: {
    icon: Bell,
    className: 'notification-icon-installment',
  },
  payment_recorded: {
    icon: Wallet,
    className: 'notification-icon-payment',
  },
  payment_completed: {
    icon: CheckCircle2,
    className: 'notification-icon-completed',
  },
  due_date_reminder: {
    icon: CalendarClock,
    className: 'notification-icon-reminder',
  },
};

const notificationVisual =
  notificationVisuals[notificationType] ||
  notificationVisuals.installment_added;

const NotificationIcon = notificationVisual.icon;

  return (
    <div className="app-container" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand">
          <DueWiseLogo size="normal" showText={true} />
        </div>

        <div className="sidebar-label">MENU</div>

        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? 'active' : ''
              }`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">
                <item.icon size={18} strokeWidth={1.8} />
              </span>
              {item.name}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar-bottom"
          ref={sidebarAccountRef}
          onClick={() => {
            setProfileMenuOpen((previous) => !previous);
            setNotificationMenuOpen(false);
          }}
          aria-label="Open account menu"
          aria-haspopup="true"
          aria-expanded={profileMenuOpen}
        >
          <div className="profile-avatar">
            {profileImage ? (
              <img src={profileImage} alt="Profile" />
            ) : (
              profileInitial
            )}
          </div>

          <div className="profile-info">
            <strong>{user.displayName || 'My Account'}</strong>
            <span>{user.email}</span>
          </div>
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
          </div>

          <div className="topbar-right">
            <span className="today-label">Personal Finance</span>
            
            <div className="notification-menu-container" ref={notificationMenuRef}>
              <button
                type="button"
                className={`notification-button ${
                  notificationMenuOpen ? "active" : ""
                }`}
                onClick={() => {
                  setNotificationMenuOpen((previous) => !previous);
                  setProfileMenuOpen(false);
                }}
                aria-label="Open notifications"
                aria-expanded={notificationMenuOpen}
              >
                <Bell size={20} strokeWidth={1.8} />

                {unreadNotificationCount > 0 && (
                  <span className="notification-badge">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </button>

            {notificationMenuOpen && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <strong>Notifications</strong>

                  <div className="notification-header-actions">
                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowMarkAllReadConfirm(true)}
                        className="mark-all-read-button"
                      >
                        <CheckCircle2 size={14} />
                        Mark All as Read
                      </button>
                    )}

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteAllConfirm(true)}
                        className="delete-all-notifications-button"
                      >
                        <Trash2 size={14} />
                        Delete All
                      </button>
                    )}
                  </div>
                </div>

                {notifications.length > 0 ? (
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`notification-item ${
                          notification.read ? 'read' : 'unread'
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <span
                          className={`notification-item-icon ${
                            notificationVisuals[notification.type]?.className ||
                            'notification-icon-installment'
                          }`}
                        >
                          {(() => {
                            const ItemIcon =
                              notificationVisuals[notification.type]?.icon || Bell;

                            return <ItemIcon size={18} strokeWidth={2} />;
                          })()}
                        </span>

                        <span className="notification-item-content">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>

                          {notification.createdAt && (
                            <small>
                              {new Date(notification.createdAt).toLocaleString(
                                'en-PH',
                                {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }
                              )}
                            </small>
                          )}
                        </span>

                        <span
                          className={`notification-read-status ${
                            notification.read ? 'is-read' : 'is-unread'
                          }`}
                        >
                          <span className="notification-status-dot" />
                          {notification.read ? 'Read' : 'Unread'}
                        </span>
                        <button
                          type="button"
                          className="notification-delete-button"
                          aria-label="Delete notification"
                          disabled={isDeletingNotification}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteNotification(notification.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                        </div>
                    ))}
                  </div>
                ) : (
                  <div className="notification-empty">
                    <Bell size={30} strokeWidth={1.5} />
                    <strong>You're all caught up!</strong>
                    <p>Your notifications will appear here.</p>
                  </div>
                )}
              </div>
            )}

            {pendingDeletion && (
              <div className="notification-undo-toast">
                <span>
                  <CheckCircle2 size={17} />
                  {pendingDeletion.type === 'bulk'
                    ? 'All notifications deleted.'
                    : 'Notification deleted.'}

                  <small className="undo-countdown">
                    Undo available for {undoSecondsLeft}s
                  </small>
                </span>

                <button
                  type="button"
                  onClick={handleUndoDeletion}
                >
                  <Undo2 size={15} />
                  Undo
                </button>
              </div>
            )}

            {showMarkAllReadConfirm && createPortal(
              <div
                className="delete-confirm-overlay"
                onClick={() => {
                  if (!isMarkingAllAsRead) {
                    setShowMarkAllReadConfirm(false);
                  }
                }}
              >
                <div
                  className="delete-confirm-modal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="delete-confirm-icon">
                    <CheckCircle2 size={25} />
                  </div>

                  <h2>Mark all as read?</h2>

                  <p>
                    Are you sure you want to mark all {unreadNotificationCount} unread
                    notifications as read? This action will update their read status.
                  </p>

                  <div className="delete-confirm-actions">
                    <button
                      type="button"
                      className="delete-confirm-cancel"
                      disabled={isMarkingAllAsRead}
                      onClick={() => setShowMarkAllReadConfirm(false)}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="delete-confirm-submit"
                      disabled={isMarkingAllAsRead}
                      onClick={handleMarkAllAsRead}
                    >
                      <CheckCircle2 size={16} />
                      {isMarkingAllAsRead ? 'Updating...' : 'Mark All as Read'}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {selectedNotification && createPortal(
              <div
                className="notification-modal-overlay"
                data-theme={theme}
              >
                <div
                  className="notification-modal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="notification-modal-header">
                    <div className="notification-modal-heading">
                      <div
                        className={`notification-modal-icon ${notificationVisual.className}`}
                      >
                        <NotificationIcon size={22} strokeWidth={2} />
                      </div>

                      <div>
                        <span className="notification-modal-label">
                          NOTIFICATION DETAILS
                        </span>
                        <h2>{selectedNotification.title}</h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="notification-modal-close"
                      onClick={closeNotificationModal}
                      aria-label="Close notification details"
                    >
                      ×
                    </button>
                  </div>

                  <div className="notification-modal-body">
                    <p className="notification-modal-message">
                      {selectedNotification.message}
                    </p>

                    <div className="notification-detail-card">
                      <span className="notification-section-label">
                        {notificationType === 'installment_added'
                          ? 'NEW INSTALLMENT'
                          : notificationType === 'payment_recorded'
                            ? 'PAYMENT DETAILS'
                            : notificationType === 'payment_completed'
                              ? 'PAYMENT COMPLETED'
                              : notificationType === 'due_date_reminder'
                                ? 'PAYMENT REMINDER'
                                : 'INSTALLMENT INFORMATION'}
                      </span>

                      {isLoadingNotificationDetails ? (
                        <p>Loading installment details...</p>
                      ) : notificationDetailError ? (
                        <p className="notification-error">
                          {notificationDetailError}
                        </p>
                      ) : selectedInstallment ? (
                        <>
                          <h3>{installmentName}</h3>

                          <div className="notification-detail-row">
                            <span>Provider</span>
                            <strong>{selectedInstallment.provider || '—'}</strong>
                          </div>

                          <div className="notification-detail-row">
                            <span>Total Amount</span>
                            <strong>
                              {formatCurrency(selectedInstallment.totalAmount)}
                            </strong>
                          </div>

                          {notificationType === 'installment_added' && (
                            <>
                              <div className="notification-detail-row">
                                <span>Amount per Payment</span>
                                <strong>
                                  {formatCurrency(selectedInstallment.amountPerPayment)}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Payment Frequency</span>
                                <strong>
                                  {selectedInstallment.paymentFrequency || '—'}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Total Payments</span>
                                <strong>
                                  {selectedInstallment.totalPayments || '—'}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>First Due Date</span>
                                <strong>
                                  {formatDate(
                                    selectedInstallment.nextDueDate ||
                                    selectedInstallment.dueDate
                                  )}
                                </strong>
                              </div>
                            </>
                          )}

                          {(notificationType === 'payment_recorded' ||
                            notificationType === 'payment_completed') && (
                            <>
                              <div className="notification-detail-row">
                                <span>Payment Amount</span>
                                <strong>
                                  {formatCurrency(selectedNotification.paymentAmount)}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Payment Date</span>
                                <strong>
                                  {formatDate(selectedNotification.paymentDate)}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Remaining Balance</span>
                                <strong>
                                  {formatCurrency(selectedNotification.remainingAmount)}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Payment Progress</span>
                                <strong>
                                  {selectedNotification.paidPayments ?? 0} /{' '}
                                  {selectedNotification.totalPayments ??
                                    selectedInstallment.totalPayments ??
                                    '—'} payments
                                </strong>
                              </div>

                              {notificationType === 'payment_completed' && (
                                <div className="notification-detail-row">
                                  <span>Payment Status</span>
                                  <strong className="notification-success">
                                    Fully Paid
                                  </strong>
                                </div>
                              )}
                            </>
                          )}

                          {notificationType === 'due_date_reminder' && (
                            <>
                              <div className="notification-detail-row">
                                <span>Due Date</span>
                                <strong>
                                  {formatDate(selectedNotification.dueDate)}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Payment Deadline</span>
                                <strong>
                                  {selectedNotification.daysUntilDue === 0
                                    ? 'Due Today'
                                    : selectedNotification.daysUntilDue === 1
                                      ? 'Due Tomorrow'
                                      : `In ${selectedNotification.daysUntilDue} days`}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Outstanding Balance</span>
                                <strong>
                                  {formatCurrency(reminderBalance)}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Installment Status</span>
                                <strong>
                                  {selectedInstallment.status || '—'}
                                </strong>
                              </div>
                            </>
                          )}

                          {![
                            'installment_added',
                            'payment_recorded',
                            'payment_completed',
                            'due_date_reminder',
                          ].includes(notificationType) && (
                            <>
                              <div className="notification-detail-row">
                                <span>Due Date</span>
                                <strong>
                                  {formatDate(
                                    selectedInstallment.nextDueDate ||
                                    selectedInstallment.dueDate
                                  )}
                                </strong>
                              </div>

                              <div className="notification-detail-row">
                                <span>Status</span>
                                <strong>
                                  {selectedInstallment.status || '—'}
                                </strong>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <p>There are no linked installment details.</p>
                      )}
                    </div>

                    <p className="notification-modal-date">
                      Received{' '}
                      {selectedNotification.createdAt
                        ? new Date(
                            selectedNotification.createdAt
                          ).toLocaleString('en-PH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : ''}
                    </p>
                  </div>

                  <div className="notification-modal-footer">
                    <button
                      type="button"
                      className="notification-modal-secondary"
                      onClick={closeNotificationModal}
                    >
                      Close
                    </button>

                    {selectedInstallment && (
                      <button
                        type="button"
                        className="notification-modal-primary"
                        onClick={() => {
                          setActivePage('Installments');
                          closeNotificationModal();
                          setNotificationMenuOpen(false);
                        }}
                      >
                        View Installments
                      </button>
                    )}
                  </div>
                </div>
                </div>,
                  document.body
                )}

            </div>

            <div className="profile-menu-container" ref={profileMenuRef}>
              <button
                type="button"
                className={`topbar-profile-button ${
                  profileMenuOpen ? 'active' : ''
                }`}
                onClick={() => {
                  setProfileMenuOpen((previous) => !previous);
                  setNotificationMenuOpen(false);
                }}
              >
                <span className="topbar-avatar">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" />
                  ) : (
                    profileInitial
                  )}
                </span>
                <ChevronDown size={15} />
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="dropdown-avatar">
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" />
                      ) : (
                        profileInitial
                      )}
                    </div>

                    <div className="dropdown-user-info">
                      <strong>{user.displayName || 'My Account'}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item"
                    onClick={openSettings}
                  >
                    <SettingsIcon size={17} />
                    <span>Settings & Account</span>
                  </button>

                  <button
                    type="button"
                    className="profile-dropdown-item"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? (
                      <Moon size={17} />
                    ) : (
                      <Sun size={17} />
                    )}
                    <span>Appearance</span>
                    <small>
                      {theme === 'light' ? 'Light' : 'Dark'}
                    </small>
                  </button>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="profile-dropdown-item logout-item"
                    onClick={openLogoutConfirmation}
                  >
                    <LogOut size={17} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {renderPage()}
        
        {showLogoutConfirm && (
          <div
            className="delete-confirm-overlay"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div
              className="delete-confirm-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="delete-confirm-icon">
                <LogOut size={22} />
              </div>

              <h3>Sign out of DueWise?</h3>

              <p>
                Are you sure you want to sign out of your account?
                You will need to log in again to access your financial information.
              </p>

              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="delete-confirm-cancel"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="delete-confirm-delete"
                  onClick={confirmLogout}
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  verificationContainer: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f5f6fa",
    padding: "20px",
  },

  verificationCard: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    padding: "40px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
};

export default App;
