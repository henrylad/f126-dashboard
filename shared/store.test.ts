import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LapStore, MINI_SECTORS } from './store.ts';
import type { CarRow, Snapshot } from './types.ts';

const LEN = 2500; // 25 mini sectors of 100 m

/** Drives cars at constant speeds (m/s per lap) and feeds 30 Hz snapshots. */
function drive(store: LapStore, speeds: number[][], seconds: number) {
  const dt = 1 / 30;
  const dist = speeds.map(() => 0);
  const lapStart = speeds.map(() => 0);
  const lastLap = speeds.map(() => 0);
  for (let t = 0; t <= seconds; t += dt) {
    const cars = speeds.map((perLap, i) => {
      const lap = Math.floor(dist[i] / LEN) + 1;
      return { idx: i, lap, lapDistance: dist[i] - (lap - 1) * LEN, currentLapMs: (t - lapStart[i]) * 1000, lastLapMs: lastLap[i], isPlayer: i === 0, currentLapInvalid: false, pitStatus: 0, x: 0, z: 0 } as CarRow;
    });
    store.update({ session: { uid: 'u', trackLength: LEN }, cars, player: null } as unknown as Snapshot);
    speeds.forEach((perLap, i) => {
      const before = Math.floor(dist[i] / LEN);
      dist[i] += perLap[Math.min(before, perLap.length - 1)] * dt;
      if (Math.floor(dist[i] / LEN) > before) {
        // exact crossing time so lastLapMs is correct
        const over = (dist[i] - Math.floor(dist[i] / LEN) * LEN) / perLap[Math.min(before, perLap.length - 1)];
        const cross = t + dt - over;
        lastLap[i] = Math.round((cross - lapStart[i]) * 1000);
        lapStart[i] = cross;
      }
    });
  }
}

test('mini sectors are timed to the millisecond and coloured', () => {
  const store = new LapStore();
  // Player: 50 m/s on lap 1, 55 m/s on lap 2. Rival: always 40 m/s.
  drive(store, [[50, 55], [40]], 50 + 30);

  const lap1 = store.lastMinis;
  // Lap 1 mini sector 0 wasn't observed from its start; the rest are 100 m / 50 m/s.
  assert.equal(lap1[0], null);
  for (let k = 1; k < MINI_SECTORS; k++) {
    assert.ok(Math.abs(lap1[k]!.ms - 2000) < 2, `lap 1 mini ${k}: ${lap1[k]!.ms}`);
    assert.equal(lap1[k]!.colour, 3, 'first flying times are fastest overall');
  }
  // Lap 2 in progress at 55 m/s: faster than everything → purple, timed from the line.
  const done = store.minis.filter(Boolean);
  assert.ok(done.length > 5);
  // The test model drives the step that crosses the line at the old speed (≤3 ms off).
  assert.ok(Math.abs(store.minis[0]!.ms - 100000 / 55) < 5, `lap 2 mini 0: ${store.minis[0]!.ms}`);
  for (const m of done) assert.equal(m!.colour, 3);
});

test('a slower lap shows yellow, a PB that is not overall shows green', () => {
  const store = new LapStore();
  // Rival sets 55 m/s from lap 1; player does 50 then 45 then 52.
  drive(store, [[50, 45, 52], [55]], 50 + 2500 / 45 + 30);
  // Mini 0 had no lap-1 time (not seen from its start), so it is a first PB; skip it.
  const slow = store.lastMinis.slice(1).filter(Boolean);
  assert.ok(slow.length > 20);
  for (const m of slow) assert.equal(m!.colour, 1, 'slower than PB → yellow');
  const pb = store.minis.filter(Boolean);
  assert.ok(pb.length > 5);
  for (const m of pb) assert.equal(m!.colour, 2, 'PB but rival is faster → green');
});
