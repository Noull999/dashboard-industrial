import { useState, useEffect } from 'react';
import type { SensorMeta, SensorReading } from '../types';
import { getSensorStatus } from '../types';
import SensorChart from './SensorChart';
import ProductSelector from './ProductSelector';

interface Props {
  sensor: SensorMeta | null;
  reading: SensorReading | null;
  onClose: () => void;
}

interface SensorEvent {
  id: number;
  value: number;
  message: string;
  triggered_at: string;
  resolved: boolean;
}

const API = 'http://localhost:8000';
const STATUS_COLOR = { normal: 'var(--green)', warning: 'var(--yellow)', alert: 'var(--red)', offline: '#555' };
const STATUS_LABEL = { normal: 'NORMAL', warning: 'ATENCIÓN', alert: 'ALERTA', offline: 'OFFLINE' };

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function SensorDrawer({ sensor, reading, onClose }: Props) {
  const [stats, setStats] = useState<{ min: number; avg: number; max: number } | null>(null);
  const [events, setEvents] = useState<SensorEvent[]>([]);

  useEffect(() => {
    if (!sensor) return;
    setStats(null);
    setEvents([]);
    fetch(`${API}/sensors/${sensor.id}/history?range=1h`)
      .then(r => r.json())
      .then((data: { value: number }[]) => {
        if (data.length === 0) return;
        const vals = data.map(d => d.value);
        setStats({
          min: Math.min(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          max: Math.max(...vals),
        });
      });
    fetch(`${API}/sensors/${sensor.id}/events`)
      .then(r => r.json())
      .then(setEvents);
  }, [sensor?.id]);

  if (!sensor) return null;

  const status = reading ? getSensorStatus(reading.value, sensor.min_val, sensor.max_val) : 'offline';
  const color = STATUS_COLOR[status];

  // Derived t/h for production lines (kg/min × 60 / 1000)
  const tph = sensor.unit === 'kg/min' && reading
    ? (reading.value * 60 / 1000).toFixed(3)
    : null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
      background: 'var(--surface)', borderLeft: '1px solid var(--border-2)',
      zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 10,
          letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', marginBottom: 12,
        }}>← Volver</button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{sensor.name}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 3 }}>
              {sensor.id} · {sensor.location}
            </div>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            background: status === 'alert' ? 'var(--red-bg)' : status === 'warning' ? 'var(--yellow-bg)' : 'var(--green-bg)',
            color,
            border: `1px solid ${status === 'alert' ? 'var(--red-dim)' : status === 'warning' ? '#713f12' : 'var(--green-dim)'}`,
            animation: status === 'alert' ? 'pulse 1.5s infinite' : undefined,
          }}>{STATUS_LABEL[status]}</span>
        </div>

        {/* Main value */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 52, fontWeight: 800, color, letterSpacing: -2, lineHeight: 1 }}>
            {reading ? reading.value.toFixed(1) : '—'}
          </span>
          <span style={{ fontSize: 22, color: 'var(--text-3)' }}>{sensor.unit}</span>
          {tph && (
            <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 8 }}>
              = <strong style={{ color: 'var(--green)' }}>{tph}</strong> t/h
            </span>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
          Límites: <span style={{ color }}>{sensor.min_val} — {sensor.max_val} {sensor.unit}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stats strip */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { label: 'Mínimo (1h)', value: stats.min.toFixed(1), color: '#5dade2' },
              { label: 'Promedio (1h)', value: stats.avg.toFixed(1), color: 'var(--text)' },
              { label: 'Máximo (1h)', value: stats.max.toFixed(1), color },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ background: 'var(--surface)', padding: '12px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <SensorChart sensor={sensor} />

        {sensor.is_production_line && <ProductSelector sensorId={sensor.id} sensorName={sensor.name} />}

        {events.length > 0 && (
          <div>
            <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
              Registro de eventos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map(ev => (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 10px', background: '#080808',
                  border: '1px solid #141414', borderRadius: 6,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                    background: ev.resolved ? 'var(--green)' : 'var(--red)',
                  }} />
                  <div style={{ flex: 1, color: '#aaa', fontSize: 11, lineHeight: 1.4 }}>
                    {ev.message}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10, whiteSpace: 'nowrap' }}>
                    hace {timeAgo(ev.triggered_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            Información del sensor
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Tipo', value: sensor.sensor_type },
              { label: 'Protocolo', value: 'WebSocket / JSON' },
              { label: 'Frecuencia', value: 'Cada 5 segundos' },
              { label: 'Ubicación', value: sensor.location },
              { label: 'Rango normal', value: `${sensor.min_val} — ${sensor.max_val} ${sensor.unit}` },
              { label: 'Estado WS', value: reading ? 'Conectado' : 'Sin datos' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#080808', border: '1px solid #141414', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
