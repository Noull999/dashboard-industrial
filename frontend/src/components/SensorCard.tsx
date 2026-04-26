import type { SensorMeta, SensorReading, SensorStatus } from '../types';
import { getSensorStatus } from '../types';

interface Props {
  meta: SensorMeta;
  reading: SensorReading | null;
  lastSeen: number | null;
  history: number[];
  onClick: () => void;
}

const STATUS_COLORS: Record<SensorStatus | 'offline', string> = {
  normal:  'var(--green)',
  warning: 'var(--yellow)',
  alert:   'var(--red)',
  offline: '#555',
};

const STATUS_LABELS: Record<SensorStatus | 'offline', string> = {
  normal:  '● NORMAL',
  warning: '⚡ ATENCIÓN',
  alert:   '⚠ ALERTA',
  offline: '○ OFFLINE',
};

function Sparkline({ values, color, minVal, maxVal }: { values: number[]; color: string; minVal: number; maxVal: number }) {
  if (values.length < 2) return <div style={{ height: 28 }} />;
  const W = 100;
  const H = 28;
  const range = maxVal - minVal || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - minVal) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${Math.max(0, Math.min(H, y)).toFixed(1)}`;
  }).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 28, display: 'block', opacity: 0.65 }}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RangeBar({ value, minVal, maxVal, color }: { value: number; minVal: number; maxVal: number; color: string }) {
  const pct = Math.min(100, Math.max(0, ((value - minVal) / (maxVal - minVal)) * 100));
  return (
    <div style={{ height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: color, borderRadius: 1,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

export default function SensorCard({ meta, reading, lastSeen, history, onClick }: Props) {
  const now = Date.now();
  const isOffline = !reading || (lastSeen !== null && now - lastSeen > 15000);
  const status: SensorStatus | 'offline' = isOffline
    ? 'offline'
    : getSensorStatus(reading!.value, meta.min_val, meta.max_val);
  const color = STATUS_COLORS[status];

  const isAlert = status === 'alert';

  return (
    <div
      onClick={onClick}
      style={{
        background: isAlert ? '#0d0808' : 'var(--surface)',
        border: `1px solid ${isAlert ? 'var(--red-dim)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '14px 16px 10px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s, background 0.3s',
        animation: isAlert ? 'alertPulse 2s infinite' : undefined,
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, transition: 'background 0.3s' }} />

      {/* Sensor name */}
      <div style={{
        color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.2,
        textTransform: 'uppercase', marginBottom: 8, fontWeight: 600,
      }}>
        {meta.name}
      </div>

      {/* Value — key change triggers numFlash animation */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          key={reading?.value.toFixed(2)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 28, fontWeight: 700, lineHeight: 1, letterSpacing: -1,
            color: isOffline ? '#555' : color,
            animation: reading && !isOffline ? 'numFlash 0.3s ease-out' : undefined,
          }}
        >
          {reading ? reading.value.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{meta.unit}</span>
      </div>

      {/* Range bar */}
      {reading && !isOffline && (
        <RangeBar value={reading.value} minVal={meta.min_val} maxVal={meta.max_val} color={color} />
      )}

      {/* Status label */}
      <div style={{ marginTop: 8, marginBottom: 4, fontSize: 9, fontWeight: 700, color, letterSpacing: 0.5 }}>
        {STATUS_LABELS[status]}
      </div>

      {/* Sparkline */}
      <Sparkline values={history} color={color} minVal={meta.min_val} maxVal={meta.max_val} />
    </div>
  );
}
