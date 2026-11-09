import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Installments from './pages/Installments.jsx';
import Allowance from './pages/Allowance.jsx';
import Simulator from './pages/Simulator.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import ToastProvider from './context/ToastProvider.jsx';
import AuthProvider from './context/AuthProvider.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/installments" element={<Installments />} />
                <Route path="/allowance" element={<Allowance />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
