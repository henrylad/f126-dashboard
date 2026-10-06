import { useState } from 'react';
import type { Snapshot } from '../api/types.ts';
import { ENERGY, MINI_COLOURS, MINI_LABELS, team, trackName, type EnergyKey } from '../lib/meta.ts';
import { MINI_SECTORS, OUTLINE_BINS, type LapView } from '../laps/lapView.ts';
import { code } from '../lib/format.ts';
import { coveredBins, energyBins } from '../lib/energy.ts';

type Pt = { x: number; z: number };

/** Polyline through the learned outline between two lap fractions (wrapping). */
function segment(outline: (Pt | null)[], from: number, to: number): string {
  const a = Math.floor(from * OUTLINE_BINS), b = Math.ceil(to * OUTLINE_BINS);
  const pts: string[] = [];
  const count = (b - a + OUTLINE_BINS) % OUTLINE_BINS || OUTLINE_BINS;
  for (let k = 0; k <= count; k++) {
    const p = outline[(a + k) % OUTLINE_BINS];
    if (p) pts.push(`${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function TrackMap({ snap, store }: { snap: Snapshot; store: LapView }) {
  const [view, setView] = useState<'minis' | 'energy' | 'aero'>('minis');
  const [shown, setShown] = useState<Set<EnergyKey>>(() => new Set(ENERGY.map((e) => e.key)));
  const toggleEnergy = (k: EnergyKey, solo: boolean) => setShown((prev) => {
    // Click isolates one category (click again to show all); shift-click adds/removes.
    if (!solo) {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    }
    return prev.size === 1 && prev.has(k) ? new Set(ENERGY.map((e) => e.key)) : new Set([k]);
  });
  const s = snap.session!;
  const outline = store.outline;
  const known = outline.filter(Boolean) as Pt[];
  const pts = known.length ? known : snap.cars.map((c) => ({ x: c.x, z: c.z }));
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const span = Math.max(maxX - minX, maxZ - minZ, 100);
  const pad = span * 0.09;
  const viewBox = `${minX - pad} ${minZ - pad} ${maxX - minX + pad * 2} ${maxZ - minZ + pad * 2}`;
  const r = span * 0.013;
  const coverage = store.outlineFilled / OUTLINE_BINS;
  const len = s.trackLength || 1;

  const yellowZones = s.marshalZones
    .map((z, i) => ({ ...z, end: s.marshalZones[i + 1]?.start ?? 1 }))
    .filter((z) => z.flag === 3);
  const markers = [
    { f: 0, label: 'S/F' },
    { f: s.sector2Start / len, label: 'S2' },
    { f: s.sector3Start / len, label: 'S3' },
  ].map((m) => ({ ...m, p: outline[Math.floor(m.f * OUTLINE_BINS) % OUTLINE_BINS] }));
  const cars = [...snap.cars].reverse(); // leader drawn on top, then player on top of all
  cars.sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));

  return (
    <section className="panel map-panel">
      <h2>
        Track · {trackName(s.trackId)}
        <span className="aside legend">
          <span className="seg" role="group" aria-label="Map colouring">
            <button className={view === 'minis' ? 'on' : ''} onClick={() => setView('minis')}>Mini sectors</button>
            <button className={view === 'energy' ? 'on' : ''} onClick={() => setView('energy')}>Energy</button>
            <button className={view === 'aero' ? 'on' : ''} onClick={() => setView('aero')}>Aero zones</button>
          </span>
          {view === 'minis' && [3, 2, 1].map((c) => <span key={c}><i style={{ background: MINI_COLOURS[c] }} />{MINI_LABELS[c]}</span>)}
          {view === 'energy' && ENERGY.map((e) => (
            <button key={e.key} className={`chip${shown.has(e.key) ? ' on' : ''}`} aria-pressed={shown.has(e.key)}
              title="Click to show only this · shift-click to add or remove" onClick={(ev) => toggleEnergy(e.key, !ev.shiftKey)}>
              <i style={{ background: e.colour }} />{e.label}
            </button>
          ))}
          {view === 'aero' && <span><i style={{ background: 'var(--yellow)' }} />Active aero zone</span>}
          {view === 'aero' && s.drsZones.length > 0 && <span><i style={{ background: 'var(--blue-soft)' }} />DRS zone</span>}
          {yellowZones.length > 0 && <span><i style={{ background: 'var(--red-soft)' }} />Yellow flag</span>}
        </span>
      </h2>
      <div className="map-wrap">
        {pts.length > 1 && (
          <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Live track map">
            {coverage > 0.05 && (
              <>
                <polyline points={segment(outline, 0, 1)} fill="none" stroke="#1e2a5a" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <polyline points={segment(outline, 0, 1)} fill="none" stroke="#33438a" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
            {view === 'minis' && Array.from({ length: MINI_SECTORS }, (_, k) => {
              // Your lap so far; sectors not reached yet show last lap, faded.
              const m = store.minis[k] ?? store.lastMinis[k];
              if (!m) return null;
              return (
                <polyline key={`m${k}`} points={segment(outline, k / MINI_SECTORS, (k + 1) / MINI_SECTORS)} fill="none"
                  stroke={MINI_COLOURS[m.colour]} strokeOpacity={store.minis[k] ? 1 : 0.35} strokeWidth={5} vectorEffect="non-scaling-stroke" />
              );
            })}
            {view === 'energy' && energyRuns(store, len).map((r, i) => shown.has(r.key) && (
              <polyline key={`e${i}`} points={segment(outline, r.from / OUTLINE_BINS, r.to / OUTLINE_BINS)} fill="none"
                stroke={ENERGY.find((e) => e.key === r.key)!.colour} strokeOpacity={r.faded ? 0.35 : 1}
                strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {view === 'aero' && s.aeroZonesFull.concat(s.aeroZonesPartial).map((z, i) => (
              <polyline key={`a${i}`} points={segment(outline, z.start, z.end)} fill="none" stroke="var(--yellow)" strokeOpacity={0.85} strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {view === 'aero' && s.drsZones.map((z, i) => (
              <polyline key={`d${i}`} points={segment(outline, z.start, z.end)} fill="none" stroke="var(--blue-soft)" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {yellowZones.map((z, i) => (
              <polyline key={`y${i}`} points={segment(outline, z.start, z.end)} fill="none" stroke="var(--red-soft)" strokeWidth={8} strokeOpacity={0.7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {markers.map((m) => m.p && (
              <g key={m.label}>
                <circle cx={m.p.x} cy={m.p.z} r={r * 0.35} fill="var(--text)" />
                <text x={m.p.x + r * 0.8} y={m.p.z - r * 0.8} fontSize={r * 1.3} fill="var(--muted)" fontWeight={700}>{m.label}</text>
              </g>
            ))}
            {cars.map((c) => (
              <g key={c.idx} opacity={c.pitStatus > 0 ? 0.45 : 1}>
                <title>{`P${c.position} ${c.name}`}</title>
                {c.isPlayer && <circle cx={c.x} cy={c.z} r={r * 1.9} fill="none" stroke="var(--yellow)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                <circle cx={c.x} cy={c.z} r={c.isPlayer ? r * 1.25 : r} fill={team(c.teamId).colour} stroke="var(--bg)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                {(c.isPlayer || c.position <= 3) && (
                  <text x={c.x + r * 2.2} y={c.z + r * 0.5} fontSize={r * 1.6} fontWeight={700} fill={c.isPlayer ? 'var(--yellow)' : 'var(--text)'}>
                    {code(c.name)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
        {coverage < 0.05 && <div className="map-empty">Learning the circuit layout from car positions…</div>}
      </div>
    </section>
  );
}

/**
 * Runs of equal energy state along the lap: this lap where driven so far,
 * the rest from last lap (faded).
 */
function energyRuns(store: LapView, len: number) {
  const cur = energyBins(store.current, len, OUTLINE_BINS);
  const covered = coveredBins(store.current, len, OUTLINE_BINS);
  const last = store.lastLap ? energyBins(store.lastLap.samples, len, OUTLINE_BINS) : null;
  const runs: { key: EnergyKey; faded: boolean; from: number; to: number }[] = [];
  for (let b = 0; b < OUTLINE_BINS; b++) {
    const faded = !covered[b];
    const key = faded ? last?.[b] ?? null : cur[b];
    const prev = runs.at(-1);
    if (key && prev && prev.key === key && prev.faded === faded && prev.to === b) prev.to = b + 1;
    else if (key) runs.push({ key, faded, from: b, to: b + 1 });
  }
  return runs;
}
