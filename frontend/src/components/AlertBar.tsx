import type { ActiveAlert, SensorMeta } from '../types';

interface Props {
  alerts: ActiveAlert[];
  sensors: SensorMeta[];
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export default function AlertBar({ alerts, sensors: _ }: Props) {
  if (alerts.length === 0) return null;
  const latest = alerts[0];

  return (
    <div style={{
      background: 'var(--red-bg)',
      border: '1px solid var(--red-dim)',
      borderLeft: '3px solid var(--red)',
      borderRadius: 6,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '0 0 4px',
    }}>
      <span style={{ color: 'var(--red)', fontSize: 16 }}>⚠</span>
      <span style={{ color: '#fca5a5', fontSize: 12, flex: 1 }}>
        <strong style={{ color: 'var(--red)' }}>{latest.message}</strong>
      </span>
      <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{timeAgo(latest.triggered_at)}</span>
      {alerts.length > 1 && (
        <span style={{
          background: 'var(--red)', color: '#fff',
          padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
        }}>
          +{alerts.length - 1}
        </span>
      )}
      <span style={{
        background: 'var(--red)', color: '#fff',
        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
        animation: 'pulse 1.5s infinite',
      }}>
        ACTIVA
      </span>
    </div>
  );
}
