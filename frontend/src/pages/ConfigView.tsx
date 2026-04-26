import { useState } from 'react';
import type { SensorMeta } from '../types';

const API = 'http://localhost:8000';
const ACCESS_PIN = '1234'; // reemplazar con auth real cuando se implemente

interface EditState {
  name: string;
  min_val: string;
  max_val: string;
  location: string;
}

interface Props {
  sensors: SensorMeta[];
  onSensorsUpdated: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  temperature: 'Temperatura', humidity: 'Humedad', pressure: 'Presión',
  rpm: 'RPM', weight: 'Peso', level: 'Nivel', flow: 'Caudal', production: 'Producción',
};

export default function ConfigView({ sensors, onSensorsUpdated }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editState, setEditState]   = useState<EditState | null>(null);
  const [saving, setSaving]         = useState(false);
  const [savedId, setSavedId]       = useState<string | null>(null);
  const [saveError, setSaveError]   = useState<string | null>(null);

  function handleUnlock() {
    if (pin === ACCESS_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  }

  function startEdit(s: SensorMeta) {
    setEditingId(s.id);
    setSaveError(null);
    setEditState({
      name:     s.name,
      min_val:  String(s.min_val),
      max_val:  String(s.max_val),
      location: s.location,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setSaveError(null);
  }

  function fieldError(): string | null {
    if (!editState) return null;
    const min = parseFloat(editState.min_val);
    const max = parseFloat(editState.max_val);
    if (isNaN(min) || isNaN(max)) return 'Los límites deben ser números válidos';
    if (min >= max) return 'El mínimo debe ser menor que el máximo';
    if (!editState.name.trim()) return 'El nombre no puede estar vacío';
    return null;
  }

  async function saveEdit() {
    if (!editState || !editingId) return;
    const err = fieldError();
    if (err) { setSaveError(err); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API}/sensors/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     editState.name.trim(),
          min_val:  parseFloat(editState.min_val),
          max_val:  parseFloat(editState.max_val),
          location: editState.location.trim(),
        }),
      });
      if (!res.ok) throw new Error('Error del servidor');
      setSavedId(editingId);
      setTimeout(() => setSavedId(null), 2000);
      setEditingId(null);
      setEditState(null);
      onSensorsUpdated();
    } catch {
      setSaveError('No se pudo guardar. Verificá que el backend esté corriendo.');
    } finally {
      setSaving(false);
    }
  }

  // ── PIN screen ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚙</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Configuración</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Ingresá el PIN para acceder</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value); setPinError(false); }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="PIN"
            maxLength={8}
            autoFocus
            style={{
              background: '#111', border: `1px solid ${pinError ? 'var(--red)' : 'var(--border)'}`,
              color: 'var(--text)', borderRadius: 6, padding: '10px 16px',
              fontSize: 18, letterSpacing: 8, textAlign: 'center', width: 160, outline: 'none',
            }}
          />
          {pinError && (
            <div style={{ fontSize: 11, color: 'var(--red)' }}>PIN incorrecto</div>
          )}
          <button
            onClick={handleUnlock}
            style={{
              background: 'var(--red)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 28px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            Ingresar
          </button>
        </div>

        <div style={{ fontSize: 10, color: '#333', marginTop: 8 }}>
          PIN por defecto: 1234 — cambiar en ConfigView.tsx antes de producción
        </div>
      </div>
    );
  }

  // ── Config table ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>
            Parámetros de sensores
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            Editá nombre, límites y ubicación. Los cambios afectan alertas y visualización en tiempo real.
          </div>
        </div>
        <button
          onClick={() => setUnlocked(false)}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-3)', borderRadius: 6, padding: '5px 12px',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 110px 200px 140px 110px',
          padding: '9px 16px', background: '#0a0a0a',
          borderBottom: '1px solid var(--border)',
          fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
          color: 'var(--text-3)', fontWeight: 600,
        }}>
          <span>Nombre</span>
          <span>Tipo</span>
          <span>Límites (min / máx)</span>
          <span>Ubicación</span>
          <span />
        </div>

        {sensors.map((s, i) => {
          const isEditing = editingId === s.id;
          const wasSaved  = savedId === s.id;

          return (
            <div
              key={s.id}
              style={{
                borderBottom: i < sensors.length - 1 ? '1px solid var(--border)' : 'none',
                background: isEditing ? '#0d0d10' : wasSaved ? '#060d06' : 'var(--surface)',
                transition: 'background 0.3s',
              }}
            >
              {isEditing && editState ? (
                /* ── Edit row ── */
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 200px 140px', gap: 12, alignItems: 'end' }}>
                    {/* Name */}
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-3)', display: 'block', marginBottom: 4, letterSpacing: 1 }}>NOMBRE</label>
                      <input
                        value={editState.name}
                        onChange={e => setEditState({ ...editState, name: e.target.value })}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>

                    {/* Type (read-only) */}
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-3)', display: 'block', marginBottom: 4, letterSpacing: 1 }}>TIPO</label>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', padding: '7px 0' }}>
                        {TYPE_LABEL[s.sensor_type] ?? s.sensor_type}
                      </div>
                    </div>

                    {/* Min / Max */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 9, color: 'var(--text-3)', display: 'block', marginBottom: 4, letterSpacing: 1 }}>MÍNIMO</label>
                        <input
                          value={editState.min_val}
                          onChange={e => setEditState({ ...editState, min_val: e.target.value })}
                          style={inputStyle}
                          type="number"
                          step="any"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 9, color: 'var(--text-3)', display: 'block', marginBottom: 4, letterSpacing: 1 }}>MÁXIMO</label>
                        <input
                          value={editState.max_val}
                          onChange={e => setEditState({ ...editState, max_val: e.target.value })}
                          style={inputStyle}
                          type="number"
                          step="any"
                        />
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <label style={{ fontSize: 9, color: 'var(--text-3)', display: 'block', marginBottom: 4, letterSpacing: 1 }}>UBICACIÓN</label>
                      <input
                        value={editState.location}
                        onChange={e => setEditState({ ...editState, location: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={saveEdit} disabled={saving} style={btnPrimary}>
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    <button onClick={cancelEdit} disabled={saving} style={btnSecondary}>
                      Cancelar
                    </button>
                    {saveError && (
                      <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ {saveError}</span>
                    )}
                    {fieldError() && (
                      <span style={{ fontSize: 11, color: 'var(--yellow)' }}>{fieldError()}</span>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Read row ── */
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 110px 200px 140px 110px',
                  padding: '12px 16px', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.name}
                      {wasSaved && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>✓ Guardado</span>}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{s.id}</div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {TYPE_LABEL[s.sensor_type] ?? s.sensor_type}
                    {s.is_production_line && (
                      <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--red)', fontWeight: 700 }}>PROD</span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: 'var(--text-3)' }}>{s.min_val}</span>
                    <span style={{ color: '#333', margin: '0 8px' }}>—</span>
                    <span style={{ color: 'var(--text-3)' }}>{s.max_val}</span>
                    <span style={{ color: '#444', marginLeft: 4, fontSize: 10 }}>{s.unit}</span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.location}</div>

                  <div>
                    <button
                      onClick={() => startEdit(s)}
                      style={btnSecondary}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#333', textAlign: 'right' }}>
        Los cambios de límites afectan las alertas inmediatamente en el próximo ciclo del simulador.
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 4, padding: '7px 10px',
  fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--red)', color: '#fff', border: 'none',
  borderRadius: 5, padding: '6px 16px', fontSize: 11,
  fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3,
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)',
  color: 'var(--text-2)', borderRadius: 5, padding: '5px 14px',
  fontSize: 11, cursor: 'pointer',
};
