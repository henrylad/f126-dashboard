// A rolling, time-based record of the player's telemetry for the Telemetry tab.
// Lap charts elsewhere are on lap distance; this one is on session time, so it
// keeps running through pit stops, out-laps and the formation lap.
import type { Snapshot } from '../../api/types.ts';

export interface TSample {
  t: number; // session time, s
  lap: number;
  /** Lap distance in metres; negative before the line on the grid. */
  d: number;
  speed: number;
  throttle: number;
  brake: number;
  steer: number;
  gear: number;
  rpm: number;
  ers: number; // J
  mode: number; // ERS deploy mode
  /** Battery flow in kW from the store's change: above zero deploys, below zero harvests. */
  flowKw: number;
  iceKw: number;
  mgukKw: number;
  gLat: number;
  gLon: number;
  /** Ride height in mm, null without extended motion. */
  frontMm: number | null;
  rearMm: number | null;
  /** Mean slip ratio per axle in %, null without extended motion. */
  slipFront: number | null;
  slipRear: number | null;
}

/** The longest window the tab offers. */
export const KEEP_S = 120;

export class TelemetryHistory {
  samples: TSample[] = [];
  private session = '';
  private flow = 0;

  /** Adds the snapshot's player state if it is new. */
  push(snap: Snapshot) {
    const p = snap.player;
    if (!p || !snap.session) return;
    const t = snap.sessionTime;
    const last = this.samples.at(-1);
    // A new session, or a replay looping back to its start.
    if (snap.session.uid !== this.session || (last && t < last.t - 1)) {
      this.samples = [];
      this.session = snap.session.uid;
      this.flow = 0;
    } else if (last && t <= last.t) {
      return; // no new packet since the last tick
    }

    if (last) {
      const dt = t - last.t;
      const raw = dt > 0 && dt < 1 ? -(p.ersStoreJ - last.ers) / dt / 1000 : 0;
      // Light smoothing: the store moves in steps between status packets.
      this.flow += (raw - this.flow) * 0.35;
    }
    const c = p.chassis;
    this.samples.push({
      t,
      lap: p.lap,
      d: p.lapDistance,
      speed: p.speed,
      throttle: p.throttle,
      brake: p.brake,
      steer: p.steer,
      gear: p.gear,
      rpm: p.rpm,
      ers: p.ersStoreJ,
      mode: p.ersDeployMode,
      flowKw: last ? this.flow : 0,
      iceKw: p.powerIceW / 1000,
      mgukKw: p.powerMgukW / 1000,
      gLat: p.gLat,
      gLon: p.gLon,
      frontMm: c ? c.frontAeroHeight * 1000 : null,
      rearMm: c ? c.rearAeroHeight * 1000 : null,
      slipFront: c ? ((c.wheelSlipRatio[2] + c.wheelSlipRatio[3]) / 2) * 100 : null,
      slipRear: c ? ((c.wheelSlipRatio[0] + c.wheelSlipRatio[1]) / 2) * 100 : null,
    });

    const cutoff = t - KEEP_S;
    let drop = 0;
    while (drop < this.samples.length && this.samples[drop].t < cutoff) drop++;
    if (drop > 256) this.samples = this.samples.slice(drop); // trim in batches
  }

  /** The newest sample at or before t. */
  at(t: number): TSample | null {
    const s = this.samples;
    if (!s.length || t < s[0].t) return null;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid].t <= t) lo = mid; else hi = mid - 1;
    }
    return s[lo];
  }
}
