import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import SignOutButton from './SignOutButton.jsx';
import { MOCK_MODE } from '../services/api.js';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/installments', label: 'Installments' },
  { to: '/allowance', label: 'Allowance' },
  { to: '/simulator', label: 'Simulator' },
  { to: '/settings', label: 'Settings' },
];

// One nav element: a sidebar on desktop, a bottom bar on phones (see index.css).
// The signed-in user and Sign out button show in the desktop sidebar; phones use Settings.
export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">DueWise</div>
        <nav className="nav" aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          {user ? (
            <>
              <div className="sidebar-user-name">{user.displayName || 'Signed in'}</div>
              <div className="sidebar-user-email muted">{user.email}</div>
              <SignOutButton className="btn btn-sm btn-block" />
            </>
          ) : (
            MOCK_MODE && <span className="badge badge-muted">Demo mode · sample data</span>
          )}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
