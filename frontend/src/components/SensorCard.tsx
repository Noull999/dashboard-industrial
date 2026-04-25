import type { SensorMeta, SensorReading, SensorStatus } from '../types';
import { getSensorStatus } from '../types';

interface Props {
  meta: SensorMeta;
  reading: SensorReading | null;
  lastSeen: number | null;
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

export default function SensorCard({ meta, reading, lastSeen, onClick }: Props) {
  const now = Date.now();
  const isOffline = !reading || (lastSeen !== null && now - lastSeen > 15000);
  const status: SensorStatus | 'offline' = isOffline
    ? 'offline'
    : getSensorStatus(reading!.value, meta.min_val, meta.max_val);
  const color = STATUS_COLORS[status];

  return (
    <div onClick={onClick} style={{
      background: status === 'alert' ? '#0d0808' : 'var(--surface)',
      border: `1px solid ${status === 'alert' ? 'var(--red-dim)' : 'var(--border)'}`,
      borderRadius: 8,
      padding: '14px 16px',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />

      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {meta.name}
      </div>

      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: isOffline ? '#555' : undefined }}>
        {reading ? reading.value.toFixed(1) : '—'}
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>{meta.unit}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color, letterSpacing: 0.5 }}>
        {STATUS_LABELS[status]}
      </div>
    </div>
  );
}
