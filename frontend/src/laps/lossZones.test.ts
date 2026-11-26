import { describe, expect, it } from 'vitest';
import type { Sample } from './lapMath.ts';
import { deltaTo, hasTelemetry, verdict } from './lossZones.ts';
import { lap } from './lapMath.test.ts';

const LEN = 4000;

/** A lap at a constant 50 m/s, except `slowFrom`–`slowTo` at 25 m/s. */
function trace(slowFrom = -1, slowTo = -1): Sample[] {
  const out: Sample[] = [];
  let t = 0;
  for (let d = 0; d <= LEN; d += 10) {
    const v = d > slowFrom && d <= slowTo ? 25 : 50;
    if (d > 0) t += (10 / v) * 1000;
    out.push({ d, t, speed: v * 3.6, throttle: v === 50 ? 1 : 0.4, brake: 0, gear: 7, ers: 3e6, mode: 1 });
  }
  return out;
}

describe('verdict', () => {
  const ref = trace();
  const slow = trace(1500, 1700);
  const refLap = lap(1, ref.at(-1)!.t, [], 'timed', ref);
  const slowLap = lap(2, slow.at(-1)!.t, [], 'timed', slow);

  it('states the lap-time gap', () => {
    expect(verdict(slowLap, refLap, LEN, 1300, 2600).gapMs).toBeCloseTo(4000, 0);
  });

  it('puts the biggest loss where the lap was slower', () => {
    const [zone] = verdict(slowLap, refLap, LEN, 1300, 2600).losses;
    expect(zone.from).toBeLessThanOrEqual(1500);
    expect(zone.to).toBeGreaterThanOrEqual(1700);
    expect(zone.ms).toBeCloseTo(4000, -2);
    expect(zone.sector).toBe(2);
  });

  it('finds nothing to lose against itself', () => {
    expect(verdict(refLap, refLap, LEN, 1300, 2600).losses).toEqual([]);
  });
});

describe('deltaTo', () => {
  it('ends on the lap-time gap', () => {
    const ref = lap(1, 80_000, [], 'timed', trace());
    const other = lap(2, 80_500, [], 'timed', trace());
    expect(deltaTo(other, ref, LEN).at(-1)).toEqual({ d: LEN, ms: 500 });
  });
});

describe('hasTelemetry', () => {
  it('rejects laps whose telemetry is private (all zeros)', () => {
    const zeros = trace().map((s) => ({ ...s, speed: 0 }));
    expect(hasTelemetry(lap(1, 1, [], 'timed', zeros))).toBe(false);
    expect(hasTelemetry(lap(1, 1, [], 'timed', trace()))).toBe(true);
  });
});
