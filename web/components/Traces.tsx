import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../shared/types.ts';
import { MINI_SECTORS, interpolate, type LapStore, type Sample } from '../../shared/store.ts';
import { MINI_COLOURS, MINI_LABELS, MINI_PENDING } from '../../shared/meta.ts';
import { delta as fmtDelta, lapTime } from '../format.ts';

const C = {
  current: '#ffc906',
  ref: '#8d98c7',
  throttle: '#6e8bff',
  brake: '#ff3355',
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

const STRIP_H = 14;
const GAP = 18;

type Key = 'speed' | 'throttle' | 'brake';
interface Panel { key: Key | 'delta'; label: string; top: number; h: number }

export function Traces({ snap, store }: { snap: Snapshot; store: LapStore }) {
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

  useEffect(() => {
    const el = canvas.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layout: mini-sector strip, delta, speed, throttle, brake — all on one distance axis.
  const stripTop = margin.t;
  const plotTop = stripTop + STRIP_H + 12;
  const plotH = size.h - plotTop - margin.b - GAP * 3;
  const shares: [Panel['key'], string, number][] = [
    ['delta', 'Delta to best lap s · above zero = slower', 0.24],
    ['speed', 'Speed km/h', 0.44],
    ['throttle', 'Throttle %', 0.16],
    ['brake', 'Brake %', 0.16],
  ];
  const panels: Panel[] = [];
  let y = plotTop;
  for (const [key, label, share] of shares) {
    panels.push({ key, label, top: y, h: plotH * share });
    y += plotH * share + GAP;
  }
  const plotBottom = y - GAP;
  const plotW = size.w - margin.l - margin.r;
  const xOf = (d: number) => margin.l + (d / len) * plotW;

  // Symmetric delta range in 0.5 s steps, at least ±0.5 s.
  const maxAbs = deltaTrace.reduce((m, p) => Math.max(m, Math.abs(p.ms)), 0);
  const deltaRange = Math.min(5000, Math.max(500, Math.ceil(maxAbs / 500) * 500));

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = size.w * dpr;
    el.height = size.h * dpr;
    const g = el.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);
    g.font = '600 10px "Titillium Web", sans-serif';

    // Mini-sector strip: this lap's colours; sectors not reached yet show last lap faded.
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = C.label;
    g.fillText('MINI', margin.l - 6, stripTop + STRIP_H / 2);
    for (let k = 0; k < MINI_SECTORS; k++) {
      const now = store.minis[k], before = store.lastMinis[k];
      const x0 = xOf(k * seg) + 1, x1 = xOf((k + 1) * seg) - 1; // 2 px gap between blocks
      g.globalAlpha = now ? 1 : before ? 0.3 : 1;
      g.fillStyle = now ? MINI_COLOURS[now.colour] : before ? MINI_COLOURS[before.colour] : MINI_PENDING;
      g.beginPath();
      g.roundRect(x0, stripTop, Math.max(1, x1 - x0), STRIP_H, 3);
      g.fill();
    }
    g.globalAlpha = 1;

    // Active aero zones as background bands, with a solid strip on the axis.
    for (const z of s.aeroZonesFull.concat(s.aeroZonesPartial)) {
      const x0 = xOf(z.start * len), x1 = xOf(z.end * len);
      g.fillStyle = C.aero;
      g.fillRect(x0, plotTop, x1 - x0, plotBottom - plotTop);
      g.fillStyle = C.aeroEdge;
      g.fillRect(x0, plotBottom - 3, x1 - x0, 3);
    }

    for (const p of panels) {
      g.save();
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = C.label;
      g.fillText(p.label.toUpperCase(), margin.l + 6, p.top + 2);
      g.restore();
      if (p.key === 'delta') drawDelta(g, p);
      else drawChannel(g, p as Panel & { key: Key });
    }

    // sector lines + x axis labels
    g.strokeStyle = C.axis;
    g.setLineDash([2, 4]);
    g.fillStyle = C.label;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (const [d, label] of [[s.sector2Start, 'S2'], [s.sector3Start, 'S3']] as const) {
      if (!d) continue;
      const x = Math.round(xOf(d)) + 0.5;
      g.beginPath(); g.moveTo(x, stripTop); g.lineTo(x, plotBottom); g.stroke();
      g.fillText(label, x, size.h - margin.b + 5);
    }
    g.setLineDash([]);
    for (let km = 0; km <= len; km += 1000) g.fillText(km ? `${km / 1000} km` : '0', xOf(km), size.h - margin.b + 5);

    if (hoverD !== null) {
      const x = Math.round(xOf(hoverD)) + 0.5;
      g.strokeStyle = C.cursor;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, stripTop); g.lineTo(x, plotBottom); g.stroke();
    }

    function drawDelta(g: CanvasRenderingContext2D, p: Panel) {
      const mid = p.top + p.h / 2;
      const yOf = (ms: number) => mid - (Math.max(-deltaRange, Math.min(deltaRange, ms)) / deltaRange) * (p.h / 2);
      g.strokeStyle = C.grid;
      g.lineWidth = 1;
      g.fillStyle = C.label;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      for (const v of [deltaRange, -deltaRange]) {
        const yy = Math.round(yOf(v)) + 0.5;
        g.beginPath(); g.moveTo(margin.l, yy); g.lineTo(margin.l + plotW, yy); g.stroke();
        g.fillText(fmtDelta(v).replace(/0+$/, '').replace(/\.$/, ''), margin.l - 6, yy);
      }
      g.strokeStyle = C.zero;
      g.beginPath(); g.moveTo(margin.l, Math.round(mid) + 0.5); g.lineTo(margin.l + plotW, Math.round(mid) + 0.5); g.stroke();
      g.fillText('0', margin.l - 6, mid);

      if (!ref) {
        g.textAlign = 'center';
        g.fillStyle = C.axis;
        g.fillText('Available after your first full lap', margin.l + plotW / 2, mid);
        return;
      }
      if (deltaTrace.length < 2) return;
      const area = new Path2D();
      area.moveTo(xOf(deltaTrace[0].d), mid);
      for (const pt of deltaTrace) area.lineTo(xOf(pt.d), yOf(pt.ms));
      area.lineTo(xOf(deltaTrace[deltaTrace.length - 1].d), mid);
      area.closePath();
      // Red where slower (above zero), green where faster (below).
      for (const [colour, top, h] of [[C.slower, p.top, mid - p.top], [C.faster, mid, p.top + p.h - mid]] as const) {
        g.save();
        g.beginPath(); g.rect(margin.l, top, plotW, h); g.clip();
        g.globalAlpha = 0.28;
        g.fillStyle = colour;
        g.fill(area);
        g.restore();
      }
      g.beginPath();
      deltaTrace.forEach((pt, i) => (i ? g.lineTo(xOf(pt.d), yOf(pt.ms)) : g.moveTo(xOf(pt.d), yOf(pt.ms))));
      g.strokeStyle = C.deltaLine;
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.stroke();
    }

    function drawChannel(g: CanvasRenderingContext2D, p: Panel & { key: Key }) {
      const max = p.key === 'speed' ? 360 : 1;
      const yOf = (v: number) => p.top + p.h - (v / max) * p.h;
      g.strokeStyle = C.grid;
      g.lineWidth = 1;
      g.fillStyle = C.label;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      const ticks = p.key === 'speed' ? [0, 100, 200, 300] : [0, 1];
      for (const t of ticks) {
        const yy = Math.round(yOf(t)) + 0.5;
        g.beginPath(); g.moveTo(margin.l, yy); g.lineTo(margin.l + plotW, yy); g.stroke();
        g.fillText(p.key === 'speed' ? String(t) : `${t * 100}`, margin.l - 6, yy);
      }
      const line = (samples: Sample[], colour: string, dashed: boolean, fill: boolean) => {
        if (samples.length < 2) return;
        g.beginPath();
        samples.forEach((sm, i) => (i ? g.lineTo(xOf(sm.d), yOf(sm[p.key])) : g.moveTo(xOf(sm.d), yOf(sm[p.key]))));
        g.setLineDash(dashed ? [5, 4] : []);
        g.strokeStyle = colour;
        g.lineWidth = 2;
        g.lineJoin = 'round';
        g.stroke();
        g.setLineDash([]);
        if (fill) {
          g.lineTo(xOf(samples[samples.length - 1].d), yOf(0));
          g.lineTo(xOf(samples[0].d), yOf(0));
          g.closePath();
          g.globalAlpha = 0.14;
          g.fillStyle = colour;
          g.fill();
          g.globalAlpha = 1;
        }
      };
      if (ref && p.key === 'speed') line(ref.samples, C.ref, true, false);
      const colour = p.key === 'speed' ? C.current : p.key === 'throttle' ? C.throttle : C.brake;
      line(store.current, colour, false, p.key !== 'speed');
      const cur = store.current.at(-1);
      if (cur && p.key === 'speed') {
        g.fillStyle = C.current;
        g.beginPath(); g.arc(xOf(cur.d), yOf(cur.speed), 4, 0, Math.PI * 2); g.fill();
      }
    }
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
        <canvas ref={canvas} role="img" aria-label="Mini sectors, delta to best lap, speed, throttle and brake against lap distance" />
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
            <div className="row"><span>Gear</span><b className="num">{tip.gear === null ? '—' : Math.round(tip.gear)}</b></div>
          </div>
        )}
      </div>
    </section>
  );
}
