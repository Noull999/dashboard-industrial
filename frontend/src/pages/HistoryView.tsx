import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { SensorMeta, SensorReading } from '../types';
import { getSensorStatus } from '../types';
import { useSensorHistory } from '../hooks/useSensorHistory';
import type { HistoryRange } from '../hooks/useSensorHistory';

interface Props {
  sensors: SensorMeta[];
  readings: Record<string, SensorReading>;
  lastSeen: Record<string, number>;
}

const RANGES: HistoryRange[] = ['30m', '1h', '6h', '24h'];

const STATUS_COLOR: Record<string, string> = {
  normal: 'var(--green)',
  warning: 'var(--yellow)',
  alert: 'var(--red)',
  offline: '#555',
};

function formatTime(iso: string, range: HistoryRange) {
  const d = new Date(iso);
  if (range === '24h') {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function HistoryView({ sensors, readings, lastSeen }: Props) {
  const [selectedId, setSelectedId] = useState<string>(sensors[0]?.id ?? '');
  const [range, setRange] = useState<HistoryRange>('1h');

  const sensor = sensors.find(s => s.id === selectedId) ?? null;
  const { data, loading, error } = useSensorHistory(selectedId || null, range);

  const now = Date.now();

  const stats = useMemo(() => {
    if (!data.length) return null;
    const vals = data.map(d => d.value);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals.length,
    };
  }, [data]);

  const chartData = useMemo(
    () => data.map(d => ({ ...d, time: formatTime(d.timestamp, range) })),
    [data, range],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, height: '100%' }}>

      {/* Sensor list */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', alignSelf: 'start' }}>
        <div style={{
          padding: '9px 12px', background: '#0a0a0a', borderBottom: '1px solid var(--border)',
          fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600,
        }}>
          Sensores
        </div>
        {sensors.map((s, i) => {
          const reading = readings[s.id] ?? null;
          const seen = lastSeen[s.id] ?? null;
          const isOffline = !reading || (seen !== null && now - seen > 15000);
          const status = isOffline ? 'offline' : getSensorStatus(reading!.value, s.min_val, s.max_val);
          const isSelected = s.id === selectedId;

          return (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: '10px 12px',
                borderBottom: i < sensors.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                background: isSelected ? 'color-mix(in srgb, var(--red) 10%, transparent)' : 'var(--surface)',
                borderLeft: isSelected ? '2px solid var(--red)' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#111';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = isSelected
                  ? 'color-mix(in srgb, var(--red) 10%, transparent)'
                  : 'var(--surface)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: STATUS_COLOR[status] }}>●</span>
                <span style={{ fontSize: 11, fontWeight: isSelected ? 600 : 400 }}>{s.name}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 14, fontVariantNumeric: 'tabular-nums' }}>
                {reading ? `${reading.value.toFixed(1)} ${s.unit}` : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sensor ? (<>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{sensor.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {sensor.id} — {sensor.location} — {sensor.unit}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGES.map(r => (
                <button key={r} onClick={() => setRange(r)} style={{
                  padding: '5px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: 'none',
                  background: range === r ? 'var(--red-bg)' : '#111',
                  color: range === r ? 'var(--red)' : 'var(--text-3)',
                  fontWeight: range === r ? 700 : 400,
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Mínimo', value: stats.min.toFixed(2), unit: sensor.unit },
                { label: 'Máximo', value: stats.max.toFixed(2), unit: sensor.unit },
                { label: 'Promedio', value: stats.avg.toFixed(2), unit: sensor.unit },
                { label: 'Lecturas', value: String(stats.count), unit: 'pts' },
              ].map(({ label, value, unit }) => (
                <div key={label} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 3 }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          <div style={{
            background: '#080808', border: '1px solid var(--border)',
            borderRadius: 8, padding: '16px 8px 8px',
          }}>
            {loading && (
              <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: 60 }}>
                Cargando…
              </div>
            )}
            {error && (
              <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', padding: 60 }}>
                {error}
              </div>
            )}
            {!loading && !error && chartData.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: 60 }}>
                Sin datos para este período
              </div>
            )}
            {!loading && chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#111" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#444', fontSize: 9 }}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={{ stroke: '#222' }}
                  />
                  <YAxis
                    tick={{ fill: '#444', fontSize: 9 }}
                    width={40}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#888', marginBottom: 4 }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(v) => [`${Number(v).toFixed(2)} ${sensor.unit}`, sensor.name]}
                  />
                  <ReferenceLine y={sensor.min_val} stroke="#7f1d1d" strokeDasharray="4 4" strokeWidth={1} label={{ value: `mín ${sensor.min_val}`, fill: '#7f1d1d', fontSize: 9, position: 'insideTopRight' }} />
                  <ReferenceLine y={sensor.max_val} stroke="#7f1d1d" strokeDasharray="4 4" strokeWidth={1} label={{ value: `máx ${sensor.max_val}`, fill: '#7f1d1d', fontSize: 9, position: 'insideBottomRight' }} />
                  <Line
                    type="monotone" dataKey="value"
                    stroke="var(--red)" dot={false} strokeWidth={2}
                    activeDot={{ r: 4, fill: 'var(--red)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>) : (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: 40 }}>
            Seleccioná un sensor
          </div>
        )}
      </div>
    </div>
  );
}
