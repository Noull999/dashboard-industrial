import { useState, useEffect } from 'react';

const API = 'http://localhost:8000';
const SPECIES = ['Merluza', 'Langostino', 'Calamar', 'Salmón', 'Otro'];

interface Props { sensorId: string; sensorName: string; }

export default function ProductSelector({ sensorId, sensorName: _ }: Props) {
  const [current, setCurrent] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/sensors/${sensorId}/product`)
      .then(r => r.json())
      .then(d => setCurrent(d.product_name));
  }, [sensorId]);

  const save = async (name: string) => {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`${API}/sensors/${sensorId}/product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: name.trim() }),
    });
    setCurrent(name.trim());
    setSaving(false);
  };

  return (
    <div>
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
        Producto activo
      </div>
      {current && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-dim)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--green)' }}>
          ● {current}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {SPECIES.filter(s => s !== 'Otro').map(s => (
          <button key={s} onClick={() => save(s)} disabled={saving} style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            background: current === s ? 'var(--red-bg)' : '#0d0d0d',
            color: current === s ? 'var(--red)' : 'var(--text-2)',
            border: `1px solid ${current === s ? 'var(--red-dim)' : 'var(--border)'}`,
          }}>{s}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          placeholder="Otro producto..."
          style={{
            flex: 1, background: '#080808', border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text)', fontSize: 11, padding: '5px 10px', outline: 'none',
          }}
        />
        <button onClick={() => { save(custom); setCustom(''); }} disabled={saving || !custom.trim()} style={{
          padding: '5px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          background: 'var(--red)', color: '#fff', border: 'none',
          opacity: !custom.trim() ? 0.4 : 1,
        }}>Guardar</button>
      </div>
    </div>
  );
}
