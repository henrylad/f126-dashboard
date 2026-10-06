import { useEffect, useRef, useState } from 'react';
import { ERS_MAX_J, type SessionInfo } from '../../api/types.ts';
import { interpolate, type Lap } from '../../laps/lapMath.ts';
import { delta as fmtDelta } from '../../lib/format.ts';
import {
  CHANNELS, beginFrame, deltaRange, drawAeroZones, drawChannelGrid, drawCursor, drawDeltaPanel,
  drawDistanceAxis, drawPanelLabel, drawSeries, layoutPanels, observeSize, type Channel, type DeltaPoint, type Panel,
} from '../../lib/chart.ts';

/** A lap in the comparison, with its colour and a short label (e.g. "L5" or "VER L7"). */
export interface Compared { lap: Lap; colour: string; label: string }

/** Time difference to the reference lap along the lap distance. */
function deltaTo(lap: Lap, ref: Lap): DeltaPoint[] {
  const out: DeltaPoint[] = [];
  for (const s of lap.samples) {
    const t = interpolate(ref.samples, s.d, 't');
    if (t !== null) out.push({ d: s.d, ms: s.t - t });
  }
  return out;
}

export function CompareChart({ laps, refLap, session }: { laps: Compared[]; refLap: Lap | null; session: SessionInfo }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverD, setHoverD] = useState<number | null>(null);
  const len = session.trackLength || 1;
  const margin = { l: 44, r: 12, t: 4, b: 20 };

  useEffect(() => observeSize(canvas.current!, setSize), []);

  const refCompared = laps.find((c) => c.lap.id === refLap?.id);
  const deltas = refLap ? laps.filter((c) => c !== refCompared).map((c) => ({ pts: deltaTo(c.lap, refLap), colour: c.colour })) : [];
  const { panels, bottom } = layoutPanels<Channel | 'delta'>([
    ['delta', 'Delta to reference lap s · above zero = slower', 0.22],
    ['speed', CHANNELS.speed.label, 0.28],
    ['throttle', CHANNELS.throttle.label, 0.11],
    ['brake', CHANNELS.brake.label, 0.11],
    ['gear', CHANNELS.gear.label, 0.12],
    ['ers', CHANNELS.ers.label, 0.16],
  ], margin.t, size.h - margin.t - margin.b);
  const plotW = size.w - margin.l - margin.r;
  const xOf = (d: number) => margin.l + (d / len) * plotW;

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w) return;
    const f = beginFrame(el, size.w, size.h, len, margin);
    drawAeroZones(f, session.aeroZonesFull.concat(session.aeroZonesPartial), margin.t, bottom);
    for (const p of panels) {
      drawPanelLabel(f, p);
      if (p.key === 'delta') {
        const series = refCompared ? [{ pts: [{ d: 0, ms: 0 }, { d: len, ms: 0 }], colour: refCompared.colour, dashed: true }, ...deltas] : deltas;
        drawDeltaPanel(f, p, deltas.length ? series : [], deltaRange(deltas.map((s) => s.pts)),
          !refLap ? 'Pick a reference lap (Ref column)' : !deltas.length ? 'Select another lap to compare' : undefined);
        continue;
      }
      const cp = p as Panel<Channel>;
      drawChannelGrid(f, cp);
      // Reference lap dashed so it stays identifiable; others solid.
      for (const c of laps) drawSeries(f, cp, c.lap.samples, c.colour, { dashed: c === refCompared, width: 1.75 });
    }
    drawDistanceAxis(f, session.sector2Start, session.sector3Start, margin.t, bottom);
    drawCursor(f, hoverD, margin.t, bottom);
  });

  const onMove = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const d = ((e.clientX - rect.left - margin.l) / plotW) * len;
    setHoverD(d >= 0 && d < len ? d : null);
  };

  const at = (lap: Lap, key: 'speed' | 'throttle' | 'brake' | 'gear' | 'ers' | 't') => (hoverD === null ? null : interpolate(lap.samples, hoverD, key));
  const refT = refLap && hoverD !== null ? interpolate(refLap.samples, hoverD, 't') : null;

  return (
    <div className="trace-canvas compare-canvas" onPointerMove={onMove} onPointerLeave={() => setHoverD(null)}>
      <canvas ref={canvas} role="img" aria-label="Selected laps compared: delta, speed, throttle, brake, gear and battery against lap distance" />
      {hoverD !== null && laps.length > 0 && (
        <div className="tooltip compare-tip" style={{ left: Math.min(xOf(hoverD) + 12, size.w - 330), top: 8 }}>
          <div className="row"><span>Distance</span><b className="num">{Math.round(hoverD)} m</b></div>
          <table className="num">
            <thead><tr><th>Lap</th><th>Δ</th><th>km/h</th><th>Thr</th><th>Brk</th><th>G</th><th>Batt</th></tr></thead>
            <tbody>
              {laps.map((c) => {
                const t = at(c.lap, 't');
                const d = t !== null && refT !== null ? t - refT : null;
                const v = (key: 'speed' | 'throttle' | 'brake' | 'gear' | 'ers', fmt: (x: number) => string) => {
                  const x = at(c.lap, key);
                  return x === null ? '—' : fmt(x);
                };
                return (
                  <tr key={c.lap.id}>
                    <td><i className="sw" style={{ background: c.colour }} />{c.label}{c === refCompared ? ' ref' : ''}</td>
                    <td style={{ color: d === null || c === refCompared ? undefined : d <= 0 ? 'var(--green)' : 'var(--red-soft)' }}>{d === null || c === refCompared ? '—' : fmtDelta(d)}</td>
                    <td>{v('speed', (x) => String(Math.round(x)))}</td>
                    <td>{v('throttle', (x) => `${Math.round(x * 100)}`)}</td>
                    <td>{v('brake', (x) => `${Math.round(x * 100)}`)}</td>
                    <td>{v('gear', (x) => String(Math.round(x)))}</td>
                    <td>{v('ers', (x) => `${Math.round((x / ERS_MAX_J) * 100)}%`)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
