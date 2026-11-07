import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Installments from './pages/Installments.jsx';
import Allowance from './pages/Allowance.jsx';
import Simulator from './pages/Simulator.jsx';
import Settings from './pages/Settings.jsx';
import ToastProvider from './context/ToastProvider.jsx';

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/allowance" element={<Allowance />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
