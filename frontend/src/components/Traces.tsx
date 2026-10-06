import { useEffect, useRef, useState } from 'react';
import { ERS_MAX_J, type Snapshot } from '../api/types.ts';
import { MINI_SECTORS, type LapView } from '../laps/lapView.ts';
import { interpolate } from '../laps/lapMath.ts';
import { MINI_COLOURS, MINI_LABELS, MINI_PENDING } from '../lib/meta.ts';
import { delta as fmtDelta, lapTime } from '../lib/format.ts';
import {
  C, CHANNELS, beginFrame, deltaRange, drawAeroZones, drawChannelGrid, drawCursor, drawDeltaPanel,
  drawDistanceAxis, drawPanelLabel, drawSeries, layoutPanels, observeSize, type Channel, type Panel,
} from '../lib/chart.ts';

const STRIP_H = 14;
/** Channels that also show the best lap (dashed) for comparison. */
const WITH_REF = new Set<Channel>(['speed', 'ers']);

export function Traces({ snap, store }: { snap: Snapshot; store: LapView }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hoverD, setHoverD] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const s = snap.session!;
  const len = s.trackLength || 1;
  const seg = len / MINI_SECTORS;
  const ref = store.bestLap;
  const deltaMs = store.delta();
  const deltaTrace = store.deltaTrace();
  const margin = { l: 44, r: 12, t: 4, b: 20 };

  useEffect(() => observeSize(canvas.current!, setSize), []);

  // Layout: mini-sector strip, then delta and channel panels on one distance axis.
  const stripTop = margin.t;
  const plotTop = stripTop + STRIP_H + 12;
  const { panels, bottom: plotBottom } = layoutPanels<Channel | 'delta'>([
    ['delta', 'Delta to best lap s · above zero = slower', 0.2],
    ['speed', CHANNELS.speed.label, 0.3],
    ['throttle', CHANNELS.throttle.label, 0.11],
    ['brake', CHANNELS.brake.label, 0.11],
    ['gear', CHANNELS.gear.label, 0.12],
    ['ers', CHANNELS.ers.label, 0.16],
  ], plotTop, size.h - plotTop - margin.b);
  const plotW = size.w - margin.l - margin.r;
  const xOf = (d: number) => margin.l + (d / len) * plotW;

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w) return;
    const f = beginFrame(el, size.w, size.h, len, margin);
    const { g } = f;

    // Mini-sector strip: this lap's colours; sectors not reached yet show last lap faded.
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = C.label;
    g.fillText('MINI', margin.l - 6, stripTop + STRIP_H / 2);
    for (let k = 0; k < MINI_SECTORS; k++) {
      const now = store.minis[k], before = store.lastMinis[k];
      const x0 = f.xOf(k * seg) + 1, x1 = f.xOf((k + 1) * seg) - 1; // 2 px gap between blocks
      g.globalAlpha = now ? 1 : before ? 0.3 : 1;
      g.fillStyle = now ? MINI_COLOURS[now.colour] : before ? MINI_COLOURS[before.colour] : MINI_PENDING;
      g.beginPath();
      g.roundRect(x0, stripTop, Math.max(1, x1 - x0), STRIP_H, 3);
      g.fill();
    }
    g.globalAlpha = 1;

    drawAeroZones(f, s.aeroZonesFull.concat(s.aeroZonesPartial), plotTop, plotBottom);
    for (const p of panels) {
      drawPanelLabel(f, p);
      if (p.key === 'delta') {
        drawDeltaPanel(f, p, [{ pts: deltaTrace, colour: C.deltaLine, fill: true }], deltaRange([deltaTrace]), ref ? undefined : 'Available after your first full lap');
        continue;
      }
      const cp = p as Panel<Channel>;
      const yOf = drawChannelGrid(f, cp);
      if (ref && WITH_REF.has(cp.key)) drawSeries(f, cp, ref.samples, C.ref, { dashed: true });
      drawSeries(f, cp, store.current, CHANNELS[cp.key].colour, { fill: CHANNELS[cp.key].fill });
      const cur = store.current.at(-1);
      if (cur && cp.key === 'speed') {
        g.fillStyle = C.current;
        g.beginPath(); g.arc(f.xOf(cur.d), yOf(cur.speed), 4, 0, Math.PI * 2); g.fill();
      }
    }
    drawDistanceAxis(f, s.sector2Start, s.sector3Start, stripTop, plotBottom);
    drawCursor(f, hoverD, stripTop, plotBottom);
  });

  const onMove = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const d = ((e.clientX - rect.left - margin.l) / plotW) * len;
    setHoverD(d >= 0 && d < len ? d : null);
  };

  const tip = hoverD === null ? null : (() => {
    const k = Math.min(MINI_SECTORS - 1, Math.floor(hoverD / seg));
    const mini = store.minis[k] ?? null;
    const refMini = ref?.minis?.[k] ?? null;
    const curT = interpolate(store.current, hoverD, 't');
    const refT = ref ? interpolate(ref.samples, hoverD, 't') : null;
    return {
      left: Math.min(xOf(hoverD) + 12, size.w - 190),
      k,
      mini,
      miniVsBest: mini && refMini ? mini.ms - refMini.ms : null,
      delta: curT !== null && refT !== null ? curT - refT : null,
      speed: interpolate(store.current, hoverD, 'speed'),
      refSpeed: ref ? interpolate(ref.samples, hoverD, 'speed') : null,
      throttle: interpolate(store.current, hoverD, 'throttle'),
      brake: interpolate(store.current, hoverD, 'brake'),
      gear: interpolate(store.current, hoverD, 'gear'),
      battery: interpolate(store.current, hoverD, 'ers'),
      refBattery: ref ? interpolate(ref.samples, hoverD, 'ers') : null,
    };
  })();

  return (
    <section className="panel">
      <div className="traces-head">
        <h2 style={{ margin: 0 }}>Lap trace · Lap {snap.player!.lap}</h2>
        <span className="legend">
          <span><i style={{ background: C.current }} />Current lap</span>
          <span><i className="dash" />Best lap {ref ? lapTime(ref.timeMs) : '(after a full lap)'}</span>
          <span><i style={{ background: C.throttle }} />Throttle</span>
          <span><i style={{ background: C.brake }} />Brake</span>
          <span><i style={{ background: C.gear }} />Gear</span>
          <span><i style={{ background: C.battery }} />Battery</span>
          <span><i style={{ background: C.aeroEdge }} />Aero zone (axis strip)</span>
        </span>
        {deltaMs !== null && (
          <span className={`delta-chip num ${deltaMs <= 0 ? 'faster' : 'slower'}`} title="Live delta to your best lap">
            {fmtDelta(deltaMs)}
          </span>
        )}
      </div>
      <div className="legend" style={{ marginBottom: 6 }}>
        <span style={{ color: 'var(--dim)', fontWeight: 700, letterSpacing: '0.1em' }}>MINI SECTORS</span>
        {[3, 2, 1].map((c) => (
          <span key={c}><i style={{ background: MINI_COLOURS[c], height: 8 }} />{MINI_LABELS[c]}</span>
        ))}
        <span><i style={{ background: MINI_COLOURS[1], opacity: 0.3, height: 8 }} />Last lap (not reached yet)</span>
      </div>
      <div className="trace-canvas" onPointerMove={onMove} onPointerLeave={() => setHoverD(null)}>
        <canvas ref={canvas} role="img" aria-label="Mini sectors, delta to best lap, speed, throttle, brake, gear and battery against lap distance" />
        {tip && (
          <div className="tooltip" style={{ left: tip.left, top: 8 }}>
            <div className="row"><span>Distance</span><b className="num">{Math.round(hoverD!)} m</b></div>
            <div className="row">
              <span><i className="sw" style={{ background: tip.mini ? MINI_COLOURS[tip.mini.colour] : MINI_PENDING }} />Mini {tip.k + 1}/{MINI_SECTORS}</span>
              <b className="num">{tip.mini ? `${(tip.mini.ms / 1000).toFixed(3)} s` : '—'}</b>
            </div>
            {tip.miniVsBest !== null && (
              <div className="row"><span>vs best lap</span><b className="num" style={{ color: tip.miniVsBest <= 0 ? C.faster : C.slower }}>{fmtDelta(tip.miniVsBest)}</b></div>
            )}
            {tip.delta !== null && (
              <div className="row"><span>Delta here</span><b className="num" style={{ color: tip.delta <= 0 ? C.faster : C.slower }}>{fmtDelta(tip.delta)}</b></div>
            )}
            <div className="row"><span><i className="sw" style={{ background: C.current }} />Speed</span><b className="num">{tip.speed === null ? '—' : `${Math.round(tip.speed)} km/h`}</b></div>
            {tip.refSpeed !== null && <div className="row"><span><i className="sw" style={{ background: C.ref }} />Best lap</span><b className="num">{Math.round(tip.refSpeed)} km/h</b></div>}
            <div className="row"><span><i className="sw" style={{ background: C.throttle }} />Throttle</span><b className="num">{tip.throttle === null ? '—' : `${Math.round(tip.throttle * 100)}%`}</b></div>
            <div className="row"><span><i className="sw" style={{ background: C.brake }} />Brake</span><b className="num">{tip.brake === null ? '—' : `${Math.round(tip.brake * 100)}%`}</b></div>
            <div className="row"><span><i className="sw" style={{ background: C.gear }} />Gear</span><b className="num">{tip.gear === null ? '—' : Math.round(tip.gear)}</b></div>
            <div className="row"><span><i className="sw" style={{ background: C.battery }} />Battery</span><b className="num">{tip.battery === null ? '—' : `${Math.round((tip.battery / ERS_MAX_J) * 100)}%`}</b></div>
            {tip.refBattery !== null && <div className="row"><span><i className="sw" style={{ background: C.ref }} />Best lap</span><b className="num">{Math.round((tip.refBattery / ERS_MAX_J) * 100)}%</b></div>}
          </div>
        )}
      </div>
    </section>
  );
}
