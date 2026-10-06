import { useEffect, useRef, useState } from 'react';
import { ERS_MAX_J, type SessionInfo } from '../../api/types.ts';
import { interpolate, type Lap } from '../../laps/lapMath.ts';
import { MINI_SECTORS } from '../../laps/lapView.ts';
import { deltaTo, type Zone } from '../../laps/lossZones.ts';
import { delta as fmtDelta } from '../../lib/format.ts';
import {
  CHANNELS, beginFrame, dOf, deltaRange, drawAeroZones, drawBrush, drawChannelGrid, drawCursor, drawDeltaPanel,
  drawDifference, drawDifferenceGrid, drawDistanceAxis, drawPanelLabel, drawSeries, drawZoneBrackets, layoutPanels,
  observeSize, type Channel, type Panel, type Range,
} from '../../lib/chart.ts';

/** A lap in the comparison, with its colour and a short label (e.g. "L5" or "VER L7"). */
export interface Compared { lap: Lap; colour: string; label: string }

type Mode = 'overlay' | 'difference';
// Left margin matches the energy strips' label column, so both share one distance axis.
const MARGIN = { l: 64, r: 14, t: 20, b: 36 };
const KEY_STEP_M = 10;

interface Props {
  headingId: string;
  laps: Compared[];
  refLap: Lap | null;
  focusId: number | null;
  session: SessionInfo;
  zones: Zone[];
  activeZone: number | null;
  range: Range;
  zoomed: boolean;
  onZoom: (r: Range | null) => void;
}

/**
 * Speed minus the reference lap's speed at the same distance, for the difference
 * view. Speeds arrive in whole km/h, so a short moving average keeps the
 * rounding steps from reading as a sawtooth.
 */
function speedDiff(lap: Lap, ref: Lap) {
  const raw: { d: number; v: number }[] = [];
  for (const s of lap.samples) {
    const v = interpolate(ref.samples, s.d, 'speed');
    if (v !== null) raw.push({ d: s.d, v: s.speed - v });
  }
  const k = 3;
  return raw.map((p, i) => {
    const w = raw.slice(Math.max(0, i - k), i + k + 1);
    return { d: p.d, v: w.reduce((a, x) => a + x.v, 0) / w.length };
  });
}

export function CompareChart({ headingId, laps, refLap, focusId, session, zones, activeZone, range, zoomed, onZoom }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState<number | null>(null);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  const [mode, setMode] = useState<Mode>('overlay');
  const len = session.trackLength || 1;

  useEffect(() => observeSize(canvas.current!, setSize), []);

  const refCompared = laps.find((c) => c.lap.id === refLap?.id) ?? null;
  const others = laps.filter((c) => c !== refCompared);
  // Focus lap drawn last among the others so it sits on top of them; the reference on top of all.
  const ordered = [...others.filter((c) => c.lap.id !== focusId), ...others.filter((c) => c.lap.id === focusId)];
  const deltas = refLap ? ordered.map((c) => ({ c, pts: deltaTo(c.lap, refLap) })) : [];
  const diff = mode === 'difference' && refLap;

  const { panels, bottom } = layoutPanels<Channel | 'delta'>([
    ['delta', 'Gap to ref, s · above zero = slower', 0.3],
    ['speed', diff ? 'Speed vs ref, km/h' : CHANNELS.speed.label, 0.27],
    ['throttle', CHANNELS.throttle.label, 0.11],
    ['brake', CHANNELS.brake.label, 0.11],
    ['gear', CHANNELS.gear.label, 0.08],
    ['ers', CHANNELS.ers.label, 0.13],
  ], MARGIN.t, size.h - MARGIN.t - MARGIN.b, 14);
  const geo = { margin: MARGIN, plotW: size.w - MARGIN.l - MARGIN.r, range };

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w) return;
    const f = beginFrame(el, size.w, size.h, len, MARGIN, range);
    drawAeroZones(f, session.aeroZonesFull.concat(session.aeroZonesPartial), MARGIN.t, bottom);
    drawZoneBrackets(f, zones, panels[0].top, panels[0].top + panels[0].h, bottom, activeZone);
    for (const p of panels) {
      drawPanelLabel(f, p);
      if (p.key === 'delta') {
        const series = [
          ...(refCompared ? [{ pts: [{ d: 0, ms: 0 }, { d: len, ms: 0 }], colour: refCompared.colour, dashed: true }] : []),
          ...deltas.map(({ c, pts }) => ({ pts, colour: c.colour, fill: c.lap.id === focusId, halo: c.lap.id === focusId })),
        ];
        drawDeltaPanel(f, p, deltas.length ? series : [], deltaRange(deltas.map((s) => s.pts), range),
          !refLap ? 'Pick a reference lap (Ref in the list)' : !deltas.length ? 'Tick another lap to compare with the reference' : undefined);
        drawDeltaLabels(f, p);
        continue;
      }
      const cp = p as Panel<Channel>;
      if (p.key === 'speed' && diff) {
        const series = ordered.map((c) => ({ c, pts: speedDiff(c.lap, refLap!) }));
        let max = 10;
        for (const s of series) for (const pt of s.pts) if (pt.d >= range.from && pt.d <= range.to) max = Math.max(max, Math.abs(pt.v));
        const r = Math.ceil(max / 10) * 10;
        drawDifferenceGrid(f, p, r, (v) => (v > 0 ? `+${v}` : String(v)));
        for (const s of series) drawDifference(f, p, s.pts, r, s.c.colour);
        continue;
      }
      drawChannelGrid(f, cp);
      for (const c of ordered) drawSeries(f, cp, c.lap.samples, c.colour, { width: 1.5 });
      if (refCompared) drawSeries(f, cp, refCompared.lap.samples, refCompared.colour, { dashed: true, width: 1.75, halo: true });
    }
    drawDistanceAxis(f, session.sector2Start, session.sector3Start, MARGIN.t, bottom, MINI_SECTORS);
    if (brush) drawBrush(f, brush.a, brush.b, MARGIN.t, bottom);
    drawCursor(f, cursor, MARGIN.t, bottom);
  });

  // Labels the end of each delta line with its lap, so colour is not the only key.
  function drawDeltaLabels(f: ReturnType<typeof beginFrame>, p: Panel) {
    if (!deltas.length) return;
    const { g } = f;
    const r = deltaRange(deltas.map((s) => s.pts), range);
    const mid = p.top + p.h / 2;
    const placed: number[] = [];
    g.save();
    g.font = '600 11px "Geist Mono Variable", ui-monospace, monospace';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const { c, pts } of deltas) {
      const last = [...pts].reverse().find((pt) => pt.d <= range.to);
      if (!last) continue;
      let y = mid - (Math.max(-r, Math.min(r, last.ms)) / r) * (p.h / 2) - 9;
      // Nudge labels apart when lines finish close together.
      while (placed.some((py) => Math.abs(py - y) < 13)) y -= 13;
      y = Math.max(p.top + 8, Math.min(p.top + p.h - 8, y));
      placed.push(y);
      const text = `${c.label} ${fmtDelta(last.ms)}`;
      const w = g.measureText(text).width;
      const x = f.margin.l + f.plotW - 4;
      g.fillStyle = 'rgba(21, 26, 34, 0.85)';
      g.fillRect(x - w - 4, y - 7, w + 8, 14);
      g.fillStyle = c.colour;
      g.fillText(text, x, y);
    }
    g.restore();
  }

  const distanceAt = (clientX: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    const d = dOf(geo, clientX - rect.left);
    return Math.max(range.from, Math.min(range.to, d));
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const d = distanceAt(e.clientX);
    setBrush({ a: d, b: d });
  };
  const onMove = (e: React.PointerEvent) => {
    const d = distanceAt(e.clientX);
    setCursor(d);
    if (brush) setBrush({ ...brush, b: d });
  };
  const onUp = () => {
    if (brush && Math.abs(brush.b - brush.a) >= 50) onZoom({ from: Math.min(brush.a, brush.b), to: Math.max(brush.a, brush.b) });
    setBrush(null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP_M * 10 : KEY_STEP_M;
    const at = cursor ?? (range.from + range.to) / 2;
    const span = range.to - range.from;
    const moves: Record<string, () => void> = {
      ArrowRight: () => setCursor(Math.min(range.to, at + step)),
      ArrowLeft: () => setCursor(Math.max(range.from, at - step)),
      Home: () => setCursor(range.from),
      End: () => setCursor(range.to),
      '+': () => onZoom({ from: at - span / 4, to: at + span / 4 }),
      '=': () => onZoom({ from: at - span / 4, to: at + span / 4 }),
      '-': () => onZoom(span * 2 >= len ? null : { from: at - span, to: at + span }),
      Escape: () => onZoom(null),
    };
    if (moves[e.key]) { e.preventDefault(); moves[e.key](); }
  };

  const at = (lap: Lap, key: 'speed' | 'throttle' | 'brake' | 'gear' | 'ers' | 't') => (cursor === null ? null : interpolate(lap.samples, cursor, key));
  const refT = refLap && cursor !== null ? interpolate(refLap.samples, cursor, 't') : null;
  const span = range.to - range.from;

  return (
    <>
      <div className="section-head">
        <h2 id={headingId}>Telemetry</h2>
        <span className="legend" aria-label="Laps on the chart">
          {[...ordered, ...(refCompared ? [refCompared] : [])].map((c) => (
            <span key={c.lap.id}><i className={c === refCompared ? 'dash' : ''} style={{ background: c === refCompared ? undefined : c.colour, color: c.colour }} />{c.label}{c === refCompared ? ' (ref)' : ''}</span>
          ))}
        </span>
        <span className="head-tools">
          <span className="seg" role="group" aria-label="Speed panel">
            <button className={mode === 'overlay' ? 'on' : ''} aria-pressed={mode === 'overlay'} onClick={() => setMode('overlay')}>Overlay</button>
            <button className={mode === 'difference' ? 'on' : ''} aria-pressed={mode === 'difference'} disabled={!refLap} onClick={() => setMode('difference')}
              title="Speed minus the reference lap's speed at the same point">Speed vs ref</button>
          </span>
          <button className="btn" disabled={!zoomed} onClick={() => onZoom(null)}>
            {zoomed ? `Whole lap · showing ${(span / 1000).toFixed(2)} km` : 'Whole lap'}
          </button>
        </span>
      </div>

      <div className="readout num" aria-live="off">
        {cursor === null || !laps.length ? (
          <span className="dim readout-hint">Hover the chart, or focus it and use ← → (Shift for 100 m). Drag or press + to zoom, Esc for the whole lap.</span>
        ) : (
          <>
            <span className="readout-d">{Math.round(cursor)} m</span>
            {[...ordered, ...(refCompared ? [refCompared] : [])].map((c) => {
              const t = at(c.lap, 't');
              const d = t !== null && refT !== null && c !== refCompared ? t - refT : null;
              const v = (key: 'speed' | 'throttle' | 'brake' | 'gear', fmt: (x: number) => string) => { const x = at(c.lap, key); return x === null ? '—' : fmt(x); };
              const e = at(c.lap, 'ers');
              return (
                <span key={c.lap.id} className="readout-lap">
                  <i className={`sw${c === refCompared ? ' dashed' : ''}`} style={{ color: c.colour, background: c === refCompared ? undefined : c.colour }} />
                  <b>{c.label}</b>
                  <span className={d === null ? 'dim' : d > 0 ? 'lost' : 'gained'}>{c === refCompared ? 'ref' : d === null ? '—' : fmtDelta(d)}</span>
                  <span>{v('speed', (x) => `${Math.round(x)}`)}<small> km/h</small></span>
                  <span>{v('throttle', (x) => `${Math.round(x * 100)}`)}<small>% thr</small></span>
                  <span>{v('brake', (x) => `${Math.round(x * 100)}`)}<small>% brk</small></span>
                  <span><small>G</small>{v('gear', (x) => `${Math.round(x)}`)}</span>
                  <span>{e === null ? '—' : Math.round((e / ERS_MAX_J) * 100)}<small>% batt</small></span>
                </span>
              );
            })}
          </>
        )}
      </div>

      <div
        className="compare-canvas" tabIndex={0} role="img"
        aria-label={`Gap to the reference and speed, throttle, brake, gear and battery for ${laps.map((c) => c.label).join(', ') || 'no laps'}, from ${Math.round(range.from)} to ${Math.round(range.to)} m. The loss list above describes the same data in words.`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={() => { if (!brush) setCursor(null); }} onDoubleClick={() => onZoom(null)} onKeyDown={onKey}
      >
        <canvas ref={canvas} />
      </div>
    </>
  );
}
