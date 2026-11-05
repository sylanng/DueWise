import { Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Installments from "./pages/Installments";
import Allowance from "./pages/Allowance";
import Simulator from "./pages/Simulator";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <>
      <nav style={{ display: "flex", gap: "1rem", padding: "1rem" }}>
        <Link to="/">Dashboard</Link>
        <Link to="/installments">Installments</Link>
        <Link to="/allowance">Allowance</Link>
        <Link to="/simulator">Simulator</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/installments" element={<Installments />} />
        <Route path="/allowance" element={<Allowance />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </>
  );
}