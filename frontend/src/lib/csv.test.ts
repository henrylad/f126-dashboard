import { describe, expect, it } from 'vitest';
import { lapSummaryCsv, lapsCsv, toCsv, windowCsv } from './csv.ts';
import { lap } from '../laps/testLaps.ts';
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

describe('lapsCsv', () => {
  it('writes every sample with steering, revs, G-forces and slip', () => {
    const l = lap(7, 82_000, []);
    l.samples[1] = { ...l.samples[1], steer: -0.25, gLat: 3.1, gLon: -4.2, slipRear: 6.5 };
    const [header, , second] = lapsCsv([{ lap: l, label: 'L7' }]).trim().split('\n');
    expect(header).toBe('lap,lap_number,kind,lap_time_ms,distance_m,time_ms,speed_kmh,throttle,brake,gear,rpm,steer,g_lat,g_lon,ers_j,ers_mode,slip_front_pct,slip_rear_pct');
    expect(second).toBe('L7,7,timed,82000,1000,82000,200,1,0,7,11000,-0.25,3.1,-4.2,3000000,1,,6.5');
  });
});

describe('lapSummaryCsv', () => {
  it('writes one row per lap with sectors, energy in MJ and the compound name', () => {
    const l = { ...lap(3, 81_500, []), sectors: [27_000.4, 30_000, 24_500] as [number, number, number] };
    l.stats = { ...l.stats, deployedJ: 3_000_000, harvestedJ: 2_500_000 };
    const rows = lapSummaryCsv([{ lap: l, label: 'L3', group: 'yours' }]).trim().split('\n');
    expect(rows).toHaveLength(2);
    const cells = Object.fromEntries(rows[0].split(',').map((k, i) => [k, rows[1].split(',')[i]]));
    expect(cells).toMatchObject({ group: 'yours', lap: 'L3', s1_ms: '27000', s3_ms: '24500', deployed_mj: '3', net_mj: '-0.5', compound: 'medium', saved_at: '' });
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
