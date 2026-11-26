import { describe, expect, it } from 'vitest';
import { interpolate, theoreticalBest, type Lap, type Sample } from './lapMath.ts';

const sample = (d: number, t: number, speed = 200): Sample => ({ d, t, speed, throttle: 1, brake: 0, gear: 7, ers: 3e6, mode: 1 });

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

describe('interpolate', () => {
  const s = [sample(0, 0, 100), sample(100, 1000, 200), sample(200, 2000, 300)];

  it('interpolates linearly between the samples around a distance', () => {
    expect(interpolate(s, 50, 'speed')).toBe(150);
    expect(interpolate(s, 150, 't')).toBe(1500);
  });

  it('hits samples exactly', () => {
    expect(interpolate(s, 100, 'speed')).toBe(200);
  });

  it('is null outside the samples', () => {
    expect(interpolate(s, -1, 'speed')).toBeNull();
    expect(interpolate(s, 201, 'speed')).toBeNull();
    expect(interpolate([], 0, 'speed')).toBeNull();
  });
});

describe('theoreticalBest', () => {
  it('adds up the best mini sector of every timed lap', () => {
    const laps = [lap(1, 0, [10, 20, 30]), lap(2, 0, [12, 18, 31]), lap(3, 0, [1, 1, 1], 'invalid')];
    expect(theoreticalBest(laps)).toBe(10 + 18 + 30);
  });

  it('needs at least one timed lap', () => {
    expect(theoreticalBest([lap(1, 0, [1, 2], 'out')])).toBeNull();
  });
});
