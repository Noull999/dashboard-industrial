import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useSensorHistory } from '../hooks/useSensorHistory';
import type { SensorMeta } from '../types';
import type { HistoryRange } from '../hooks/useSensorHistory';

interface Props { sensor: SensorMeta; }

const RANGES: HistoryRange[] = ['30m', '1h', '6h', '24h'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function SensorChart({ sensor }: Props) {
  const [range, setRange] = useState<HistoryRange>('1h');
  const { data, loading, error } = useSensorHistory(sensor.id, range);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
          Historial — {sensor.unit}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '2px 8px', borderRadius: 3, fontSize: 9, cursor: 'pointer', border: 'none',
              background: range === r ? 'var(--red-bg)' : 'transparent',
              color: range === r ? 'var(--red)' : 'var(--text-3)',
            }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ background: '#080808', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 8px' }}>
        {loading && <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Cargando...</div>}
        {error && <div style={{ color: 'var(--red)', fontSize: 11, textAlign: 'center', padding: 20 }}>{error}</div>}
        {!loading && !error && data.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Sin datos aún</div>
        )}
        {!loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={data.map(d => ({ ...d, time: formatTime(d.timestamp) }))}>
              <XAxis dataKey="time" tick={{ fill: '#444', fontSize: 8 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#444', fontSize: 8 }} width={35} />
              <Tooltip
                contentStyle={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: '#888' }}
                itemStyle={{ color: '#fff' }}
              />
              <ReferenceLine y={sensor.min_val} stroke="#7f1d1d" strokeDasharray="4 4" />
              <ReferenceLine y={sensor.max_val} stroke="#7f1d1d" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="var(--red)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
