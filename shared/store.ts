// Accumulated history: the track outline (learned from car positions), the
// player's per-lap traces, and mini-sector times for every car. The server keeps
// one so a browser that connects mid-session gets the history; each browser then
// keeps extending its own copy.
import type { CarRow, PlayerDetail, SessionInfo, Snapshot } from './types.ts';
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
}

export interface LapHistory {
  type: 'history';
  sessionUid: string;
  outline: (OutlinePoint | null)[];
  current: Sample[];
  currentLap: number;
  lastLap: Lap | null;
  bestLap: Lap | null;
  cars: Record<number, CarMini>;
  overallBest: number[];
  minis: (MiniSector | null)[];
  lastMinis: (MiniSector | null)[];
  playerPrev: { lap: number; d: number; t: number } | null;
  laps: Lap[];
  lapSeq: number;
  lapFlags: LapFlags;
  lapStart: LapStart;
}

/** What happened during the current player lap, to classify it when it ends. */
interface LapFlags { fromLine: boolean; out: boolean; in: boolean; pit: boolean; invalid: boolean; flashback: boolean }
interface LapStart { fuelKg: number | null; wearPct: number | null }

const freshFlags = (fromLine: boolean): LapFlags => ({ fromLine, out: false, in: false, pit: false, invalid: false, flashback: false });
const avgWear = (p: PlayerDetail) => p.tyresWear.reduce((a, b) => a + b, 0) / 4;

const emptyMinis = () => new Array<MiniSector | null>(MINI_SECTORS).fill(null);

export class LapStore {
  sessionUid = '';
  outline: (OutlinePoint | null)[] = new Array(OUTLINE_BINS).fill(null);
  outlineFilled = 0;
  private playerPrev: { lap: number; d: number; t: number } | null = null;
  private lapFlags = freshFlags(false);
  private lapStart: LapStart = { fuelKg: null, wearPct: null };
  private lapSeq = 0;
  /** Every completed player lap this session, oldest first. */
  laps: Lap[] = [];
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
      this.learnOutline(car, len);
    }

    const p = s.player;
    const row = s.cars.find((c) => c.isPlayer);
    if (!p || !row) return;
    const prev = this.playerPrev;
    this.playerPrev = { lap: row.lap, d: row.lapDistance, t: row.currentLapMs };
    if (!prev || lapStarted(prev, row, len)) {
      if (prev && this.current.length > 20) this.archiveLap(prev, row, p, session);
      this.current = [];
      this.currentLap = row.lap;
      // A lap only counts if we saw it start at the line.
      this.lapFlags = freshFlags(!!prev);
      this.lapStart = prev ? { fuelKg: p.fuelKg, wearPct: avgWear(p) } : { fuelKg: null, wearPct: null };
    }
    if (row.currentLapMs > LAP_START_GRACE_MS) {
      const f = this.lapFlags;
      if (row.pitStatus !== 0 || row.driverStatus === 0) f.pit = true;
      if (row.driverStatus === 3) f.out = true;
      if (row.driverStatus === 2) f.in = true;
      if (row.currentLapInvalid) f.invalid = true;
    }
    if (p.lapDistance < 0) return;
    const last = this.current.at(-1);
    if (last && p.lapDistance < last.d - 50) {
      // Flashback / rewind: drop samples past the new position.
      this.current = this.current.filter((x) => x.d <= p.lapDistance);
      this.lapFlags.flashback = true;
    }
    if (!last || p.lapDistance > last.d) {
      this.current.push({
        d: p.lapDistance, t: p.currentLapMs, speed: p.speed,
        throttle: p.throttle, brake: p.brake, gear: p.gear,
        ers: p.ersStoreJ, mode: p.ersDeployMode,
      });
    }
  }

  private archiveLap(prev: { lap: number; t: number }, row: CarRow, p: PlayerDetail, session: SessionInfo) {
    const f = this.lapFlags;
    // Crossing the line normally increments the lap; a timer reset without it follows the pits.
    const finished = row.lap === prev.lap + 1;
    const kind: LapKind = f.out ? 'out'
      : f.in ? 'in'
      : f.pit ? 'pit'
      : !f.fromLine ? 'partial'
      : f.invalid || f.flashback || !finished || this.current[0].d >= 200 ? 'invalid'
      : 'timed';
    const lap = summariseLap(this.current, {
      id: ++this.lapSeq,
      lap: prev.lap,
      kind,
      timeMs: finished ? row.lastLapMs : Math.round(prev.t),
      trackLength: session.trackLength,
      sector2Start: session.sector2Start,
      sector3Start: session.sector3Start,
      minis: this.lastMinis,
      fuelStartKg: this.lapStart.fuelKg,
      fuelEndKg: p.fuelKg,
      wearStartPct: this.lapStart.wearPct,
      wearEndPct: avgWear(p),
      compound: p.visualCompound,
      tyreAge: p.tyreAge,
    });
    this.laps.push(lap);
    if (this.laps.length > MAX_LAPS) {
      const drop = this.laps.findIndex((l) => l.id !== this.bestLap?.id);
      this.laps.splice(drop, 1);
    }
    this.lastLap = lap;
    if (kind === 'timed' && lap.timeMs > 0 && (!this.bestLap || lap.timeMs < this.bestLap.timeMs)) this.bestLap = lap;
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
        pb: new Array(MINI_SECTORS).fill(0),
      };
      return;
    }

    if (lapStarted({ lap: m.lap, d: m.lastD, t: m.lastT }, car, len)) {
      const nextLap = car.lap === m.lap + 1;
      const atLine = nextLap || car.lap === m.lap; // same lap number = timer reset at the line
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
    const { sessionUid, outline, current, currentLap, lastLap, bestLap, cars, overallBest, minis, lastMinis, playerPrev, laps, lapSeq, lapFlags, lapStart } = this;
    return { type: 'history', sessionUid, outline, current, currentLap, lastLap, bestLap, cars, overallBest, minis, lastMinis, playerPrev, laps, lapSeq, lapFlags, lapStart };
  }

  loadHistory(h: LapHistory) {
    this.sessionUid = h.sessionUid;
    this.outline = h.outline;
    this.outlineFilled = h.outline.filter(Boolean).length;
    this.playerPrev = h.playerPrev;
    this.laps = h.laps;
    this.lapSeq = h.lapSeq;
    this.lapFlags = h.lapFlags;
    this.lapStart = h.lapStart;
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
    this.playerPrev = null;
    this.lapFlags = freshFlags(false);
    this.lapStart = { fuelKg: null, wearPct: null };
    this.lapSeq = 0;
    this.laps = [];
    this.current = [];
    this.currentLap = 0;
    this.lastLap = this.bestLap = null;
    this.cars = {};
    this.overallBest = new Array(MINI_SECTORS).fill(0);
    this.minis = emptyMinis();
    this.lastMinis = emptyMinis();
  }
}

