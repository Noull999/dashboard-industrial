import { useEffect, useState } from 'react';
import type { SensorMeta } from '../types';

const API = 'http://localhost:8000';

interface AlertRecord {
  id: number;
  sensor_id: string;
  value: number;
  message: string;
  triggered_at: string;
  resolved_at: string | null;
}

interface Props {
  sensors: SensorMeta[];
  onSelectSensor: (id: string) => void;
}

function elapsed(from: string, to?: string | null): string {
  const ms = (to ? new Date(to) : new Date()).getTime() - new Date(from).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AlertsView({ sensors, onSelectSensor }: Props) {
  const [history, setHistory] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`${API}/alerts/history?limit=100`)
      .then(r => r.json())
      .then(d => { setHistory(d); setLoading(false); });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const sensorName = (id: string) => sensors.find(s => s.id === id)?.name ?? id;

  const active   = history.filter(a => !a.resolved_at);
  const resolved = history.filter(a =>  a.resolved_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Active alerts */}
      <section>
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 12 }}>
          Alertas activas — {active.length}
        </div>

        {active.length === 0 ? (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 8, padding: '32px 20px',
            textAlign: 'center', color: 'var(--green)', fontSize: 13, fontWeight: 600,
          }}>
            ● Sin alertas activas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(a => (
              <div
                key={a.id}
                onClick={() => onSelectSensor(a.sensor_id)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 120px 80px',
                  alignItems: 'center', gap: 12,
                  background: '#0d0808', border: '1px solid var(--red-dim)',
                  borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
                  borderLeft: '3px solid var(--red)',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 2 }}>
                    ⚠ {sensorName(a.sensor_id)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{a.message}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 9, marginBottom: 2 }}>VALOR</div>
                  {a.value.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 9, marginBottom: 2 }}>DISPARADA</div>
                  {fmt(a.triggered_at)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                  {elapsed(a.triggered_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History log */}
      <section>
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 12 }}>
          Historial resuelto — {resolved.length}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: 12, padding: 20 }}>Cargando…</div>
        ) : resolved.length === 0 ? (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 8, padding: '24px 20px',
            textAlign: 'center', color: 'var(--text-3)', fontSize: 12,
          }}>
            Sin alertas resueltas todavía
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 130px 130px 80px 70px',
              padding: '9px 16px', background: '#0a0a0a',
              borderBottom: '1px solid var(--border)',
              fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
              color: 'var(--text-3)', fontWeight: 600,
            }}>
              <span>Sensor</span>
              <span>Mensaje</span>
              <span>Disparada</span>
              <span>Resuelta</span>
              <span>Duración</span>
              <span style={{ textAlign: 'right' }}>Valor</span>
            </div>

            {resolved.map((a, i) => (
              <div
                key={a.id}
                onClick={() => onSelectSensor(a.sensor_id)}
                style={{
                  display: 'grid', gridTemplateColumns: '180px 1fr 130px 130px 80px 70px',
                  padding: '11px 16px', alignItems: 'center',
                  borderBottom: i < resolved.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', background: 'var(--surface)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#111'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'; }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 1 }}>{sensorName(a.sensor_id)}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{a.sensor_id}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{a.message}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmt(a.triggered_at)}</div>
                <div style={{ fontSize: 10, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fmt(a.resolved_at!)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {elapsed(a.triggered_at, a.resolved_at)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {a.value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
