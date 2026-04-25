import { useState, useEffect } from 'react';

const API = 'http://localhost:8000';

interface LineData {
  sensor_id: string;
  sensor_name: string;
  total_kg: number;
  product_name: string | null;
}

interface TotalData {
  lines: LineData[];
  grand_total_kg: number;
}

export default function ProductionTotal() {
  const [data, setData] = useState<TotalData | null>(null);

  useEffect(() => {
    const load = () => fetch(`${API}/production-today`).then(r => r.json()).then(setData);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--green)' }} />
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        Total producido hoy
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: -1 }}>
        {(data.grand_total_kg / 1000).toFixed(2)}
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>t</span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.lines.map(line => (
          <div key={line.sensor_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
            <span style={{ color: 'var(--text-3)' }}>{line.sensor_name.replace('Línea Producción ', 'L')}</span>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{line.total_kg.toFixed(1)} kg</span>
            {line.product_name && (
              <span style={{ color: 'var(--green)', marginLeft: 'auto' }}>{line.product_name}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: 0.5 }}>
        ● ACUMULADO
      </div>
    </div>
  );
}
