import { useEffect, useRef, useState, useCallback } from 'react';
import type { SensorReading } from '../types';

const WS_URL = 'ws://localhost:8000/ws';

export function useWebSocket(onMessage: (reading: SensorReading) => void) {
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      retryDelay.current = 1000;
    };

    socket.onmessage = (event) => {
      try {
        const data: SensorReading = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      setConnected(false);
      if (!unmounted.current) {
        setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
      }
    };
  }, [onMessage]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      ws.current?.close();
    };
  }, [connect]);

  return { connected };
}
