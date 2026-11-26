// The browser's copy of the server's lap history. The server does all the lap
// analysis; this applies its history and delta messages and answers the questions
// the components ask (current lap, best lap, live delta, ...).
import type { LapDelta, LapHistory, OutlinePoint } from '../api/types.ts';
import { interpolate, type Lap, type MiniSector, type Sample } from './lapMath.ts';

export const OUTLINE_BINS = 800;
export const MINI_SECTORS = 25;

const emptyMinis = () => new Array<MiniSector | null>(MINI_SECTORS).fill(null);

export class LapView {
  sessionUid = '';
  playerIdx = -1;
  outline: (OutlinePoint | null)[] = new Array(OUTLINE_BINS).fill(null);
  outlineFilled = 0;
  /** Every completed player lap this session, oldest first. */
  laps: Lap[] = [];
  /** Player's current lap so far. */
  current: Sample[] = [];
  /** Player's mini sectors on the current lap, and on the lap before. */
  minis: (MiniSector | null)[] = emptyMinis();
  lastMinis: (MiniSector | null)[] = emptyMinis();
  /** Your fastest laps on this track from earlier sessions, fastest first. */
  savedLaps: Lap[] = [];
  private bestLapId: number | null = null;
  private others = new Map<number, Lap>();
  /** Deltas are only meaningful on top of a history. */
  private loaded = false;

  get lastLap(): Lap | null { return this.laps.at(-1) ?? null; }
  get bestLap(): Lap | null { return this.laps.find((l) => l.id === this.bestLapId) ?? null; }

  /** Every other driver's fastest valid lap, fastest first. */
  driverBests(): Lap[] {
    return [...this.others.values()].filter((l) => l.carIdx !== this.playerIdx).sort((a, b) => a.timeMs - b.timeMs);
  }

  loadHistory(h: LapHistory) {
    this.sessionUid = h.sessionUid;
    this.playerIdx = h.playerIdx;
    this.bestLapId = h.playerBestLapId;
    this.laps = h.laps;
    this.others = new Map(h.driverBests.map((l) => [l.carIdx, l]));
    this.outline = h.outline;
    this.outlineFilled = h.outline.filter(Boolean).length;
    this.minis = h.minis;
    this.lastMinis = h.lastMinis;
    this.current = h.current;
    this.savedLaps = h.savedLaps ?? [];
    this.loaded = true;
  }

  /** Applies a delta. Idempotent: a delta already contained in the history changes nothing. */
  applyDelta(d: LapDelta) {
    if (!this.loaded) return;
    this.playerIdx = d.playerIdx;
    this.bestLapId = d.playerBestLapId;
    this.minis = d.minis;
    this.lastMinis = d.lastMinis;

    // Components redraw on every snapshot, so these are updated in place.
    this.current.length = Math.min(d.current.from, this.current.length);
    this.current.push(...d.current.samples);

    if (d.removedLapIds.length || d.addedLaps.length) {
      const removed = new Set(d.removedLapIds);
      const known = new Set(this.laps.map((l) => l.id));
      this.laps = [...this.laps.filter((l) => !removed.has(l.id)), ...d.addedLaps.filter((l) => !known.has(l.id))];
    }
    for (const l of d.driverBests) this.others.set(l.carIdx, l);
    for (const p of d.outline) {
      if (!this.outline[p.i]) this.outlineFilled++;
      this.outline[p.i] = { x: p.x, z: p.z };
    }
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
}
