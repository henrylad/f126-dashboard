// Completed-lap archive: per-lap sectors, stats and a trimmed telemetry trace,
// so every lap of the session can be compared.

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

/** What the store knows about the lap besides its samples. */
export interface LapContext {
  id: number;
  carIdx: number;
  lap: number;
  kind: LapKind;
  timeMs: number;
  trackLength: number;
  sector2Start: number;
  sector3Start: number;
  minis: (MiniSector | null)[];
  fuelStartKg: number | null;
  fuelEndKg: number;
  wearStartPct: number | null;
  wearEndPct: number;
  compound: number;
  tyreAge: number;
}

const KEEP_EVERY_M = 4;

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

export function summariseLap(samples: Sample[], ctx: LapContext): Lap {
  const complete = ctx.kind === 'timed' || ctx.kind === 'invalid';
  const s1End = interpolate(samples, ctx.sector2Start, 't');
  const s2End = interpolate(samples, ctx.sector3Start, 't');
  const fromLine = samples.length > 0 && samples[0].d < 50;
  const sectors: Lap['sectors'] = [
    fromLine && s1End !== null ? s1End : null,
    s1End !== null && s2End !== null ? s2End - s1End : null,
    complete && s2End !== null && ctx.timeMs > s2End ? ctx.timeMs - s2End : null,
  ];

  let dist = 0, fullThrottle = 0, braking = 0, boost = 0, deployed = 0, harvested = 0, gearChanges = 0, top = 0;
  samples.forEach((s, i) => {
    top = Math.max(top, s.speed);
    const p = samples[i - 1];
    if (!p) return;
    const ds = s.d - p.d;
    dist += ds;
    if (s.throttle >= 0.98) fullThrottle += ds;
    if (s.brake > 0.05) braking += ds;
    if (s.mode === 3) boost += ds;
    const dE = s.ers - p.ers;
    if (dE > 0) harvested += dE; else deployed -= dE;
    if (s.gear !== p.gear) gearChanges++;
  });
  const pct = (x: number) => (dist > 0 ? (x / dist) * 100 : 0);

  return {
    id: ctx.id,
    carIdx: ctx.carIdx,
    lap: ctx.lap,
    kind: ctx.kind,
    timeMs: ctx.timeMs,
    sectors,
    samples: trim(samples),
    minis: ctx.minis,
    stats: {
      topSpeed: top,
      avgSpeed: complete && ctx.timeMs > 0 ? (ctx.trackLength / (ctx.timeMs / 1000)) * 3.6 : null,
      fullThrottlePct: pct(fullThrottle),
      brakingPct: pct(braking),
      deployedJ: deployed,
      harvestedJ: harvested,
      boostPct: pct(boost),
      ersStartJ: samples[0]?.ers ?? 0,
      ersEndJ: samples.at(-1)?.ers ?? 0,
      fuelUsedKg: ctx.fuelStartKg === null ? null : ctx.fuelStartKg - ctx.fuelEndKg,
      wearDeltaPct: ctx.wearStartPct === null ? null : ctx.wearEndPct - ctx.wearStartPct,
      compound: ctx.compound,
      tyreAge: ctx.tyreAge,
      gearChanges,
    },
  };
}

/** Keeps a sample every few metres (plus the last) with rounded values, to keep history small. */
function trim(samples: Sample[]): Sample[] {
  const out: Sample[] = [];
  samples.forEach((s, i) => {
    const last = out.at(-1);
    if (last && s.d - last.d < KEEP_EVERY_M && i !== samples.length - 1) return;
    out.push({
      d: Math.round(s.d * 10) / 10,
      t: Math.round(s.t),
      speed: Math.round(s.speed),
      throttle: Math.round(s.throttle * 100) / 100,
      brake: Math.round(s.brake * 100) / 100,
      gear: s.gear,
      ers: Math.round(s.ers),
      mode: s.mode,
    });
  });
  return out;
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
