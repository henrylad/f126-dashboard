import { useEffect, useRef, useState } from 'react';
import { ENERGY } from '../../../shared/meta.ts';
import { energyBins } from '../../energy.ts';
import { observeSize } from '../../chart.ts';
import type { Compared } from './CompareChart.tsx';

const BINS = 300;
const ROW_H = 18;
const ROW_GAP = 6;
const LABEL_W = 44;

/** One strip per lap showing where the battery harvested, deployed or boosted. */
export function EnergyCompare({ laps, trackLength }: { laps: Compared[]; trackLength: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const height = Math.max(1, laps.length) * (ROW_H + ROW_GAP);

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
    g.font = '600 11px "Titillium Web", sans-serif';
    const plotW = w - LABEL_W - 12;
    laps.forEach(({ lap, colour }, row) => {
      const y = row * (ROW_H + ROW_GAP);
      g.fillStyle = colour;
      g.fillRect(0, y + 4, 8, ROW_H - 8);
      g.fillStyle = '#eef1fa';
      g.textBaseline = 'middle';
      g.fillText(String(lap.lap), 14, y + ROW_H / 2);
      g.fillStyle = '#1a2350';
      g.fillRect(LABEL_W, y, plotW, ROW_H);
      const bins = energyBins(lap.samples, trackLength, BINS);
      for (let b = 0; b < BINS; b++) {
        const key = bins[b];
        if (!key) continue;
        g.fillStyle = ENERGY.find((e) => e.key === key)!.colour;
        g.fillRect(LABEL_W + (b / BINS) * plotW, y, plotW / BINS + 0.5, ROW_H);
      }
    });
  });

  return (
    <>
      <div className="legend" style={{ marginBottom: 8 }}>
        {ENERGY.map((e) => <span key={e.key}><i style={{ background: e.colour, height: 8 }} />{e.label}</span>)}
        <span><i style={{ background: '#1a2350', height: 8 }} />No flow</span>
      </div>
      <div style={{ height }}>
        <canvas ref={canvas} style={{ width: '100%', height }} role="img" aria-label="Energy use along each selected lap" />
      </div>
      {!laps.length && <p className="dim">Select laps in the table to compare their energy use.</p>}
    </>
  );
}
