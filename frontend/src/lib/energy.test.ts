import { describe, expect, it } from 'vitest';
import type { Sample } from '../laps/lapMath.ts';
import { energyBins, energyState } from './energy.ts';

const s = (d: number, ers: number, mode = 1): Sample => ({ d, t: d, speed: 200, throttle: 1, brake: 0, gear: 7, ers, mode });

describe('energyState', () => {
  it('reads a rising store as harvesting, whatever the mode', () => {
    expect(energyState(s(0, 1e6, 3), s(1, 1e6 + 5000, 3))).toBe('harvest');
  });

  it('names deployment by mode', () => {
    expect(energyState(s(0, 1e6, 1), s(1, 1e6 - 5000, 1))).toBe('medium');
    expect(energyState(s(0, 1e6, 2), s(1, 1e6 - 5000, 2))).toBe('hotlap');
  });

  it('shows Boost wherever it is selected', () => {
    expect(energyState(s(0, 1e6, 3), s(1, 1e6, 3))).toBe('boost');
  });

  it('treats tiny changes as no flow', () => {
    expect(energyState(s(0, 1e6), s(1, 1e6 - 100))).toBeNull();
  });
});

describe('energyBins', () => {
  it('maps samples to bins along the lap', () => {
    const bins = energyBins([s(0, 1e6), s(50, 1e6 + 5000), s(60, 1e6 - 5000)], 100, 2);
    expect(bins).toEqual([null, 'harvest']);
  });
});
