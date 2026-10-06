import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the .NET server (backend/, default :5080) does the telemetry and
// this serves the dashboard, proxying the WebSocket to it. Override with PITWALL_API.
const api = process.env.PITWALL_API ?? 'http://localhost:5080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/ws': { target: api.replace(/^http/, 'ws'), ws: true } },
  },
  build: { outDir: 'dist' },
});
