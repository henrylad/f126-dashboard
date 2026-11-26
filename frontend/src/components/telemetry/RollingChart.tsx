import { useEffect, useRef, useState } from 'react';
import { ERS_MAX_J } from '../../api/types.ts';
import { C, beginFrame, clipped, drawPanelLabel, layoutPanels, observeSize, type Frame, type Panel } from '../../lib/chart.ts';
import { ENERGY, ERS_MODES } from '../../lib/meta.ts';
import { interpolate, type Sample } from '../../laps/lapMath.ts';
import type { TelemetryHistory, TSample } from './history.ts';

const SANS = '"Geist Variable", system-ui, sans-serif';
const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const INK = '#d0d7de';
const MUTED = '#9aa4b0';
const HARVEST = ENERGY[0].colour;
/** Deploy colour by ERS mode: None and Medium share the first step of the ramp. */
const DEPLOY = [ENERGY[1].colour, ENERGY[1].colour, ENERGY[2].colour, ENERGY[3].colour];

type Get = (s: TSample) => number | null;
/** `ref` names the best-lap channel drawn dashed under this line at the same lap distance. */
interface Line { get: Get; colour: string; label: string; fill?: boolean; step?: boolean; width?: number; ref?: keyof Sample }

export interface ChannelDef {
  key: string;
  label: string;
  /** Plot height in px. */
  h: number;
  /** Fixed [lo, hi], or a function of the visible samples. */
  range: [number, number] | ((vis: TSample[]) => [number, number]);
  ticks: (lo: number, hi: number) => number[];
  fmt: (v: number) => string;
  lines: Line[];
  /** Signed battery flow, drawn as deploy/harvest blocks. */
  flow?: boolean;
  chassis?: boolean;
}

const sym = (min: number, get: (s: TSample) => number | null) => (vis: TSample[]): [number, number] => {
  let m = min;
  for (const s of vis) { const v = get(s); if (v !== null) m = Math.max(m, Math.abs(v)); }
  const step = m <= 2 ? 0.5 : m <= 10 ? 1 : m <= 50 ? 5 : m <= 200 ? 50 : 100;
  const r = Math.ceil((m * 1.05) / step) * step;
  return [-r, r];
};
const upTo = (min: number, ...gets: Get[]) => (vis: TSample[]): [number, number] => {
  let m = min;
  for (const s of vis) for (const get of gets) { const v = get(s); if (v !== null) m = Math.max(m, v); }
  const step = m <= 100 ? 10 : m <= 1000 ? 100 : 1000;
  return [0, Math.ceil((m * 1.05) / step) * step];
};
const ends = (lo: number, hi: number) => [lo, hi];
const withZero = (lo: number, hi: number) => [lo, 0, hi];
const pct = (v: number) => `${Math.round(v * 100)}`;

export const CHANNEL_DEFS: ChannelDef[] = [
  { key: 'speed', label: 'Speed km/h', h: 92, range: [0, 360], ticks: () => [0, 100, 200, 300], fmt: String,
    lines: [{ get: (s) => s.speed, colour: C.current, label: 'Speed', ref: 'speed' }] },
  { key: 'pedals', label: 'Throttle / brake %', h: 64, range: [0, 1], ticks: ends, fmt: pct,
    lines: [
      { get: (s) => s.throttle, colour: C.throttle, label: 'Throttle', fill: true, ref: 'throttle' },
      { get: (s) => s.brake, colour: C.brake, label: 'Brake', fill: true, ref: 'brake' },
    ] },
  { key: 'steer', label: 'Steering % · left below zero', h: 56, range: [-1, 1], ticks: withZero, fmt: pct,
    lines: [{ get: (s) => s.steer, colour: INK, label: 'Steering' }] },
  { key: 'gear', label: 'Gear', h: 48, range: [0, 8], ticks: () => [1, 8], fmt: String,
    lines: [{ get: (s) => s.gear, colour: INK, label: 'Gear', step: true, ref: 'gear' }] },
  { key: 'rpm', label: 'RPM', h: 56, range: upTo(10_000, (s) => s.rpm), ticks: ends, fmt: (v) => (v ? `${Math.round(v / 1000)}k` : '0'),
    lines: [{ get: (s) => s.rpm, colour: INK, label: 'RPM', width: 1.5 }] },
  { key: 'battery', label: 'Battery (ERS store) %', h: 60, range: [0, ERS_MAX_J], ticks: (lo, hi) => [lo, hi / 2, hi], fmt: (v) => `${Math.round((v / ERS_MAX_J) * 100)}`,
    lines: [{ get: (s) => s.ers, colour: C.battery, label: 'Battery', fill: true, ref: 'ers' }] },
  { key: 'flow', label: 'Battery flow kW · deploy above zero, harvest below', h: 84, range: sym(100, (s) => s.flowKw), ticks: withZero, fmt: String, flow: true,
    lines: [{ get: (s) => s.flowKw, colour: INK, label: 'Flow' }] },
  { key: 'power', label: 'ICE / MGU-K power kW', h: 64, range: upTo(100, (s) => s.iceKw, (s) => s.mgukKw), ticks: ends, fmt: String,
    lines: [
      { get: (s) => s.iceKw, colour: INK, label: 'ICE', width: 1.5 },
      { get: (s) => s.mgukKw, colour: DEPLOY[2], label: 'MGU-K', width: 1.5 },
    ] },
  { key: 'gLat', label: 'G lateral', h: 56, range: sym(2, (s) => s.gLat), ticks: withZero, fmt: String,
    lines: [{ get: (s) => s.gLat, colour: INK, label: 'G lat' }] },
  { key: 'gLon', label: 'G longitudinal · braking below zero', h: 56, range: sym(2, (s) => s.gLon), ticks: withZero, fmt: String,
    lines: [{ get: (s) => s.gLon, colour: INK, label: 'G lon' }] },
  { key: 'ride', label: 'Ride height mm · front / rear', h: 60, chassis: true, range: upTo(40, (s) => s.frontMm, (s) => s.rearMm), ticks: ends, fmt: String,
    lines: [
      { get: (s) => s.frontMm, colour: INK, label: 'Front' },
      { get: (s) => s.rearMm, colour: MUTED, label: 'Rear', width: 1.25 },
    ] },
  { key: 'slip', label: 'Wheel slip % · front / rear', h: 60, chassis: true, range: sym(5, (s) => Math.max(Math.abs(s.slipFront ?? 0), Math.abs(s.slipRear ?? 0))), ticks: withZero, fmt: String,
    lines: [
      { get: (s) => s.slipFront, colour: INK, label: 'Front' },
      { get: (s) => s.slipRear, colour: MUTED, label: 'Rear', width: 1.25 },
    ] },
];

const MARGIN = { l: 56, r: 12, t: 4, b: 22 };
const GAP = 14;

function hLine(f: Frame, y: number, colour: string) {
  const { g } = f;
  g.strokeStyle = colour;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(f.margin.l, Math.round(y) + 0.5);
  g.lineTo(f.margin.l + f.plotW, Math.round(y) + 0.5);
  g.stroke();
}

function yLabel(f: Frame, y: number, text: string) {
  const { g } = f;
  g.save();
  g.font = `500 11px ${MONO}`;
  g.fillStyle = C.label;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText(text, f.margin.l - 6, y);
  g.restore();
}

/** Every nth sample so a long window still draws about two points per pixel. */
function thin(vis: TSample[], plotW: number): TSample[] {
  const stride = Math.max(1, Math.floor(vis.length / Math.max(1, plotW * 2)));
  if (stride === 1) return vis;
  const out: TSample[] = [];
  for (let i = 0; i < vis.length; i += stride) out.push(vis[i]);
  if (out.at(-1) !== vis.at(-1)) out.push(vis.at(-1)!);
  return out;
}

/** The best lap's value where the car was at this sample, or null off the lap. */
function refAt(ref: Sample[] | null, s: TSample, key: keyof Sample): number | null {
  return ref && s.d >= 0 ? interpolate(ref, s.d, key) : null;
}

export function RollingChart({ history, windowS, end, channels, refLap }: {
  history: TelemetryHistory;
  windowS: number;
  /** Session time at the right edge. */
  end: number;
  channels: ChannelDef[];
  /** Best-lap samples to draw dashed under the live lines, matched by lap distance. */
  refLap: Sample[] | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverT, setHoverT] = useState<number | null>(null);
  useEffect(() => observeSize(canvas.current!, setSize), []);

  const start = end - windowS;
  const height = MARGIN.t + MARGIN.b + channels.reduce((a, c) => a + c.h, 0) + GAP * Math.max(0, channels.length - 1);
  const plotW = size.w - MARGIN.l - MARGIN.r;

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w) return;
    const f = beginFrame(el, size.w, height, windowS, MARGIN, { from: start, to: end });
    const { g, xOf } = f;
    const total = channels.reduce((a, c) => a + c.h, 0) || 1;
    const { panels, bottom } = layoutPanels(channels.map((c) => [c.key, c.label, c.h / total] as [string, string, number]), MARGIN.t, height - MARGIN.t - MARGIN.b, GAP);
    const all = history.samples;
    let i0 = 0;
    while (i0 < all.length && all[i0].t < start) i0++;
    const vis = thin(all.slice(Math.max(0, i0 - 1)).filter((s) => s.t <= end), plotW);

    panels.forEach((p: Panel, k) => {
      const ch = channels[k];
      const [lo, hi] = typeof ch.range === 'function' ? ch.range(vis) : ch.range;
      const yOf = (v: number) => p.top + p.h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1)) * p.h;
      for (const t of ch.ticks(lo, hi)) {
        hLine(f, yOf(t), t === 0 && lo < 0 ? C.zero : C.grid);
        yLabel(f, yOf(t), ch.fmt(t));
      }
      clipped(f, p.top - 1, p.top + p.h + 1, () => {
        if (ch.flow) {
          // Each sample is a block from zero: blue when harvesting, the deploy ramp by mode.
          const zero = yOf(0);
          for (let j = 1; j < vis.length; j++) {
            const a = vis[j - 1], b = vis[j];
            const v = b.flowKw;
            if (Math.abs(v) < 2) continue;
            g.fillStyle = v < 0 ? HARVEST : DEPLOY[b.mode] ?? DEPLOY[1];
            const x0 = xOf(a.t), x1 = xOf(b.t);
            const y = yOf(v);
            g.fillRect(x0, Math.min(y, zero), Math.max(1, x1 - x0 + 0.5), Math.abs(zero - y));
          }
          return;
        }
        // Best lap first, so the live line sits on top.
        for (const line of ch.lines) {
          if (!line.ref || !refLap) continue;
          const path = new Path2D();
          let started = false, prevY = 0;
          for (const s of vis) {
            const v = refAt(refLap, s, line.ref);
            if (v === null) { started = false; continue; }
            const x = xOf(s.t), y = yOf(v);
            if (!started) { path.moveTo(x, y); started = true; }
            else { if (line.step) path.lineTo(x, prevY); path.lineTo(x, y); }
            prevY = y;
          }
          g.setLineDash([6, 4]);
          g.strokeStyle = C.ref;
          g.lineWidth = 1.5;
          g.stroke(path);
          g.setLineDash([]);
        }
        for (const line of ch.lines) {
          const path = new Path2D();
          let started = false, prevY = 0, firstX = 0, lastX = 0;
          for (const s of vis) {
            const v = line.get(s);
            if (v === null) { started = false; continue; }
            const x = xOf(s.t), y = yOf(v);
            if (!started) { path.moveTo(x, y); started = true; firstX = x; }
            else { if (line.step) path.lineTo(x, prevY); path.lineTo(x, y); }
            prevY = y; lastX = x;
          }
          g.lineJoin = 'round';
          g.strokeStyle = line.colour;
          g.lineWidth = line.width ?? 1.75;
          g.stroke(path);
          if (line.fill && started) {
            const area = new Path2D(path);
            area.lineTo(lastX, yOf(Math.max(lo, 0)));
            area.lineTo(firstX, yOf(Math.max(lo, 0)));
            area.closePath();
            g.globalAlpha = 0.14;
            g.fillStyle = line.colour;
            g.fill(area);
            g.globalAlpha = 1;
          }
        }
      });
      drawPanelLabel(f, p);
    });

    // Time axis: seconds before the right edge.
    g.save();
    g.font = `500 11px ${MONO}`;
    g.fillStyle = C.label;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    const step = windowS <= 10 ? 2 : windowS <= 30 ? 5 : windowS <= 60 ? 10 : 20;
    for (let s = 0; s <= windowS; s += step) {
      const x = xOf(end - s);
      g.strokeStyle = C.grid;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, MARGIN.t); g.lineTo(Math.round(x) + 0.5, bottom); g.stroke();
      g.textAlign = s === 0 ? 'right' : 'center';
      g.fillText(s === 0 ? 'now' : `−${s} s`, s === 0 ? x : x, bottom + 6);
    }
    g.restore();

    if (hoverT !== null && hoverT >= start && hoverT <= end) {
      const x = Math.round(xOf(hoverT)) + 0.5;
      g.strokeStyle = C.cursor;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, MARGIN.t); g.lineTo(x, bottom); g.stroke();
    }
    if (vis.length < 2) {
      g.save();
      g.font = `500 13px ${SANS}`;
      g.fillStyle = C.label;
      g.textAlign = 'center';
      g.fillText('Collecting telemetry…', MARGIN.l + plotW / 2, MARGIN.t + 40);
      g.restore();
    }
  });

  const onMove = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const t = start + ((e.clientX - rect.left - MARGIN.l) / plotW) * windowS;
    setHoverT(t >= start && t <= end ? t : null);
  };

  const at = hoverT === null ? null : history.at(hoverT);
  return (
    <>
      <div className="rolling-canvas" style={{ height }} onPointerMove={onMove} onPointerLeave={() => setHoverT(null)}>
        <canvas ref={canvas} role="img" aria-label={`Telemetry over the last ${windowS} seconds: ${channels.map((c) => c.label).join(', ')}`} />
      </div>
      <div className="readout" aria-live="off">
        {at ? (
          <>
            <span className="readout-d num">−{(end - at.t).toFixed(1)} s</span>
            {channels.flatMap((ch) => ch.flow
              ? [<span key="flow" className="readout-lap">
                  <i className="sw" style={{ background: at.flowKw < 0 ? HARVEST : DEPLOY[at.mode] }} />
                  {at.flowKw < 0 ? 'Harvest' : `Deploy · ${ERS_MODES[at.mode] ?? '—'}`} <span className="num">{Math.abs(Math.round(at.flowKw))} kW</span>
                </span>]
              : ch.lines.map((l) => {
                  const v = l.get(at);
                  const r = l.ref ? refAt(refLap, at, l.ref) : null;
                  return (
                    <span key={`${ch.key}-${l.label}`} className="readout-lap">
                      <i className="sw" style={{ background: l.colour }} />{l.label} <span className="num">{v === null ? '—' : fmtValue(ch.key, v)}</span>
                      {r !== null && <small>best <span className="num">{fmtValue(ch.key, r)}</span></small>}
                    </span>
                  );
                }))}
          </>
        ) : (
          <span className="tool-hint readout-hint">Point at the chart to read every channel at that moment.</span>
        )}
      </div>
    </>
  );
}

function fmtValue(key: string, v: number): string {
  switch (key) {
    case 'speed': return `${Math.round(v)} km/h`;
    case 'pedals': case 'steer': return `${Math.round(v * 100)}%`;
    case 'gear': return v === 0 ? 'N' : v < 0 ? 'R' : String(Math.round(v));
    case 'rpm': return Math.round(v).toLocaleString('en-US');
    case 'battery': return `${((v / ERS_MAX_J) * 100).toFixed(1)}% · ${(v / 1e6).toFixed(2)} MJ`;
    case 'power': return `${Math.round(v)} kW`;
    case 'gLat': case 'gLon': return `${v.toFixed(2)} g`;
    case 'ride': return `${v.toFixed(1)} mm`;
    case 'slip': return `${v.toFixed(1)}%`;
    default: return String(v);
  }
}
