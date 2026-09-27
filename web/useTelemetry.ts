import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../shared/types.ts';
import { LapStore, type LapHistory } from '../shared/store.ts';

export function useTelemetry() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const store = useRef(new LapStore()).current;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const msg: Snapshot | LapHistory = JSON.parse(e.data);
        if ('type' in msg) {
          store.loadHistory(msg);
          return;
        }
        store.update(msg);
        setSnap(msg);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [store]);

  return { snap, store, connected };
}
