import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { MOCK_MODE } from '../services/api.js';

// Pages inside this route need a signed-in user. In mock mode there is no sign-in at all.
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (MOCK_MODE) return <Outlet />;
  if (loading) return <div className="center-screen muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
