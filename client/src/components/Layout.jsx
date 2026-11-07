import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/installments', label: 'Installments' },
  { to: '/allowance', label: 'Allowance' },
  { to: '/simulator', label: 'Simulator' },
  { to: '/settings', label: 'Settings' },
];

// One nav element: a sidebar on desktop, a bottom bar on phones (see index.css)
export default function Layout() {
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
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
