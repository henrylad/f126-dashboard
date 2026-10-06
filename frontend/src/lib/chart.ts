// Shared canvas drawing for lap charts: channel panels (speed, throttle, …) and
// delta panels, all on one lap-distance axis that can be zoomed to a range. Used
// by the live trace and the lap comparison.
import { ERS_MAX_J, type Zone } from '../api/types.ts';
import type { Sample } from '../laps/lapMath.ts';
import { delta as fmtDelta } from './format.ts';

export const C = {
  current: '#ffa657',
  ref: '#9aa4b0',
  throttle: '#56d364',
  brake: '#f85149',
  gear: '#d0d7de',
  battery: '#79c0ff',
  faster: '#56d364',
  slower: '#f85149',
  deltaLine: '#e6edf3',
  zero: 'rgba(154, 164, 176, 0.5)',
  grid: 'rgba(154, 164, 176, 0.1)',
  axis: '#808a96',
  label: '#9aa4b0',
  aero: 'rgba(227, 179, 65, 0.05)',
  aeroEdge: '#e3b341',
  cursor: 'rgba(230, 237, 243, 0.55)',
  bg: '#151a22',
  zone: 'rgba(248, 81, 73, 0.07)',
  zoneEdge: '#ff7b72',
};

/**
 * Fixed-order colours for compared laps. They avoid every colour that carries
 * meaning (red lost, green gained, purple best, amber aero, blue focus); the
 * reference lap is always drawn in neutral `C.ref` whatever slot it holds.
 */
export const LAP_COLOURS = ['#ffa657', '#2dd4bf', '#f472b6', '#e9e26b', '#c8a27a', '#8bd5ca'];

const SANS = '"Geist Variable", system-ui, sans-serif';
const MONO = '"Geist Mono Variable", ui-monospace, monospace';

export type Channel = 'speed' | 'throttle' | 'brake' | 'gear' | 'ers';

export const CHANNELS: Record<Channel, { label: string; max: number; ticks: number[]; fmt: (v: number) => string; colour: string; fill: boolean; step?: boolean }> = {
  speed: { label: 'Speed km/h', max: 360, ticks: [0, 100, 200, 300], fmt: String, colour: C.current, fill: false },
  throttle: { label: 'Throttle %', max: 1, ticks: [0, 1], fmt: (v) => `${v * 100}`, colour: C.throttle, fill: true },
  brake: { label: 'Brake %', max: 1, ticks: [0, 1], fmt: (v) => `${v * 100}`, colour: C.brake, fill: true },
  gear: { label: 'Gear', max: 8, ticks: [1, 8], fmt: String, colour: C.gear, fill: false, step: true },
  ers: { label: 'Battery (ERS store) %', max: ERS_MAX_J, ticks: [0, ERS_MAX_J / 2, ERS_MAX_J], fmt: (v) => `${Math.round((v / ERS_MAX_J) * 100)}`, colour: C.battery, fill: true },
};

export interface Panel<K extends string = string> { key: K; label: string; top: number; h: number }

/** A distance range in metres; the whole lap unless zoomed. */
export interface Range { from: number; to: number }

export interface Frame {
  g: CanvasRenderingContext2D;
  width: number;
  height: number;
  margin: { l: number; r: number; t: number; b: number };
  plotW: number;
  len: number;
  range: Range;
  xOf: (d: number) => number;
}

export const PANEL_GAP = 18;

/** Stacks panels by share of the available height. */
export function layoutPanels<K extends string>(shares: [K, string, number][], top: number, available: number, gap = PANEL_GAP): { panels: Panel<K>[]; bottom: number } {
  const plotH = available - gap * (shares.length - 1);
  const panels: Panel<K>[] = [];
  let y = top;
  for (const [key, label, share] of shares) {
    panels.push({ key, label, top: y, h: plotH * share });
    y += plotH * share + gap;
  }
  return { panels, bottom: y - gap };
}

/** Sizes the canvas for the device pixel ratio and returns a cleared frame. */
export function beginFrame(el: HTMLCanvasElement, width: number, height: number, len: number, margin: Frame['margin'], range: Range = { from: 0, to: len }): Frame {
  const dpr = window.devicePixelRatio || 1;
  el.width = width * dpr;
  el.height = height * dpr;
  const g = el.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, width, height);
  g.font = `500 11px ${SANS}`;
  const plotW = width - margin.l - margin.r;
  const span = Math.max(1, range.to - range.from);
  return { g, width, height, margin, plotW, len, range, xOf: (d) => margin.l + ((d - range.from) / span) * plotW };
}

/** Distance under an x position, for pointer handling. */
export function dOf(f: Pick<Frame, 'margin' | 'plotW' | 'range'>, x: number): number {
  return f.range.from + ((x - f.margin.l) / f.plotW) * (f.range.to - f.range.from);
}

/** Runs `draw` clipped to the plot area between top and bottom. */
export function clipped(f: Frame, top: number, bottom: number, draw: () => void) {
  const { g } = f;
  g.save();
  g.beginPath();
  g.rect(f.margin.l, top, f.plotW, bottom - top);
  g.clip();
  draw();
  g.restore();
}

export function drawPanelLabel(f: Frame, p: Panel) {
  const { g } = f;
  g.save();
  g.font = `500 11px ${SANS}`;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  // A ground-coloured plate keeps the label legible over traces.
  const w = g.measureText(p.label).width;
  g.fillStyle = C.bg;
  g.globalAlpha = 0.85;
  g.fillRect(f.margin.l + 2, p.top, w + 8, 15);
  g.globalAlpha = 1;
  g.fillStyle = C.label;
  g.fillText(p.label, f.margin.l + 6, p.top + 2);
  g.restore();
}

function hLine(f: Frame, y: number, colour: string, dash: number[] = []) {
  const { g } = f;
  g.strokeStyle = colour;
  g.lineWidth = 1;
  g.setLineDash(dash);
  g.beginPath();
  g.moveTo(f.margin.l, Math.round(y) + 0.5);
  g.lineTo(f.margin.l + f.plotW, Math.round(y) + 0.5);
  g.stroke();
  g.setLineDash([]);
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
  opts: { dashed?: boolean; fill?: boolean; width?: number; halo?: boolean } = {},
) {
  if (samples.length < 2) return;
  const { g, xOf } = f;
  const ch = CHANNELS[p.key];
  const yOf = (v: number) => p.top + p.h - (v / ch.max) * p.h;
  const path = new Path2D();
  samples.forEach((sm, i) => {
    const x = xOf(sm.d), y = yOf(sm[p.key] ?? 0);
    if (!i) path.moveTo(x, y);
    else {
      // Gears change in steps, not ramps.
      if (ch.step) path.lineTo(x, yOf(samples[i - 1][p.key] ?? 0));
      path.lineTo(x, y);
    }
  });
  clipped(f, p.top - 2, p.top + p.h + 2, () => {
    g.lineJoin = 'round';
    if (opts.halo) {
      // A ground-coloured outline lifts this line off the ones beneath it.
      g.strokeStyle = C.bg;
      g.lineWidth = (opts.width ?? 2) + 3;
      g.stroke(path);
    }
    g.setLineDash(opts.dashed ? [6, 4] : []);
    g.strokeStyle = colour;
    g.lineWidth = opts.width ?? 2;
    g.stroke(path);
    g.setLineDash([]);
    if (opts.fill) {
      const area = new Path2D(path);
      area.lineTo(xOf(samples[samples.length - 1].d), yOf(0));
      area.lineTo(xOf(samples[0].d), yOf(0));
      area.closePath();
      g.globalAlpha = 0.14;
      g.fillStyle = colour;
      g.fill(area);
      g.globalAlpha = 1;
    }
  });
}

/** A channel drawn as the difference to a reference lap (e.g. speed − ref speed). */
export function drawDifference(f: Frame, p: Panel, pts: { d: number; v: number }[], range: number, colour: string) {
  if (pts.length < 2) return;
  const { g, xOf } = f;
  const mid = p.top + p.h / 2;
  const yOf = (v: number) => mid - (Math.max(-range, Math.min(range, v)) / range) * (p.h / 2);
  clipped(f, p.top, p.top + p.h, () => {
    g.beginPath();
    pts.forEach((pt, i) => (i ? g.lineTo(xOf(pt.d), yOf(pt.v)) : g.moveTo(xOf(pt.d), yOf(pt.v))));
    g.strokeStyle = colour;
    g.lineWidth = 1.75;
    g.lineJoin = 'round';
    g.stroke();
  });
}

/** Grid for a symmetric difference panel (±range), with the zero line. */
export function drawDifferenceGrid(f: Frame, p: Panel, range: number, fmt: (v: number) => string) {
  const mid = p.top + p.h / 2;
  for (const v of [range, -range]) {
    const y = mid - (v / range) * (p.h / 2);
    hLine(f, y, C.grid);
    yLabel(f, y, fmt(v));
  }
  hLine(f, mid, C.zero);
  yLabel(f, mid, '0');
}

export type DeltaPoint = { d: number; ms: number };

/** Symmetric delta range in 0.25 s steps up to 1 s, then 0.5 s steps; at most ±5 s. */
export function deltaRange(series: DeltaPoint[][], within?: Range): number {
  let max = 0;
  for (const s of series) for (const p of s) if (!within || (p.d >= within.from && p.d <= within.to)) max = Math.max(max, Math.abs(p.ms));
  const step = max <= 1000 ? 250 : 500;
  return Math.min(5000, Math.max(250, Math.ceil((max * 1.1) / step) * step));
}

export interface DeltaSeries { pts: DeltaPoint[]; colour: string; dashed?: boolean; fill?: boolean; halo?: boolean }

/** Delta panel. Above zero = slower. A series marked `fill` gets red (lost) / green (gained) fill. */
export function drawDeltaPanel(f: Frame, p: Panel, series: DeltaSeries[], range: number, emptyText?: string) {
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
    g.save();
    g.font = `500 13px ${SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillStyle = C.label;
    g.fillText(emptyText, margin.l + plotW / 2, mid - 10);
    g.restore();
    return;
  }
  clipped(f, p.top, p.top + p.h, () => {
    for (const s of series) {
      if (!s.fill || s.pts.length < 2) continue;
      const area = new Path2D();
      area.moveTo(xOf(s.pts[0].d), mid);
      for (const pt of s.pts) area.lineTo(xOf(pt.d), yOf(pt.ms));
      area.lineTo(xOf(s.pts[s.pts.length - 1].d), mid);
      area.closePath();
      for (const [colour, top, h] of [[C.slower, p.top, mid - p.top], [C.faster, mid, p.top + p.h - mid]] as const) {
        g.save();
        g.beginPath(); g.rect(margin.l, top, plotW, h); g.clip();
        g.globalAlpha = 0.22;
        g.fillStyle = colour;
        g.fill(area);
        g.restore();
      }
    }
    for (const s of series) {
      if (s.pts.length < 2) continue;
      const path = new Path2D();
      s.pts.forEach((pt, i) => (i ? path.lineTo(xOf(pt.d), yOf(pt.ms)) : path.moveTo(xOf(pt.d), yOf(pt.ms))));
      g.lineJoin = 'round';
      if (s.halo) { g.strokeStyle = C.bg; g.lineWidth = 5; g.stroke(path); }
      g.setLineDash(s.dashed ? [6, 4] : []);
      g.strokeStyle = s.colour;
      g.lineWidth = 2;
      g.stroke(path);
      g.setLineDash([]);
    }
  });
}

/** Active aero zones as faint bands with a solid strip on the axis. */
export function drawAeroZones(f: Frame, zones: Zone[], top: number, bottom: number) {
  const { g, xOf, len } = f;
  clipped(f, top, bottom, () => {
    for (const z of zones) {
      const x0 = xOf(z.start * len), x1 = xOf(z.end * len);
      g.fillStyle = C.aero;
      g.fillRect(x0, top, x1 - x0, bottom - top);
      g.fillStyle = C.aeroEdge;
      g.fillRect(x0, bottom - 2, x1 - x0, 2);
    }
  });
}

/**
 * Loss zones: a band over the delta panel (fainter down the other panels) and a
 * numbered bracket ruled at one device pixel above it.
 */
export function drawZoneBrackets(f: Frame, zones: { from: number; to: number }[], top: number, deltaBottom: number, bottom: number, active: number | null) {
  const { g, xOf } = f;
  const px = 1 / (window.devicePixelRatio || 1);
  clipped(f, top - 14, bottom, () => {
    zones.forEach((z, i) => {
      const x0 = xOf(z.from), x1 = xOf(z.to);
      g.fillStyle = C.zone;
      g.globalAlpha = active === null || active === i ? 1 : 0.45;
      g.fillRect(x0, top, x1 - x0, deltaBottom - top);
      g.globalAlpha *= 0.35;
      g.fillRect(x0, deltaBottom, x1 - x0, bottom - deltaBottom);
      g.globalAlpha = 1;
      g.strokeStyle = C.zoneEdge;
      g.lineWidth = active === i ? 1.5 : px;
      const y = top + 0.5;
      g.beginPath();
      g.moveTo(x0, y + 6); g.lineTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y + 6);
      g.stroke();
      g.save();
      g.font = `600 11px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillStyle = C.zoneEdge;
      g.fillText(String(i + 1), (x0 + x1) / 2, top - 2);
      g.restore();
    });
  });
}

const niceStep = (span: number) => [100, 200, 500, 1000].find((s) => span / s <= 8) ?? 1000;

/**
 * Sector lines, mini-sector ticks and the distance axis along the bottom. Mini
 * sectors are numbered so they line up with the mini-sector table.
 */
export function drawDistanceAxis(f: Frame, sector2Start: number, sector3Start: number, top: number, bottom: number, minis = 0, sectorLabels: 'top' | 'bottom' = 'bottom') {
  const { g, xOf, len, height, margin, range } = f;
  // With numbered mini sectors the labels take a second row below them.
  const labelY = minis ? bottom + 18 : height - margin.b + 6;
  g.save();
  g.font = `500 11px ${MONO}`;
  g.strokeStyle = C.axis;
  g.lineWidth = 1;
  g.setLineDash([2, 4]);
  g.fillStyle = C.label;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const sectors = [[sector2Start, 'S2'], [sector3Start, 'S3']] as const;
  const sectorXs: number[] = [];
  for (const [d, label] of sectors) {
    if (!d || d < range.from || d > range.to) continue;
    const x = Math.round(xOf(d)) + 0.5;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
    g.fillStyle = C.deltaLine;
    g.fillText(label, x, sectorLabels === 'top' ? top - 14 : labelY);
    g.fillStyle = C.label;
    if (sectorLabels === 'bottom') sectorXs.push(x);
  }
  g.setLineDash([]);

  // Mini-sector ticks with their numbers when there is room.
  if (minis) {
    const each = len / minis;
    const roomy = (each / (range.to - range.from)) * f.plotW >= 22;
    for (let k = 0; k <= minis; k++) {
      const d = k * each;
      if (d < range.from - 1 || d > range.to + 1) continue;
      const x = Math.round(xOf(d)) + 0.5;
      g.strokeStyle = C.axis;
      g.beginPath(); g.moveTo(x, bottom); g.lineTo(x, bottom + 4); g.stroke();
      if (roomy && k < minis && d + each / 2 <= range.to) {
        g.fillStyle = C.axis;
        g.fillText(String(k + 1), xOf(d + each / 2), bottom + 3);
      }
    }
  }

  // Distance labels, kept clear of the sector labels above.
  g.fillStyle = C.label;
  const step = niceStep(range.to - range.from);
  for (let d = Math.ceil(range.from / step) * step; d <= range.to; d += step) {
    const x = xOf(d);
    if (x < margin.l + 10 || x > margin.l + f.plotW - 10 || sectorXs.some((sx) => Math.abs(sx - x) < 36)) continue;
    g.fillText(d >= 1000 ? `${+(d / 1000).toFixed(1)} km` : `${d} m`, x, labelY);
  }
  g.restore();
}

export function drawCursor(f: Frame, d: number | null, top: number, bottom: number) {
  if (d === null || d < f.range.from || d > f.range.to) return;
  const { g } = f;
  const x = Math.round(f.xOf(d)) + 0.5;
  g.strokeStyle = C.cursor;
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
}

/** Shades the brushed distance range while dragging. */
export function drawBrush(f: Frame, a: number, b: number, top: number, bottom: number) {
  const { g, xOf } = f;
  const x0 = xOf(Math.min(a, b)), x1 = xOf(Math.max(a, b));
  g.fillStyle = 'rgba(121, 192, 255, 0.12)';
  g.fillRect(x0, top, x1 - x0, bottom - top);
  g.strokeStyle = '#79c0ff';
  g.lineWidth = 1;
  g.strokeRect(Math.round(x0) + 0.5, top + 0.5, Math.round(x1 - x0), bottom - top - 1);
}

/** Tracks a canvas's CSS size. */
export function observeSize(el: HTMLElement, set: (s: { w: number; h: number }) => void) {
  const ro = new ResizeObserver(([e]) => set({ w: e.contentRect.width, h: e.contentRect.height }));
  ro.observe(el);
  return () => ro.disconnect();
}
