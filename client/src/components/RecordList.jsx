// A simple list of records: main text + meta line on the left, amount and buttons on the right.
// Wraps naturally on small screens.
export default function RecordList({ items, getTitle, getMeta, getAmount, tone, onEdit, onDelete }) {
  return (
    <div className="rec-list">
      {items.map((item) => (
        <div className="rec-row" key={item.id}>
          <div className="rec-main">
            <div className="rec-title">{getTitle(item)}</div>
            <div className="rec-meta muted">{getMeta(item)}</div>
          </div>
          <div className={`rec-amount rec-amount-${tone}`}>{getAmount(item)}</div>
          <div className="cell-actions">
            <button className="btn btn-sm" onClick={() => onEdit(item)}>Edit</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(item)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
