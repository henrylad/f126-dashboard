// Archived laps as the server sends them, and the maths the charts need on them.

export interface Sample {
  d: number; // lap distance, metres
  t: number; // lap time, ms
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  ers: number; // ERS store, J
  mode: number; // ERS deploy mode (3 = Boost)
}

/** 0 = not counted (out/in-lap, pits, invalid), 1 = slower than PB, 2 = personal best, 3 = fastest overall */
export type MiniColour = 0 | 1 | 2 | 3;
export interface MiniSector { ms: number; colour: MiniColour }

/** timed = clean lap from line to line; the rest are shown but never used as a reference. */
export type LapKind = 'timed' | 'invalid' | 'out' | 'in' | 'pit' | 'partial';

export interface LapStats {
  topSpeed: number;
  avgSpeed: number | null;
  fullThrottlePct: number;
  brakingPct: number;
  deployedJ: number;
  harvestedJ: number;
  boostPct: number;
  ersStartJ: number;
  ersEndJ: number;
  fuelUsedKg: number | null;
  wearDeltaPct: number | null;
  compound: number;
  tyreAge: number;
  gearChanges: number;
}

export interface Lap {
  id: number; // unique in the session (lap numbers can repeat after the pits)
  carIdx: number;
  lap: number;
  kind: LapKind;
  timeMs: number;
  sectors: [number | null, number | null, number | null];
  samples: Sample[];
  minis: (MiniSector | null)[];
  stats: LapStats;
}

export function interpolate(samples: Sample[], d: number, key: keyof Sample): number | null {
  if (!samples.length || d < samples[0].d || d > samples[samples.length - 1].d) return null;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].d <= d) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const f = b.d === a.d ? 0 : (d - a.d) / (b.d - a.d);
  return a[key] + (b[key] - a[key]) * f;
}

/** Sum of the best time in each mini sector across laps — the lap you could have done. */
export function theoreticalBest(laps: Lap[]): number | null {
  const timed = laps.filter((l) => l.kind === 'timed');
  if (!timed.length) return null;
  let sum = 0;
  for (let k = 0; k < (timed[0].minis.length || 0); k++) {
    const times = timed.map((l) => l.minis[k]?.ms).filter((v): v is number => !!v);
    if (!times.length) return null;
    sum += Math.min(...times);
  }
  return sum;
}
