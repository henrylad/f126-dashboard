import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY } from '../../lib/meta.ts';
import { energyBins } from '../../lib/energy.ts';
import { observeSize, type Range } from '../../lib/chart.ts';
import type { Compared } from './CompareChart.tsx';

/** Fine enough to stay crisp when the charts zoom to a corner. */
const BINS = 1200;
const ROW_H = 16;
const ROW_GAP = 8;
const NO_FLOW = '#1b212b';

/** One strip per lap showing where the battery harvested, deployed or boosted. */
export function EnergyCompare({ headingId, laps, trackLength, range }: { headingId: string; laps: Compared[]; trackLength: number; range: Range }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const height = Math.max(1, laps.length) * (ROW_H + ROW_GAP) - ROW_GAP;
  const ids = laps.map((c) => c.lap.id).join();
  const bins = useMemo(() => laps.map((c) => energyBins(c.lap.samples, trackLength, BINS)), [ids, trackLength]);

  useEffect(() => observeSize(canvas.current!, (s) => setW(s.w)), []);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !w) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = w * dpr;
    el.height = height * dpr;
    const g = el.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, height);
    const span = Math.max(1, range.to - range.from);
    const xOf = (d: number) => ((d - range.from) / span) * w;
    laps.forEach((_, row) => {
      const y = row * (ROW_H + ROW_GAP);
      g.fillStyle = NO_FLOW;
      g.fillRect(0, y, w, ROW_H);
      for (let b = 0; b < BINS; b++) {
        const key = bins[row]?.[b];
        if (!key) continue;
        const d0 = (b / BINS) * trackLength, d1 = ((b + 1) / BINS) * trackLength;
        if (d1 < range.from || d0 > range.to) continue;
        g.fillStyle = ENERGY.find((e) => e.key === key)!.colour;
        g.fillRect(xOf(d0), y, xOf(d1) - xOf(d0) + 0.5, ROW_H);
      }
    });
  });

  return (
    <>
      <div className="section-head">
        <h2 id={headingId}>Energy</h2>
        <span className="legend">
          {ENERGY.map((e) => <span key={e.key}><i className="blk" style={{ background: e.colour }} />{e.label}</span>)}
          <span><i className="blk" style={{ background: NO_FLOW, boxShadow: 'inset 0 0 0 1px #353d49' }} />No flow</span>
        </span>
      </div>
      <div className="energy-rows" hidden={!laps.length}>
        <ul className="energy-labels" aria-hidden>
          {laps.map((c) => <li key={c.lap.id} style={{ height: ROW_H }}><i className="sw" style={{ background: c.colour }} />{c.label}</li>)}
        </ul>
        <canvas ref={canvas} style={{ height }} role="img"
          aria-label={`Where ${laps.map((c) => c.label).join(', ')} harvested, deployed and used Boost, ${Math.round(range.from)} to ${Math.round(range.to)} m`} />
      </div>
      {!laps.length && <p className="section-note">Tick laps in the list to compare where they harvested, deployed and used Boost.</p>}
    </>
  );
}
