// Entry point: UDP listener (or simulator / replay) → state → WebSocket.
//
//   npm run dev                      live game telemetry on UDP 20777
//   npm run sim                      synthetic race, no game needed
//   npm run dev -- --record s.f1rec  also save raw packets for later
//   npm run dev -- --replay s.f1rec  play a recording back (loops)
import dgram from 'node:dgram';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { TelemetryState } from './state.ts';
import { RaceSim } from './sim.ts';
import { LapStore } from '../shared/store.ts';
import type { Source } from '../shared/types.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const UDP_PORT = Number(opt('udp-port', '20777'));
const HTTP_PORT = Number(opt('port', '5173'));
const HOST = opt('host', '0.0.0.0');
const BROADCAST_HZ = 30;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const replayFile = args.includes('--replay') ? opt('replay', '') : '';
const recordFile = args.includes('--record') ? opt('record', '') : '';
const source: Source = flag('sim') ? 'sim' : replayFile ? 'replay' : 'udp';
const state = new TelemetryState(source);

// --- recording: [f64 ms since start][u32 length][bytes] per packet ---
let recorder: fs.WriteStream | null = null;
const recordStart = Date.now();
if (recordFile) {
  recorder = fs.createWriteStream(recordFile);
  console.log(`● Recording raw packets to ${recordFile}`);
}
function onPacket(buf: Uint8Array) {
  state.ingest(buf);
  if (recorder) {
    const head = Buffer.alloc(12);
    head.writeDoubleLE(Date.now() - recordStart, 0);
    head.writeUInt32LE(buf.byteLength, 8);
    recorder.write(head);
    recorder.write(buf);
  }
}

// --- packet source ---
if (source === 'sim') {
  new RaceSim(onPacket).start();
  console.log('▶ Simulator running (packetFormat 2026)');
} else if (source === 'replay') {
  startReplay(replayFile);
} else {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', (msg) => onPacket(msg));
  sock.on('error', (err) => {
    console.error(`UDP error: ${err.message}`);
    process.exit(1);
  });
  sock.bind(UDP_PORT, HOST, () => console.log(`▶ Listening for F1 telemetry on UDP ${HOST}:${UDP_PORT}`));
}

function startReplay(file: string) {
  const data = fs.readFileSync(file);
  const packets: { at: number; buf: Uint8Array }[] = [];
  for (let o = 0; o + 12 <= data.length;) {
    const at = data.readDoubleLE(o);
    const len = data.readUInt32LE(o + 8);
    packets.push({ at, buf: data.subarray(o + 12, o + 12 + len) });
    o += 12 + len;
  }
  if (!packets.length) throw new Error(`No packets in ${file}`);
  console.log(`▶ Replaying ${packets.length} packets from ${file}`);
  let i = 0;
  let t0 = Date.now();
  setInterval(() => {
    const elapsed = Date.now() - t0;
    while (i < packets.length && packets[i].at <= elapsed) state.ingest(packets[i++].buf);
    if (i >= packets.length) { i = 0; t0 = Date.now(); }
  }, 5);
}

// --- HTTP + WebSocket ---
const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });
const laps = new LapStore();
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
// Late joiners get the traces and track outline recorded so far.
wss.on('connection', (ws) => ws.send(JSON.stringify(laps.toHistory())));

setInterval(() => {
  const snap = state.snapshot();
  laps.update(snap);
  if (wss.clients.size === 0) return;
  const msg = JSON.stringify(snap);
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}, 1000 / BROADCAST_HZ);

if (flag('dev')) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  server.on('request', vite.middlewares);
} else {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist)) {
    console.error('No build found — run `npm run build` first, or use `npm run dev`.');
    process.exit(1);
  }
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server.on('request', (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(dist, path.normalize(url));
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

server.listen(HTTP_PORT, HOST, () => console.log(`▶ Dashboard on http://localhost:${HTTP_PORT}`));
