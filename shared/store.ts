// Accumulated history: the track outline (learned from car positions), the
// player's per-lap traces, and mini-sector times for every car. The server keeps
// one so a browser that connects mid-session gets the history; each browser then
// keeps extending its own copy.
import type { CarRow, Snapshot } from './types.ts';

export const OUTLINE_BINS = 800;
export const MINI_SECTORS = 25;

export interface Sample {
  d: number; // lap distance, metres
  t: number; // lap time, ms
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
}

/** 0 = not counted (invalid lap), 1 = slower than PB, 2 = personal best, 3 = fastest overall */
export type MiniColour = 0 | 1 | 2 | 3;
export interface MiniSector { ms: number; colour: MiniColour }

export interface Lap {
  lap: number;
  timeMs: number;
  samples: Sample[];
  minis: (MiniSector | null)[];
}

/** Per-car mini-sector timing state. Best times use 0 for "none yet" (JSON-safe). */
interface CarMini {
  lap: number;
  lastD: number;
  lastT: number;
  startT: (number | null)[]; // lap time when each mini sector was entered
  invalid: boolean;
  pb: number[];
}

export interface LapHistory {
  type: 'history';
  sessionUid: string;
  outline: ({ x: number; z: number } | null)[];
  current: Sample[];
  currentLap: number;
  lastLap: Lap | null;
  bestLap: Lap | null;
  cars: Record<number, CarMini>;
  overallBest: number[];
  minis: (MiniSector | null)[];
  lastMinis: (MiniSector | null)[];
}

const emptyMinis = () => new Array<MiniSector | null>(MINI_SECTORS).fill(null);

export class LapStore {
  sessionUid = '';
  outline: ({ x: number; z: number } | null)[] = new Array(OUTLINE_BINS).fill(null);
  outlineFilled = 0;
  current: Sample[] = [];
  currentLap = 0;
  lastLap: Lap | null = null;
  bestLap: Lap | null = null;
  /** Player's mini sectors on the current lap, and on the lap before. */
  minis = emptyMinis();
  lastMinis = emptyMinis();
  overallBest = new Array<number>(MINI_SECTORS).fill(0);
  private cars: Record<number, CarMini> = {};

  update(s: Snapshot) {
    const session = s.session;
    if (!session) return;
    if (session.uid !== this.sessionUid) this.reset(session.uid);
    const len = session.trackLength || 1;

    for (const car of s.cars) {
      this.timeMiniSectors(car, len);
      if (car.pitStatus !== 0 || car.lapDistance < 0 || (car.x === 0 && car.z === 0)) continue;
      const bin = Math.floor((car.lapDistance / len) * OUTLINE_BINS);
      if (bin < 0 || bin >= OUTLINE_BINS) continue;
      if (!this.outline[bin]) this.outlineFilled++;
      this.outline[bin] = { x: car.x, z: car.z };
    }

    const p = s.player;
    if (!p || p.lapDistance < 0) return;
    if (p.lap !== this.currentLap) {
      if (this.currentLap && this.current.length > 50) {
        const row = s.cars.find((c) => c.isPlayer);
        const timeMs = row?.lastLapMs ?? 0;
        const done: Lap = { lap: this.currentLap, timeMs, samples: this.current, minis: this.lastMinis };
        // Only a lap that started from the line counts as a reference lap.
        if (timeMs > 0 && done.samples[0].d < 200) {
          this.lastLap = done;
          if (!this.bestLap || timeMs < this.bestLap.timeMs) this.bestLap = done;
        }
      }
      this.current = [];
      this.currentLap = p.lap;
    }
    const last = this.current.at(-1);
    if (last && p.lapDistance < last.d - 50) {
      // Flashback / rewind: drop samples past the new position.
      this.current = this.current.filter((x) => x.d <= p.lapDistance);
    }
    if (!last || p.lapDistance > last.d) {
      this.current.push({
        d: p.lapDistance, t: p.currentLapMs, speed: p.speed,
        throttle: p.throttle, brake: p.brake, gear: p.gear,
      });
    }
  }

  /**
   * Detects mini-sector boundary crossings between two snapshots, interpolating
   * the crossing time from lap distance so 30 Hz updates still give ms accuracy.
   */
  private timeMiniSectors(car: CarRow, len: number) {
    const seg = len / MINI_SECTORS;
    let m = this.cars[car.idx];
    if (!m) {
      m = this.cars[car.idx] = {
        lap: car.lap, lastD: car.lapDistance, lastT: car.currentLapMs,
        startT: new Array(MINI_SECTORS).fill(null), invalid: false,
        pb: new Array(MINI_SECTORS).fill(0),
      };
      return;
    }

    if (car.lap !== m.lap) {
      const nextLap = car.lap === m.lap + 1;
      const lastStart = m.startT[MINI_SECTORS - 1];
      if (nextLap && lastStart !== null && car.lastLapMs > 0) {
        this.completeMini(car, m, MINI_SECTORS - 1, car.lastLapMs - lastStart);
      }
      if (car.isPlayer) {
        this.lastMinis = this.minis;
        this.minis = emptyMinis();
      }
      m.lap = car.lap;
      m.invalid = false;
      m.startT = new Array(MINI_SECTORS).fill(null);
      if (nextLap) m.startT[0] = 0;
      // Treat the line itself as the previous sample for the crossing scan below.
      m.lastD = 0;
      m.lastT = 0;
    } else if (car.lapDistance < m.lastD - 30) {
      // Flashback: times before this point no longer match — skip the rest of the lap.
      m.startT.fill(null);
      m.invalid = true;
      m.lastD = car.lapDistance;
      m.lastT = car.currentLapMs;
      return;
    }

    if (car.currentLapInvalid) m.invalid = true;
    const d = car.lapDistance, t = car.currentLapMs;
    if (d > m.lastD) {
      for (let k = Math.max(1, Math.floor(m.lastD / seg) + 1); k < MINI_SECTORS && k * seg <= d; k++) {
        const b = k * seg;
        const tb = m.lastT + ((b - m.lastD) / (d - m.lastD)) * (t - m.lastT);
        const start = m.startT[k - 1];
        if (start !== null) this.completeMini(car, m, k - 1, tb - start);
        m.startT[k] = tb;
      }
    }
    m.lastD = d;
    m.lastT = t;
  }

  private completeMini(car: CarRow, m: CarMini, k: number, ms: number) {
    if (!(ms > 0)) return;
    let colour: MiniColour = 0;
    if (!m.invalid) {
      if (!this.overallBest[k] || ms < this.overallBest[k]) {
        this.overallBest[k] = ms;
        colour = 3;
      } else {
        colour = !m.pb[k] || ms < m.pb[k] ? 2 : 1;
      }
      if (!m.pb[k] || ms < m.pb[k]) m.pb[k] = ms;
    }
    if (car.isPlayer) this.minis[k] = { ms, colour };
  }

  /** Live delta (ms) of the current lap against the best lap at the same distance. */
  delta(): number | null {
    const ref = this.bestLap?.samples;
    const cur = this.current.at(-1);
    if (!ref || !cur || ref.length < 2) return null;
    const t = interpolate(ref, cur.d, 't');
    return t === null ? null : cur.t - t;
  }

  /** Delta to the best lap along the whole current lap, for plotting. */
  deltaTrace(): { d: number; ms: number }[] {
    const ref = this.bestLap?.samples;
    if (!ref || ref.length < 2) return [];
    const out: { d: number; ms: number }[] = [];
    for (const sm of this.current) {
      const t = interpolate(ref, sm.d, 't');
      if (t !== null) out.push({ d: sm.d, ms: sm.t - t });
    }
    return out;
  }

  toHistory(): LapHistory {
    const { sessionUid, outline, current, currentLap, lastLap, bestLap, cars, overallBest, minis, lastMinis } = this;
    return { type: 'history', sessionUid, outline, current, currentLap, lastLap, bestLap, cars, overallBest, minis, lastMinis };
  }

  loadHistory(h: LapHistory) {
    this.sessionUid = h.sessionUid;
    this.outline = h.outline;
    this.outlineFilled = h.outline.filter(Boolean).length;
    this.current = h.current;
    this.currentLap = h.currentLap;
    this.lastLap = h.lastLap;
    this.bestLap = h.bestLap;
    this.cars = h.cars;
    this.overallBest = h.overallBest;
    this.minis = h.minis;
    this.lastMinis = h.lastMinis;
  }

  private reset(uid: string) {
    this.sessionUid = uid;
    this.outline = new Array(OUTLINE_BINS).fill(null);
    this.outlineFilled = 0;
    this.current = [];
    this.currentLap = 0;
    this.lastLap = this.bestLap = null;
    this.cars = {};
    this.overallBest = new Array(MINI_SECTORS).fill(0);
    this.minis = emptyMinis();
    this.lastMinis = emptyMinis();
  }
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
