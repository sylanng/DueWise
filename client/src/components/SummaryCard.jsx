// tone: 'default' | 'danger' | 'success'
export default function SummaryCard({ label, value, sub, tone = 'default' }) {
  return (
    <div className={`card summary-card summary-${tone}`}>
      <div className="summary-label muted">{label}</div>
      <div className="summary-value">{value}</div>
      {sub && <div className="summary-sub muted">{sub}</div>}
    </div>
  );
}
