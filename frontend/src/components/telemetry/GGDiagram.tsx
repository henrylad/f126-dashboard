import { useEffect, useRef, useState } from 'react';
import { C, observeSize } from '../../lib/chart.ts';
import type { TelemetryHistory } from './history.ts';

const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const SANS = '"Geist Variable", system-ui, sans-serif';
const TRAIL_S = 4;

/**
 * Friction circle: lateral against longitudinal g over the last few seconds.
 * Right of centre is a left-hand load (game sign kept), up is acceleration.
 */
export function GGDiagram({ history, end }: { history: TelemetryHistory; end: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => observeSize(canvas.current!, setSize), []);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    const w = size.w, h = size.h;
    el.width = w * dpr;
    el.height = h * dpr;
    const g = el.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const all = history.samples;
    let i0 = all.length;
    while (i0 > 0 && all[i0 - 1].t > end - TRAIL_S) i0--;
    const trail = all.slice(i0).filter((s) => s.t <= end);
    let peak = 2;
    for (const s of trail) peak = Math.max(peak, Math.abs(s.gLat), Math.abs(s.gLon));
    const rings = Math.min(6, Math.ceil(peak));

    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 18;
    const k = r / rings;

    g.strokeStyle = C.grid;
    g.lineWidth = 1;
    g.font = `500 11px ${MONO}`;
    g.fillStyle = C.axis;
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    for (let i = 1; i <= rings; i++) {
      g.beginPath(); g.arc(cx, cy, i * k, 0, Math.PI * 2); g.stroke();
      g.fillText(`${i}g`, cx + i * k * 0.707 + 2, cy - i * k * 0.707);
    }
    g.strokeStyle = C.zero;
    g.beginPath();
    g.moveTo(cx - r, Math.round(cy) + 0.5); g.lineTo(cx + r, Math.round(cy) + 0.5);
    g.moveTo(Math.round(cx) + 0.5, cy - r); g.lineTo(Math.round(cx) + 0.5, cy + r);
    g.stroke();

    g.font = `500 11px ${SANS}`;
    g.fillStyle = C.label;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText('Accel', cx, 2);
    g.textBaseline = 'bottom';
    g.fillText('Brake', cx, h - 2);

    // Trail, fading with age.
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      g.globalAlpha = 0.1 + 0.6 * (1 - (end - b.t) / TRAIL_S);
      g.strokeStyle = C.ref;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx + a.gLat * k, cy - a.gLon * k);
      g.lineTo(cx + b.gLat * k, cy - b.gLon * k);
      g.stroke();
    }
    g.globalAlpha = 1;
    const now = trail.at(-1);
    if (now) {
      g.fillStyle = C.bg;
      g.beginPath(); g.arc(cx + now.gLat * k, cy - now.gLon * k, 6.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.deltaLine;
      g.beginPath(); g.arc(cx + now.gLat * k, cy - now.gLon * k, 4.5, 0, Math.PI * 2); g.fill();
    }
  });

  return (
    <div className="gg">
      <canvas ref={canvas} role="img" aria-label={`G-G diagram of the last ${TRAIL_S} seconds`} />
    </div>
  );
}
