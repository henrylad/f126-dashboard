import { useEffect, useRef, useState } from 'react';
import type { ServerMessage, Snapshot } from './types.ts';
import { LapView } from '../laps/lapView.ts';

export function useTelemetry() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const store = useRef(new LapView()).current;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        const msg: ServerMessage = JSON.parse(e.data);
        if (msg.type === 'history') {
          store.loadHistory(msg.laps);
          return;
        }
        store.applyDelta(msg.laps);
        setSnap(msg.snapshot);
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
