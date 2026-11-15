
import { useEffect, useState } from 'react';
import DueWiseLogo from "./components/DueWiseLogo";

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
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Bell,
} from 'lucide-react';

import './App.css';

function App() {
  const {
    user,
    loading,
    logout,
    refreshUser,
    resendVerificationEmail,
  } = useAuth();

  const [activePage, setActivePage] = useState('Dashboard');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('duewise-theme') || 'light'
  );
  const [sendingVerification, setSendingVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");

  // Apply and save the selected appearance
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('duewise-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((previous) => previous === 'light' ? 'dark' : 'light');
  };

  const openSettings = () => {
    setActivePage('Settings');
    setProfileMenuOpen(false);
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
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

  const handleCheckVerification = async () => {
    try {
      setCheckingVerification(true);
      setVerificationError("");
      setVerificationMessage("");

      await refreshUser();
    } catch (error) {
      setVerificationError(error.message || "Unable to check verification status.");
    } finally {
      setCheckingVerification(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Preparing your financial dashboard..." />;
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
      <div style={styles.verificationContainer}>
        <div style={styles.verificationCard}>
          <h2>Verify Your Email</h2>

          <p>
            We've sent a verification link to:
          </p>

          <strong>{user.email}</strong>

          <p>
            Please verify your email before accessing your DueWise account.
          </p>

          {verificationMessage && (
            <p style={{ color: "green" }}>{verificationMessage}</p>
          )}

          {verificationError && (
            <p style={{ color: "red" }}>{verificationError}</p>
          )}

          <button
            onClick={handleResendVerification}
            disabled={sendingVerification}
          >
            {sendingVerification ? "Sending..." : "Resend Verification Email"}
          </button>

          <button
            onClick={handleCheckVerification}
            disabled={checkingVerification}
          >
            {checkingVerification ? "Checking..." : "I've Verified My Email"}
          </button>

          <button onClick={handleLogout}>
            Sign Out
          </button>
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
      default:
        return <p>Page under development.</p>;
    }
  };

  const profileImage = user.photoURL;

  const profileInitial = (
    user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'
  ).toUpperCase();

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

        <div className="sidebar-bottom">
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
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
          </div>

          <div className="topbar-right">
            <span className="today-label">Personal Finance</span>
            
            <div className="notification-menu-container">
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
              </button>

              {notificationMenuOpen && (
                <div className="notification-dropdown">
                  <div className="notification-dropdown-header">
                    <strong>Notifications</strong>
                  </div>

                  <div className="notification-empty">
                    <Bell size={30} strokeWidth={1.5} />
                    <strong>You're all caught up!</strong>
                    <p>Your notifications will appear here.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="profile-menu-container">
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
                    onClick={handleLogout}
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
