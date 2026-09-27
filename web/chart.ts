// Shared canvas drawing for lap charts: channel panels (speed, throttle, …) and
// delta panels, all on one lap-distance axis. Used by the live trace and the
// lap comparison.
import { ERS_MAX_J, type Zone } from '../shared/types.ts';
import type { Sample } from '../shared/store.ts';
import { delta as fmtDelta } from './format.ts';

export const C = {
  current: '#ffc906',
  ref: '#8d98c7',
  throttle: '#6e8bff',
  brake: '#ff3355',
  gear: '#c9d1ea',
  battery: '#35c4e0',
  faster: '#2fd27a',
  slower: '#ff3355',
  deltaLine: '#eef1fa',
  zero: 'rgba(141, 152, 199, 0.55)',
  grid: 'rgba(141, 152, 199, 0.12)',
  axis: '#58638f',
  label: '#8d98c7',
  aero: 'rgba(255, 201, 6, 0.045)',
  aeroEdge: '#ffc906',
  cursor: 'rgba(238, 241, 250, 0.6)',
};

/** Fixed-order colours for compared laps (validated for colour-blind separation). */
export const LAP_COLOURS = ['#FFC906', '#6E8BFF', '#FF4D6D', '#2DD4BF', '#FB923C', '#C084FC'];

export type Channel = 'speed' | 'throttle' | 'brake' | 'gear' | 'ers';

export const CHANNELS: Record<Channel, { label: string; max: number; ticks: number[]; fmt: (v: number) => string; colour: string; fill: boolean; step?: boolean }> = {
  speed: { label: 'Speed km/h', max: 360, ticks: [0, 100, 200, 300], fmt: String, colour: C.current, fill: false },
  throttle: { label: 'Throttle %', max: 1, ticks: [0, 1], fmt: (v) => `${v * 100}`, colour: C.throttle, fill: true },
  brake: { label: 'Brake %', max: 1, ticks: [0, 1], fmt: (v) => `${v * 100}`, colour: C.brake, fill: true },
  gear: { label: 'Gear', max: 8, ticks: [2, 4, 6, 8], fmt: String, colour: C.gear, fill: false, step: true },
  ers: { label: 'Battery (ERS store) %', max: ERS_MAX_J, ticks: [0, ERS_MAX_J / 2, ERS_MAX_J], fmt: (v) => `${Math.round((v / ERS_MAX_J) * 100)}`, colour: C.battery, fill: true },
};

export interface Panel<K extends string = string> { key: K; label: string; top: number; h: number }

export interface Frame {
  g: CanvasRenderingContext2D;
  width: number;
  height: number;
  margin: { l: number; r: number; t: number; b: number };
  plotW: number;
  len: number;
  xOf: (d: number) => number;
}

export const PANEL_GAP = 18;

/** Stacks panels by share of the available height. */
export function layoutPanels<K extends string>(shares: [K, string, number][], top: number, available: number): { panels: Panel<K>[]; bottom: number } {
  const plotH = available - PANEL_GAP * (shares.length - 1);
  const panels: Panel<K>[] = [];
  let y = top;
  for (const [key, label, share] of shares) {
    panels.push({ key, label, top: y, h: plotH * share });
    y += plotH * share + PANEL_GAP;
  }
  return { panels, bottom: y - PANEL_GAP };
}

/** Sizes the canvas for the device pixel ratio and returns a cleared frame. */
export function beginFrame(el: HTMLCanvasElement, width: number, height: number, len: number, margin: Frame['margin']): Frame {
  const dpr = window.devicePixelRatio || 1;
  el.width = width * dpr;
  el.height = height * dpr;
  const g = el.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);
  g.font = '600 10px "Titillium Web", sans-serif';
  const plotW = width - margin.l - margin.r;
  return { g, width, height, margin, plotW, len, xOf: (d) => margin.l + (d / len) * plotW };
}

export function drawPanelLabel(f: Frame, p: Panel) {
  const { g } = f;
  g.save();
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = C.label;
  g.fillText(p.label.toUpperCase(), f.margin.l + 6, p.top + 2);
  g.restore();
}

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
  g.fillStyle = C.label;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.fillText(text, f.margin.l - 6, y);
}

/** Grid + y labels for a channel panel; returns the value → y mapping. */
export function drawChannelGrid(f: Frame, p: Panel<Channel>) {
  const ch = CHANNELS[p.key];
  const yOf = (v: number) => p.top + p.h - (v / ch.max) * p.h;
  for (const t of ch.ticks) {
    hLine(f, yOf(t), C.grid);
    yLabel(f, yOf(t), ch.fmt(t));
  }
  return yOf;
}

export function drawSeries(
  f: Frame, p: Panel<Channel>, samples: Sample[], colour: string,
  opts: { dashed?: boolean; fill?: boolean; width?: number } = {},
) {
  if (samples.length < 2) return;
  const { g, xOf } = f;
  const ch = CHANNELS[p.key];
  const yOf = (v: number) => p.top + p.h - (v / ch.max) * p.h;
  g.beginPath();
  samples.forEach((sm, i) => {
    const x = xOf(sm.d), y = yOf(sm[p.key] ?? 0);
    if (!i) g.moveTo(x, y);
    else {
      // Gears change in steps, not ramps.
      if (ch.step) g.lineTo(x, yOf(samples[i - 1][p.key] ?? 0));
      g.lineTo(x, y);
    }
  });
  g.setLineDash(opts.dashed ? [5, 4] : []);
  g.strokeStyle = colour;
  g.lineWidth = opts.width ?? 2;
  g.lineJoin = 'round';
  g.stroke();
  g.setLineDash([]);
  if (opts.fill) {
    g.lineTo(xOf(samples[samples.length - 1].d), yOf(0));
    g.lineTo(xOf(samples[0].d), yOf(0));
    g.closePath();
    g.globalAlpha = 0.14;
    g.fillStyle = colour;
    g.fill();
    g.globalAlpha = 1;
  }
}

export type DeltaPoint = { d: number; ms: number };

/** Symmetric delta range in 0.5 s steps, at least ±0.5 s, at most ±5 s. */
export function deltaRange(series: DeltaPoint[][]): number {
  let max = 0;
  for (const s of series) for (const p of s) max = Math.max(max, Math.abs(p.ms));
  return Math.min(5000, Math.max(500, Math.ceil(max / 500) * 500));
}

/**
 * Delta panel. Above zero = slower. A single series gets red/green fill;
 * several series are drawn as plain lines in their own colours.
 */
export function drawDeltaPanel(f: Frame, p: Panel, series: { pts: DeltaPoint[]; colour: string; dashed?: boolean }[], range: number, emptyText?: string) {
  const { g, xOf, margin, plotW } = f;
  const mid = p.top + p.h / 2;
  const yOf = (ms: number) => mid - (Math.max(-range, Math.min(range, ms)) / range) * (p.h / 2);
  for (const v of [range, -range]) {
    hLine(f, yOf(v), C.grid);
    yLabel(f, yOf(v), fmtDelta(v).replace(/0+$/, '').replace(/\.$/, ''));
  }
  hLine(f, mid, C.zero);
  yLabel(f, mid, '0');

  if (emptyText) {
    g.textAlign = 'center';
    g.fillStyle = C.axis;
    g.fillText(emptyText, margin.l + plotW / 2, mid);
    return;
  }
  if (series.length === 1 && series[0].pts.length > 1) {
    const pts = series[0].pts;
    const area = new Path2D();
    area.moveTo(xOf(pts[0].d), mid);
    for (const pt of pts) area.lineTo(xOf(pt.d), yOf(pt.ms));
    area.lineTo(xOf(pts[pts.length - 1].d), mid);
    area.closePath();
    for (const [colour, top, h] of [[C.slower, p.top, mid - p.top], [C.faster, mid, p.top + p.h - mid]] as const) {
      g.save();
      g.beginPath(); g.rect(margin.l, top, plotW, h); g.clip();
      g.globalAlpha = 0.28;
      g.fillStyle = colour;
      g.fill(area);
      g.restore();
    }
  }
  for (const s of series) {
    if (s.pts.length < 2) continue;
    g.beginPath();
    s.pts.forEach((pt, i) => (i ? g.lineTo(xOf(pt.d), yOf(pt.ms)) : g.moveTo(xOf(pt.d), yOf(pt.ms))));
    g.setLineDash(s.dashed ? [5, 4] : []);
    g.strokeStyle = s.colour;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.stroke();
    g.setLineDash([]);
  }
}

/** Active aero zones as faint bands with a solid strip on the axis. */
export function drawAeroZones(f: Frame, zones: Zone[], top: number, bottom: number) {
  const { g, xOf, len } = f;
  for (const z of zones) {
    const x0 = xOf(z.start * len), x1 = xOf(z.end * len);
    g.fillStyle = C.aero;
    g.fillRect(x0, top, x1 - x0, bottom - top);
    g.fillStyle = C.aeroEdge;
    g.fillRect(x0, bottom - 3, x1 - x0, 3);
  }
}

/** Dashed sector lines and the distance axis along the bottom. */
export function drawDistanceAxis(f: Frame, sector2Start: number, sector3Start: number, top: number, bottom: number) {
  const { g, xOf, len, height, margin } = f;
  g.strokeStyle = C.axis;
  g.lineWidth = 1;
  g.setLineDash([2, 4]);
  g.fillStyle = C.label;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const [d, label] of [[sector2Start, 'S2'], [sector3Start, 'S3']] as const) {
    if (!d) continue;
    const x = Math.round(xOf(d)) + 0.5;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
    g.fillText(label, x, height - margin.b + 5);
  }
  g.setLineDash([]);
  for (let km = 0; km <= len; km += 1000) g.fillText(km ? `${km / 1000} km` : '0', xOf(km), height - margin.b + 5);
}

export function drawCursor(f: Frame, d: number | null, top: number, bottom: number) {
  if (d === null) return;
  const { g } = f;
  const x = Math.round(f.xOf(d)) + 0.5;
  g.strokeStyle = C.cursor;
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
}

/** Tracks a canvas's CSS size. */
export function observeSize(el: HTMLElement, set: (s: { w: number; h: number }) => void) {
  const ro = new ResizeObserver(([e]) => set({ w: e.contentRect.width, h: e.contentRect.height }));
  ro.observe(el);
  return () => ro.disconnect();
}
