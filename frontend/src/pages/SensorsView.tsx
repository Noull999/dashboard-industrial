import type { SensorMeta, SensorReading } from '../types';
import { getSensorStatus } from '../types';

interface Props {
  sensors: SensorMeta[];
  readings: Record<string, SensorReading>;
  lastSeen: Record<string, number>;
  onSelect: (id: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  normal:  'var(--green)',
  warning: 'var(--yellow)',
  alert:   'var(--red)',
  offline: '#555',
};

const STATUS_LABEL: Record<string, string> = {
  normal:  '● Normal',
  warning: '⚡ Atención',
  alert:   '⚠ Alerta',
  offline: '○ Offline',
};

const TYPE_LABEL: Record<string, string> = {
  temperature: 'Temperatura',
  humidity:    'Humedad',
  pressure:    'Presión',
  rpm:         'RPM',
  weight:      'Peso',
  level:       'Nivel',
  flow:        'Caudal',
  production:  'Producción',
};

function Bar({ value, min, max, status }: { value: number; min: number; max: number; status: string }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: STATUS_COLOR[status], borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 9, color: 'var(--text-3)', width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function SensorsView({ sensors, readings, lastSeen, onSelect }: Props) {
  const now = Date.now();

  const rows = sensors.map(s => {
    const reading = readings[s.id] ?? null;
    const seen = lastSeen[s.id] ?? null;
    const isOffline = !reading || (seen !== null && now - seen > 15000);
    const status = isOffline ? 'offline' : getSensorStatus(reading!.value, s.min_val, s.max_val);
    const age = seen ? Math.floor((now - seen) / 1000) : null;
    return { sensor: s, reading, status, age, isOffline };
  });

  const counts = {
    normal:  rows.filter(r => r.status === 'normal').length,
    warning: rows.filter(r => r.status === 'warning').length,
    alert:   rows.filter(r => r.status === 'alert').length,
    offline: rows.filter(r => r.status === 'offline').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10 }}>
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            background: `color-mix(in srgb, ${STATUS_COLOR[k]} 12%, transparent)`,
            color: STATUS_COLOR[k],
            border: `1px solid color-mix(in srgb, ${STATUS_COLOR[k]} 30%, transparent)`,
          }}>
            {v} {STATUS_LABEL[k].split(' ')[1] ?? STATUS_LABEL[k]}
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '180px 120px 90px 100px 90px 1fr 80px',
          padding: '10px 16px',
          background: '#0a0a0a',
          borderBottom: '1px solid var(--border)',
          fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600,
        }}>
          <span>Sensor</span>
          <span>Tipo</span>
          <span>Valor</span>
          <span>Estado</span>
          <span>Rango</span>
          <span style={{ paddingLeft: 8 }}>Nivel</span>
          <span>Últ. lectura</span>
        </div>

        {/* Rows */}
        {rows.map(({ sensor: s, reading, status, age, isOffline }, i) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 120px 90px 100px 90px 1fr 80px',
              padding: '12px 16px',
              alignItems: 'center',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              background: status === 'alert' ? '#0d0808' : 'var(--surface)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              if (status !== 'alert') (e.currentTarget as HTMLDivElement).style.background = '#111';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.background = status === 'alert' ? '#0d0808' : 'var(--surface)';
            }}
          >
            {/* Name + ID */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 0.5 }}>{s.id} — {s.location}</div>
            </div>

            {/* Type */}
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
              {TYPE_LABEL[s.sensor_type] ?? s.sensor_type}
              {s.is_production_line && (
                <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--red)', fontWeight: 700, letterSpacing: 0.5 }}>PROD</span>
              )}
            </div>

            {/* Value */}
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: isOffline ? '#555' : STATUS_COLOR[status] }}>
                {reading ? reading.value.toFixed(1) : '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 3 }}>{s.unit}</span>
            </div>

            {/* Status badge */}
            <div style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[status] }}>
              {STATUS_LABEL[status]}
            </div>

            {/* Min/Max */}
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
              {s.min_val} – {s.max_val} {s.unit}
            </div>

            {/* Bar */}
            <div style={{ paddingLeft: 8 }}>
              {reading && !isOffline
                ? <Bar value={reading.value} min={s.min_val} max={s.max_val} status={status} />
                : <span style={{ fontSize: 10, color: '#444' }}>sin datos</span>
              }
            </div>

            {/* Age */}
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
              {age === null ? '—' : age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
