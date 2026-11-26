import { describe, expect, it } from 'vitest';
import type { PlayerDetail, Snapshot } from '../../api/types.ts';
import { KEEP_S, TelemetryHistory } from './history.ts';

function snap(t: number, ersJ: number, uid = 's1'): Snapshot {
  const player = {
    speed: 250, throttle: 1, brake: 0, steer: 0, gear: 7, rpm: 11000, ersStoreJ: ersJ, ersDeployMode: 1,
    powerIceW: 400_000, powerMgukW: 120_000, gLat: 0, gLon: 0, lap: 2, lapDistance: 100, chassis: null,
  } as unknown as PlayerDetail;
  return { sessionTime: t, session: { uid } as Snapshot['session'], player } as Snapshot;
}

describe('TelemetryHistory', () => {
  it('records one sample per new session time', () => {
    const h = new TelemetryHistory();
    h.push(snap(1, 3e6));
    h.push(snap(1, 3e6));
    h.push(snap(1.1, 3e6));
    expect(h.samples.map((s) => s.t)).toEqual([1, 1.1]);
  });

  it('turns a draining battery into positive (deploying) flow', () => {
    const h = new TelemetryHistory();
    let ers = 3e6;
    for (let i = 0; i < 30; i++) { h.push(snap(i / 30, ers)); ers -= 100_000 / 30; } // 100 kW
    expect(h.samples.at(-1)!.flowKw).toBeCloseTo(100, 0);
  });

  it('turns a filling battery into negative (harvesting) flow', () => {
    const h = new TelemetryHistory();
    let ers = 1e6;
    for (let i = 0; i < 30; i++) { h.push(snap(i / 30, ers)); ers += 200_000 / 30; }
    expect(h.samples.at(-1)!.flowKw).toBeCloseTo(-200, 0);
  });

  it('starts over on a new session or when a replay loops back', () => {
    const h = new TelemetryHistory();
    h.push(snap(50, 3e6));
    h.push(snap(51, 3e6));
    h.push(snap(2, 3e6));
    expect(h.samples.map((s) => s.t)).toEqual([2]);
    h.push(snap(3, 3e6, 's2'));
    expect(h.samples.map((s) => s.t)).toEqual([3]);
  });

  it('forgets samples older than the longest window (trimmed in batches)', () => {
    const h = new TelemetryHistory();
    for (let i = 0; i <= (KEEP_S + 20) * 30; i++) h.push(snap(i / 30, 3e6));
    expect(h.samples[0].t).toBeGreaterThan(5);
    expect(h.samples.at(-1)!.t - h.samples[0].t).toBeLessThan(KEEP_S + 10);
  });

  it('finds the newest sample at or before a time', () => {
    const h = new TelemetryHistory();
    [1, 2, 3].forEach((t) => h.push(snap(t, 3e6)));
    expect(h.at(2.5)?.t).toBe(2);
    expect(h.at(0.5)).toBeNull();
  });
});
