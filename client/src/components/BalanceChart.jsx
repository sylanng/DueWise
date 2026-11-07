import { useEffect, useRef, useState } from 'react';
import { formatPeso, formatShortDate } from '../services/format';

const H = 280;
const PAD = { left: 70, right: 16, top: 16, bottom: 32 };
const MIN_W = 320;

const pesoShort = (v) => `${v < 0 ? '-' : ''}₱${Math.abs(Math.round(v)).toLocaleString('en-PH')}`;

// Step chart of projected balance. The balance only changes on event dates, so
// it is drawn as steps. The red zone is everything below the reserve.
// Optional compareTimeline draws a second (dashed) line, used by the simulator.
// The SVG is drawn at the container's real width so text stays normal size.
export default function BalanceChart({
  timeline,
  threshold,
  compareTimeline,
  baseLabel = 'Current plan',
  compareLabel = 'With this purchase',
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setWidth(Math.max(Math.floor(el.clientWidth), MIN_W));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!timeline || timeline.length === 0) return null;

  const W = width;
  const all = [...timeline, ...(compareTimeline || [])].map((p) => p.balance);
  const min = Math.min(...all, threshold);
  const max = Math.max(...all, threshold);
  const span = max - min || 1;
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / Math.max(timeline.length - 1, 1)) * plotW;
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const stepPath = (points) => {
    let d = `M ${x(0)} ${y(points[0].balance)}`;
    for (let i = 1; i < points.length; i++) d += ` H ${x(i)} V ${y(points[i].balance)}`;
    return d;
  };

  const ticks = [0, 1, 2, 3].map((k) => yMin + ((yMax - yMin) * k) / 3);
  const mid = Math.floor((timeline.length - 1) / 2);
  const xLabels = [
    { i: 0, anchor: 'start' },
    { i: mid, anchor: 'middle' },
    { i: timeline.length - 1, anchor: 'end' },
  ];
  const thresholdY = y(threshold);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Projected balance from ${formatShortDate(timeline[0].date)} to ${formatShortDate(timeline[timeline.length - 1].date)}, reserve ${formatPeso(threshold)}`}
      >
        <rect className="chart-danger-zone" x={PAD.left} y={thresholdY} width={plotW} height={Math.max(PAD.top + plotH - thresholdY, 0)} />
        {ticks.map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end">{pesoShort(v)}</text>
          </g>
        ))}
        <line className="chart-threshold" x1={PAD.left} x2={W - PAD.right} y1={thresholdY} y2={thresholdY} />
        <text className="chart-threshold-label" x={W - PAD.right} y={thresholdY - 6} textAnchor="end">Reserve {formatPeso(threshold)}</text>
        <path className="chart-line" d={stepPath(timeline)} />
        {compareTimeline && <path className="chart-line-alt" d={stepPath(compareTimeline)} />}
        {xLabels.map(({ i, anchor }) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={anchor}>{formatShortDate(timeline[i].date)}</text>
        ))}
      </svg>
      {compareTimeline && (
        <div className="chart-legend">
          <span className="legend-item"><span className="legend-swatch" /> {baseLabel}</span>
          <span className="legend-item"><span className="legend-swatch legend-swatch-alt" /> {compareLabel}</span>
        </div>
      )}
    </div>
  );
}
