import { useState, useEffect } from 'react';
import type { HistoryPoint } from '../types';

const API = 'http://localhost:8000';

export type HistoryRange = '30m' | '1h' | '6h' | '24h';

export function useSensorHistory(sensorId: string | null, range: HistoryRange) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sensorId) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/sensors/${sensorId}/history?range=${range}`)
      .then((r) => r.json())
      .then((d: HistoryPoint[]) => { setData(d); setLoading(false); })
      .catch(() => { setError('Error al cargar historial'); setLoading(false); });
  }, [sensorId, range]);

  return { data, loading, error };
}
