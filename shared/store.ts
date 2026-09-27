// Accumulated history: the track outline (learned from car positions), the
// player's per-lap traces, and mini-sector times for every car. The server keeps
// one so a browser that connects mid-session gets the history; each browser then
// keeps extending its own copy.
import type { CarRow, SessionInfo, Snapshot } from './types.ts';
import { interpolate, summariseLap, type Lap, type LapKind, type MiniColour, type MiniSector, type Sample } from './laps.ts';

export { interpolate, type Lap, type LapKind, type MiniColour, type MiniSector, type Sample } from './laps.ts';

export const OUTLINE_BINS = 800;
export const MINI_SECTORS = 25;
/** A new position this close to a bin's point confirms it; further away counts against it. */
const OUTLINE_MATCH_M = 20;
const OUTLINE_MAX_CONFIDENCE = 30;
/** Ignore pit/garage status for this long after a lap starts (status can lag the line). */
const LAP_START_GRACE_MS = 1500;
/** Oldest laps are dropped beyond this (the best lap is always kept). */
const MAX_LAPS = 150;

export interface OutlinePoint { x: number; z: number; n: number; timed: boolean }

/** On a timed lap on track — not in the garage, pit lane, an out-lap or an in-lap. */
const onTimedLap = (c: CarRow) => c.pitStatus === 0 && (c.driverStatus === 1 || c.driverStatus === 4);

/**
 * Whether the car started a new lap since the previous update. The lap number
 * normally increments at the line, but after leaving the pits the game can
 * restart the lap timer at the line without changing the lap number.
 */
function lapStarted(prev: { lap: number; d: number; t: number }, c: CarRow, len: number): boolean {
  if (c.lap !== prev.lap) return true;
  const timerReset = c.currentLapMs + 1000 < prev.t;
  const crossedLine = c.lapDistance < 300 && (prev.d < 0 || prev.d > len - 300);
  return timerReset && crossedLine;
}

/** Per-car mini-sector timing state. Best times use 0 for "none yet" (JSON-safe). */
interface CarMini {
  lap: number;
  lastD: number;
  lastT: number;
  startT: (number | null)[]; // lap time when each mini sector was entered
  invalid: boolean;
  pb: number[];
  cur: (MiniSector | null)[]; // this lap's mini sectors
  last: (MiniSector | null)[]; // previous lap's
}

/** What happened during a car's current lap, to classify it when it ends. */
interface LapFlags { fromLine: boolean; out: boolean; in: boolean; pit: boolean; invalid: boolean; flashback: boolean }
interface LapStart { fuelKg: number | null; wearPct: number | null }

/** Lap-recording state per car. */
interface Recorder {
  prev: { lap: number; d: number; t: number } | null;
  current: Sample[];
  flags: LapFlags;
  start: LapStart;
  best: Lap | null;
  last: Lap | null;
}

export interface LapHistory {
  type: 'history';
  sessionUid: string;
  outline: (OutlinePoint | null)[];
  cars: Record<number, CarMini>;
  overallBest: number[];
  recorders: Record<number, Recorder>;
  laps: Lap[];
  lapSeq: number;
  playerIdx: number;
}

const freshFlags = (fromLine: boolean): LapFlags => ({ fromLine, out: false, in: false, pit: false, invalid: false, flashback: false });
const emptyMinis = () => new Array<MiniSector | null>(MINI_SECTORS).fill(null);
const NO_MINIS: readonly (MiniSector | null)[] = emptyMinis();

export class LapStore {
  sessionUid = '';
  outline: (OutlinePoint | null)[] = new Array(OUTLINE_BINS).fill(null);
  outlineFilled = 0;
  playerIdx = -1;
  /** Every completed player lap this session, oldest first. */
  laps: Lap[] = [];
  overallBest = new Array<number>(MINI_SECTORS).fill(0);
  private cars: Record<number, CarMini> = {};
  private recorders: Record<number, Recorder> = {};
  private lapSeq = 0;

  private get player(): Recorder | undefined { return this.recorders[this.playerIdx]; }
  /** Player's current lap so far. */
  get current(): Sample[] { return this.player?.current ?? []; }
  get lastLap(): Lap | null { return this.player?.last ?? null; }
  get bestLap(): Lap | null { return this.player?.best ?? null; }
  /** Player's mini sectors on the current lap, and on the lap before. */
  get minis(): readonly (MiniSector | null)[] { return this.cars[this.playerIdx]?.cur ?? NO_MINIS; }
  get lastMinis(): readonly (MiniSector | null)[] { return this.cars[this.playerIdx]?.last ?? NO_MINIS; }

  /** Every other driver's fastest valid lap, fastest first. */
  driverBests(): Lap[] {
    return Object.entries(this.recorders)
      .filter(([idx, r]) => Number(idx) !== this.playerIdx && r.best)
      .map(([, r]) => r.best!)
      .sort((a, b) => a.timeMs - b.timeMs);
  }

  update(s: Snapshot) {
    const session = s.session;
    if (!session) return;
    if (session.uid !== this.sessionUid) this.reset(session.uid);
    const len = session.trackLength || 1;
    for (const car of s.cars) {
      if (car.isPlayer) this.playerIdx = car.idx;
      this.timeMiniSectors(car, len);
      this.learnOutline(car, len);
      this.record(car, session);
    }
  }

  /** Records the car's telemetry along the lap and archives the lap when it ends. */
  private record(car: CarRow, session: SessionInfo) {
    const r = (this.recorders[car.idx] ??= {
      prev: null, current: [], flags: freshFlags(false), start: { fuelKg: null, wearPct: null }, best: null, last: null,
    });
    const prev = r.prev;
    r.prev = { lap: car.lap, d: car.lapDistance, t: car.currentLapMs };
    if (!prev || lapStarted(prev, car, session.trackLength || 1)) {
      if (prev && r.current.length > 20) this.archive(r, prev, car, session);
      r.current = [];
      // A lap only counts if we saw it start at the line.
      r.flags = freshFlags(!!prev);
      r.start = prev ? { fuelKg: car.fuelKg, wearPct: car.tyreWearAvg } : { fuelKg: null, wearPct: null };
    }
    if (car.currentLapMs > LAP_START_GRACE_MS) {
      const f = r.flags;
      if (car.pitStatus !== 0 || car.driverStatus === 0) f.pit = true;
      if (car.driverStatus === 3) f.out = true;
      if (car.driverStatus === 2) f.in = true;
      if (car.currentLapInvalid) f.invalid = true;
    }
    if (car.lapDistance < 0) return;
    const last = r.current.at(-1);
    if (last && car.lapDistance < last.d - 50) {
      // Flashback / rewind: drop samples past the new position.
      r.current = r.current.filter((x) => x.d <= car.lapDistance);
      r.flags.flashback = true;
    }
    if (!last || car.lapDistance > last.d) {
      r.current.push({
        d: car.lapDistance, t: car.currentLapMs, speed: car.speed,
        throttle: car.throttle, brake: car.brake, gear: car.gear,
        ers: car.ersStoreJ, mode: car.ersDeployMode,
      });
    }
  }

  private archive(r: Recorder, prev: { lap: number; t: number }, car: CarRow, session: SessionInfo) {
    const f = r.flags;
    // Crossing the line normally increments the lap; a timer reset without it follows the pits.
    const finished = car.lap === prev.lap + 1;
    const kind: LapKind = f.out ? 'out'
      : f.in ? 'in'
      : f.pit ? 'pit'
      : !f.fromLine ? 'partial'
      : f.invalid || f.flashback || !finished || r.current[0].d >= 200 ? 'invalid'
      : 'timed';
    const lap = summariseLap(r.current, {
      id: ++this.lapSeq,
      carIdx: car.idx,
      lap: prev.lap,
      kind,
      timeMs: finished ? car.lastLapMs : Math.round(prev.t),
      trackLength: session.trackLength,
      sector2Start: session.sector2Start,
      sector3Start: session.sector3Start,
      minis: this.cars[car.idx]?.last ?? emptyMinis(),
      fuelStartKg: r.start.fuelKg,
      fuelEndKg: car.fuelKg,
      wearStartPct: r.start.wearPct,
      wearEndPct: car.tyreWearAvg,
      compound: car.compound,
      tyreAge: car.tyreAge,
    });
    if (kind === 'timed' && lap.timeMs > 0 && (!r.best || lap.timeMs < r.best.timeMs)) r.best = lap;
    // Other drivers only keep their fastest lap; the player keeps every lap.
    if (!car.isPlayer) return;
    r.last = lap;
    this.laps.push(lap);
    if (this.laps.length > MAX_LAPS) {
      const drop = this.laps.findIndex((l) => l.id !== r.best?.id);
      this.laps.splice(drop, 1);
    }
  }

  /**
   * Learns the circuit from car positions. Points from timed laps are trusted:
   * out/in-lap data (pit entry and exit roads) can only fill empty bins, never
   * change a timed-lap point, and timed-lap data always replaces it. Timed points
   * keep a confidence count so a single stray pass can't bend the track either.
   */
  private learnOutline(car: CarRow, len: number) {
    if (car.pitStatus !== 0 || car.driverStatus === 0 || car.lapDistance < 0 || (car.x === 0 && car.z === 0)) return;
    const bin = Math.floor((car.lapDistance / len) * OUTLINE_BINS);
    if (bin < 0 || bin >= OUTLINE_BINS) return;
    const timed = onTimedLap(car);
    const cur = this.outline[bin];
    const fresh = { x: car.x, z: car.z, n: 1, timed };
    if (!cur) {
      this.outline[bin] = fresh;
      this.outlineFilled++;
    } else if (timed && !cur.timed) {
      this.outline[bin] = fresh;
    } else if (timed !== cur.timed) {
      // untimed data never touches a timed point
    } else if (Math.hypot(car.x - cur.x, car.z - cur.z) <= OUTLINE_MATCH_M) {
      cur.n = Math.min(cur.n + 1, OUTLINE_MAX_CONFIDENCE);
      cur.x += (car.x - cur.x) / cur.n;
      cur.z += (car.z - cur.z) / cur.n;
    } else if (timed && --cur.n <= 0) {
      this.outline[bin] = fresh;
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
        pb: new Array(MINI_SECTORS).fill(0), cur: emptyMinis(), last: emptyMinis(),
      };
      return;
    }

    if (lapStarted({ lap: m.lap, d: m.lastD, t: m.lastT }, car, len)) {
      const nextLap = car.lap === m.lap + 1;
      const atLine = nextLap || car.lap === m.lap; // same lap number = timer reset at the line
      const lastStart = m.startT[MINI_SECTORS - 1];
      if (nextLap && lastStart !== null && car.lastLapMs > 0) {
        this.completeMini(m, MINI_SECTORS - 1, car.lastLapMs - lastStart);
      }
      m.last = m.cur;
      m.cur = emptyMinis();
      m.lap = car.lap;
      m.invalid = false;
      m.startT = new Array(MINI_SECTORS).fill(null);
      if (atLine) m.startT[0] = 0;
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

    // Out-laps, in-laps and pit/garage time don't count towards mini-sector bests.
    if (car.currentLapInvalid || (car.currentLapMs > LAP_START_GRACE_MS && !onTimedLap(car))) m.invalid = true;
    const d = car.lapDistance, t = car.currentLapMs;
    if (d > m.lastD) {
      for (let k = Math.max(1, Math.floor(m.lastD / seg) + 1); k < MINI_SECTORS && k * seg <= d; k++) {
        const b = k * seg;
        const tb = m.lastT + ((b - m.lastD) / (d - m.lastD)) * (t - m.lastT);
        const start = m.startT[k - 1];
        if (start !== null) this.completeMini(m, k - 1, tb - start);
        m.startT[k] = tb;
      }
    }
    m.lastD = d;
    m.lastT = t;
  }

  private completeMini(m: CarMini, k: number, ms: number) {
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
    m.cur[k] = { ms, colour };
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
    // Other cars' in-progress laps are left out to keep this small; a browser
    // that joins mid-lap just records those laps as invalid (partial) itself.
    const recorders: Record<number, Recorder> = {};
    for (const [idx, r] of Object.entries(this.recorders)) {
      recorders[Number(idx)] = Number(idx) === this.playerIdx ? r : { ...r, current: [] };
    }
    const { sessionUid, outline, cars, overallBest, laps, lapSeq, playerIdx } = this;
    return { type: 'history', sessionUid, outline, cars, overallBest, recorders, laps, lapSeq, playerIdx };
  }

  loadHistory(h: LapHistory) {
    this.sessionUid = h.sessionUid;
    this.outline = h.outline;
    this.outlineFilled = h.outline.filter(Boolean).length;
    this.cars = h.cars;
    this.overallBest = h.overallBest;
    this.recorders = h.recorders;
    this.laps = h.laps;
    this.lapSeq = h.lapSeq;
    this.playerIdx = h.playerIdx;
  }

  private reset(uid: string) {
    this.sessionUid = uid;
    this.outline = new Array(OUTLINE_BINS).fill(null);
    this.outlineFilled = 0;
    this.playerIdx = -1;
    this.laps = [];
    this.overallBest = new Array(MINI_SECTORS).fill(0);
    this.cars = {};
    this.recorders = {};
    this.lapSeq = 0;
  }
}
