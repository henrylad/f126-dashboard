import { describe, expect, it } from 'vitest';
import { toCsv, windowCsv } from './csv.ts';
import type { TSample } from '../components/telemetry/history.ts';

describe('toCsv', () => {
  it('writes a header and rows', () => {
    expect(toCsv(['a', 'b'], [[1, 'x'], [2.5, null]])).toBe('a,b\n1,x\n2.5,\n');
  });

  it('quotes cells with commas, quotes or newlines', () => {
    expect(toCsv(['n'], [['a,b'], ['say "hi"']])).toBe('n\n"a,b"\n"say ""hi"""\n');
  });

  it('leaves non-finite numbers empty and rounds to 4 decimals', () => {
    expect(toCsv(['v'], [[NaN], [1 / 3]])).toBe('v\n\n0.3333\n');
  });
});

describe('windowCsv', () => {
  const at = (t: number): TSample => ({
    t, lap: 3, d: t * 10, speed: 200, throttle: 1, brake: 0, steer: 0, gear: 7, rpm: 11000, ers: 3e6, mode: 1,
    flowKw: 120, iceKw: 400, mgukKw: 150, gLat: 0, gLon: 0.4, frontMm: null, rearMm: null, slipFront: null, slipRear: null,
  });

  it('keeps only samples inside the window', () => {
    const rows = windowCsv([at(1), at(2), at(3), at(4)], 2, 3).trim().split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[1].startsWith('2,3,20,')).toBe(true);
  });
});
