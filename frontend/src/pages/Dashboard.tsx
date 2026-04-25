import { useState, useCallback, useEffect, useRef } from 'react';
import type { SensorMeta, SensorReading, ActiveAlert } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import SensorCard from '../components/SensorCard';
import AlertBar from '../components/AlertBar';
import SensorDrawer from '../components/SensorDrawer';
import ProductionTotal from '../components/ProductionTotal';

const API = 'http://localhost:8000';

export default function Dashboard() {
  const [sensors, setSensors] = useState<SensorMeta[]>([]);
  const [readings, setReadings] = useState<Record<string, SensorReading>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const alertTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    fetch(`${API}/sensors`).then(r => r.json()).then(setSensors);
    fetch(`${API}/alerts`).then(r => r.json()).then(setAlerts);
    alertTimer.current = setInterval(() => {
      fetch(`${API}/alerts`).then(r => r.json()).then(setAlerts);
    }, 10000);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(alertTimer.current);
      clearInterval(clockTimer);
    };
  }, []);

  const handleMessage = useCallback((reading: SensorReading) => {
    setReadings(prev => ({ ...prev, [reading.sensor_id]: reading }));
    setLastSeen(prev => ({ ...prev, [reading.sensor_id]: Date.now() }));
    if (reading.alert) {
      fetch(`${API}/alerts`).then(r => r.json()).then(setAlerts);
    }
  }, []);

  const { connected } = useWebSocket(handleMessage);
  const selectedSensor = sensors.find(s => s.id === selectedId) ?? null;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d: Date) => d.toLocaleTimeString('es-AR');

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 56, background: '#0a0a0a', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 0', gap: 8, flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, background: 'var(--red)', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 14, marginBottom: 16,
        }}>IP</div>

        {[
          { icon: '⊞', label: 'Dashboard', active: true },
          { icon: '〜', label: 'Sensores' },
          { icon: '🔔', label: 'Alertas' },
          { icon: '📈', label: 'Historial' },
        ].map(({ icon, label, active }) => (
          <div key={label} title={label} style={{
            width: 36, height: 36, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: active ? 'var(--red-bg)' : 'transparent',
            color: active ? 'var(--red)' : 'var(--text-3)',
            cursor: 'pointer', fontSize: 14,
          }}>{icon}</div>
        ))}

        <div style={{ flex: 1 }} />
        <div title="Config" style={{
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)', cursor: 'pointer',
        }}>⚙</div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 52, background: '#0a0a0a', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Planta Pesquera
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>
              — Puerto Madryn, Sector A
            </span>
          </div>
          <div style={{ flex: 1 }} />
          {alerts.length > 0 && (
            <span style={{
              background: 'var(--red-bg)', color: 'var(--red)',
              border: '1px solid var(--red-dim)',
              padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
              animation: 'pulse 1.5s infinite',
            }}>⚠ {alerts.length} ALERTA{alerts.length > 1 ? 'S' : ''}</span>
          )}
          <span style={{
            background: connected ? 'var(--green-bg)' : '#1a1a1a',
            color: connected ? 'var(--green)' : 'var(--text-3)',
            border: `1px solid ${connected ? 'var(--green-dim)' : 'var(--border)'}`,
            padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
          }}>
            {connected ? `● ${sensors.length} ONLINE` : '○ RECONECTANDO'}
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(now)} — {formatDate(now)}
          </span>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {alerts.length > 0 && <AlertBar alerts={alerts} sensors={sensors} />}

          <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
            Sensores en tiempo real
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {sensors.filter(s => !s.is_production_line).map(sensor => (
              <SensorCard
                key={sensor.id}
                meta={sensor}
                reading={readings[sensor.id] ?? null}
                lastSeen={lastSeen[sensor.id] ?? null}
                onClick={() => setSelectedId(sensor.id)}
              />
            ))}
          </div>

          <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
            Líneas de producción
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {sensors.filter(s => s.is_production_line).map(sensor => (
              <SensorCard
                key={sensor.id}
                meta={sensor}
                reading={readings[sensor.id] ?? null}
                lastSeen={lastSeen[sensor.id] ?? null}
                onClick={() => setSelectedId(sensor.id)}
              />
            ))}
            <ProductionTotal />
          </div>
        </div>
      </div>

      {/* Drawer overlay */}
      {selectedId && (
        <>
          <div
            onClick={() => setSelectedId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10 }}
          />
          <SensorDrawer
            sensor={selectedSensor}
            reading={readings[selectedId] ?? null}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}
    </div>
  );
}
