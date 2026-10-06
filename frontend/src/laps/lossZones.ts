// Where a lap loses time to a reference lap, and the telemetry that explains it.
import { interpolate, type Lap, type Sample } from './lapMath.ts';
import { MINI_SECTORS } from './lapView.ts';

export interface DeltaPoint { d: number; ms: number }

/** Time difference to the reference lap along the lap distance (above zero = slower). */
export function deltaTo(lap: Lap, ref: Lap): DeltaPoint[] {
  const out: DeltaPoint[] = [];
  for (const s of lap.samples) {
    const t = interpolate(ref.samples, s.d, 't');
    if (t !== null) out.push({ d: s.d, ms: s.t - t });
  }
  return out;
}

export interface Zone {
  /** Lap distance, metres. */
  from: number;
  to: number;
  /** Time lost (positive) or gained (negative) across the zone, ms. */
  ms: number;
  sector: 1 | 2 | 3;
  /** 1-based mini sectors the zone touches. */
  minis: [number, number];
  /** Plain-language telemetry differences, strongest first. */
  why: string[];
}

const STEP_M = 10;
/** Zones shorter than this read as noise. */
const MIN_ZONE_MS = 15;

/** The delta on a fixed distance grid, so zones can be searched in one pass. */
function gridDelta(lap: Lap, ref: Lap, len: number): DeltaPoint[] {
  const out: DeltaPoint[] = [];
  for (let d = 0; d <= len; d += STEP_M) {
    const a = interpolate(lap.samples, d, 't');
    const b = interpolate(ref.samples, d, 't');
    if (a !== null && b !== null) out.push({ d, ms: a - b });
  }
  return out;
}

/**
 * The biggest non-overlapping stretches where the delta rises (time lost), or
 * falls when `gains` is set. Each stretch is capped at about one corner's
 * length (400 m) so a lap that is slow everywhere still points at its worst corners.
 */
function findZones(pts: DeltaPoint[], len: number, count: number, gains: boolean): { i: number; j: number; ms: number }[] {
  const sign = gains ? -1 : 1;
  const maxSpan = Math.max(2, Math.round(Math.min(400, len / 10) / STEP_M));
  const used = new Array<boolean>(pts.length).fill(false);
  const zones: { i: number; j: number; ms: number }[] = [];
  for (let n = 0; n < count; n++) {
    let best = { i: -1, j: -1, ms: 0 };
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      for (let j = i + 1; j < pts.length && j - i <= maxSpan && !used[j]; j++) {
        const rise = (pts[j].ms - pts[i].ms) * sign;
        if (rise > best.ms) best = { i, j, ms: rise };
      }
    }
    if (best.i < 0 || best.ms < MIN_ZONE_MS) break;
    for (let k = best.i; k <= best.j; k++) used[k] = true;
    zones.push({ ...best, ms: best.ms * sign });
  }
  return zones;
}

const inRange = (s: Sample[], from: number, to: number) => s.filter((x) => x.d >= from && x.d <= to);

/** First distance in the range where the channel crosses the threshold upwards. */
function onset(s: Sample[], key: 'brake' | 'throttle', threshold: number): number | null {
  for (let i = 1; i < s.length; i++) if (s[i][key] >= threshold && s[i - 1][key] < threshold) return s[i].d;
  return null;
}

/** Why the lap differs from the reference in this stretch, from the raw channels. */
function explain(lap: Lap, ref: Lap, from: number, to: number): string[] {
  // Braking starts before the time shows up in the delta, so look a little earlier.
  const a = inRange(lap.samples, from - 150, to), b = inRange(ref.samples, from - 150, to);
  const za = inRange(lap.samples, from, to), zb = inRange(ref.samples, from, to);
  if (a.length < 3 || b.length < 3 || !za.length || !zb.length) return [];
  const why: string[] = [];

  const ba = onset(a, 'brake', 0.3), bb = onset(b, 'brake', 0.3);
  if (ba !== null && bb !== null && Math.abs(ba - bb) >= 5) {
    why.push(`brakes ${Math.round(Math.abs(ba - bb))} m ${ba < bb ? 'earlier' : 'later'}`);
  }

  const minA = Math.min(...za.map((x) => x.speed)), minB = Math.min(...zb.map((x) => x.speed));
  const braking = ba !== null || bb !== null;
  if (braking && Math.abs(minA - minB) >= 2) {
    why.push(`${Math.round(Math.abs(minA - minB))} km/h ${minA < minB ? 'slower' : 'faster'} at the apex`);
  }

  const apexA = za.find((x) => x.speed === minA)!.d, apexB = zb.find((x) => x.speed === minB)!.d;
  const ta = onset(inRange(lap.samples, apexA, to + 150), 'throttle', 0.95);
  const tb = onset(inRange(ref.samples, apexB, to + 150), 'throttle', 0.95);
  if (braking && ta !== null && tb !== null && Math.abs(ta - tb) >= 8) {
    why.push(`full throttle ${Math.round(Math.abs(ta - tb))} m ${ta > tb ? 'later' : 'earlier'}`);
  }

  const boost = (s: Sample[]) => s.filter((x) => x.mode === 3).length / s.length;
  const boostDiff = boost(zb) - boost(za);
  if (boostDiff >= 0.25) why.push('ref used Boost');
  else if (boostDiff <= -0.25) why.push('you used Boost');

  if (!braking) {
    const topA = Math.max(...za.map((x) => x.speed)), topB = Math.max(...zb.map((x) => x.speed));
    if (Math.abs(topA - topB) >= 2) why.push(`${Math.round(Math.abs(topA - topB))} km/h ${topA < topB ? 'down' : 'up'} on the straight`);
  }
  if (!why.length) {
    // Nothing sharp: say how much speed the lap carried through the stretch.
    const avg = (s: Sample[]) => s.reduce((a, x) => a + x.speed, 0) / s.length;
    const diff = avg(za) - avg(zb);
    if (Math.abs(diff) >= 0.5) why.push(`${Math.abs(diff).toFixed(1)} km/h ${diff < 0 ? 'less' : 'more'} speed through here on average`);
  }
  return why.slice(0, 2);
}

function toZone(lap: Lap, ref: Lap, pts: DeltaPoint[], z: { i: number; j: number; ms: number }, len: number, s2: number, s3: number): Zone {
  const from = pts[z.i].d, to = pts[z.j].d, mid = (from + to) / 2;
  const mini = (d: number) => Math.min(MINI_SECTORS, Math.floor((d / len) * MINI_SECTORS) + 1);
  return {
    from, to, ms: z.ms,
    sector: s3 && mid >= s3 ? 3 : s2 && mid >= s2 ? 2 : 1,
    minis: [mini(from), mini(Math.max(from, to - 1))],
    why: explain(lap, ref, from, to),
  };
}

export interface Verdict {
  /** Lap time minus reference lap time, ms. */
  gapMs: number;
  /** Biggest losses first. */
  losses: Zone[];
  /** Biggest gain, if there is one worth showing. */
  gain: Zone | null;
}

export function verdict(lap: Lap, ref: Lap, len: number, s2: number, s3: number): Verdict {
  const pts = gridDelta(lap, ref, len);
  return {
    gapMs: lap.timeMs - ref.timeMs,
    losses: findZones(pts, len, 3, false).map((z) => toZone(lap, ref, pts, z, len, s2, s3)),
    gain: findZones(pts, len, 1, true).map((z) => toZone(lap, ref, pts, z, len, s2, s3))[0] ?? null,
  };
}

/** A lap without usable traces: online players whose telemetry is private send zeros. */
export const hasTelemetry = (lap: Lap) => lap.samples.length > 10 && lap.samples.some((s) => s.speed > 0);
