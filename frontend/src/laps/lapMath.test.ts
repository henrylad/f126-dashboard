import { describe, expect, it } from 'vitest';
import { interpolate, theoreticalBest } from './lapMath.ts';
import { lap, sample } from './testLaps.ts';


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
