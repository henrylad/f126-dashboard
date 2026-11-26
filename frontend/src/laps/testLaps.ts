// Builders for laps in tests.
import type { Lap, Sample } from './lapMath.ts';

export const sample = (d: number, t: number, speed = 200): Sample => ({ d, t, speed, throttle: 1, brake: 0, gear: 7, ers: 3e6, mode: 1, steer: 0, rpm: 11000, gLat: 0, gLon: 0, slipFront: null, slipRear: null });

/** A lap with two samples (or the given ones) and plain stats. */
export function lap(id: number, timeMs: number, minis: number[], kind: Lap['kind'] = 'timed', samples?: Sample[]): Lap {
  return {
    id, carIdx: 0, lap: id, kind, timeMs,
    sectors: [null, null, null],
    samples: samples ?? [sample(0, 0), sample(1000, timeMs)],
    minis: minis.map((ms) => ({ ms, colour: 1 as const })),
    stats: {
      topSpeed: 300, avgSpeed: 200, fullThrottlePct: 60, brakingPct: 10, deployedJ: 0, harvestedJ: 0, boostPct: 0,
      ersStartJ: 0, ersEndJ: 0, fuelUsedKg: null, wearDeltaPct: null, compound: 17, tyreAge: 1, gearChanges: 0,
    },
  };
}
