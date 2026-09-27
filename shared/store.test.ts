import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LapStore, MINI_SECTORS, OUTLINE_BINS } from './store.ts';
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
      return { idx: i, lap, lapDistance: dist[i] - (lap - 1) * LEN, currentLapMs: (t - lapStart[i]) * 1000, lastLapMs: lastLap[i], isPlayer: i === 0, currentLapInvalid: false, pitStatus: 0, driverStatus: 4, x: 0, z: 0 } as CarRow;
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

// --- pit lane / out-lap scenario -------------------------------------------

type CarState = Partial<CarRow> & { lap: number; lapDistance: number; currentLapMs: number };

let fuel = 50, wear = 0;

/** Player-only session on a straight "track" along x, so position = lap distance. */
function frame(store: LapStore, c: CarState, offsetZ = 0) {
  const car = {
    idx: 0, isPlayer: true, currentLapInvalid: false, pitStatus: 0, driverStatus: 1, lastLapMs: 0,
    x: c.lapDistance, z: offsetZ, ...c,
  } as CarRow;
  const player = {
    lapDistance: car.lapDistance, currentLapMs: car.currentLapMs, lap: car.lap, speed: 180, throttle: 1, brake: 0, gear: 7,
    // Battery drains 1 kJ per metre in the first half of each lap (Boost there), charges in the second half.
    ersStoreJ: 3e6 - Math.min(car.lapDistance, LEN / 2) * 1000 + Math.max(0, car.lapDistance - LEN / 2) * 1000,
    ersDeployMode: car.lapDistance < LEN / 2 ? 3 : 1,
    fuelKg: fuel, tyresWear: [wear, wear, wear, wear], visualCompound: 16, tyreAge: 3,
  };
  fuel -= 0.001;
  wear += 0.0005;
  store.update({ session: { uid: 'pits', trackLength: LEN, sector2Start: 1000, sector3Start: 2000 }, cars: [car], player } as unknown as Snapshot);
}

/** Garage → pit lane → out-lap → line crossed with a timer reset (same lap number) → 2 flying laps → in-lap. */
function pitScenario(store: LapStore, flyingLaps = 2) {
  const dt = 1000 / 30;
  let t = 0;
  // Garage: 3 s parked 60 m off the track.
  for (let i = 0; i < 90; i++) frame(store, { lap: 1, lapDistance: LEN - 400, currentLapMs: (t += dt), driverStatus: 0, pitStatus: 2 }, 60);
  // Pit lane (flagged) then the pit-exit road (not flagged), 30 m off the track.
  for (let d = LEN - 400; d < LEN - 100; d += 22 / 30) frame(store, { lap: 1, lapDistance: d, currentLapMs: (t += dt), driverStatus: 3, pitStatus: 1 }, 30);
  for (let d = LEN - 100; d < LEN; d += 30 / 30) frame(store, { lap: 1, lapDistance: d, currentLapMs: (t += dt), driverStatus: 3 }, 30 * (LEN - d) / 100);
  // Cross the line: timer resets, lap number unchanged, status still "out lap" briefly.
  let lap = 1, lastLapMs = 0;
  t = 0;
  for (let n = 0; n < flyingLaps; n++) {
    // 50 m/s: frame f is at f × 1.667 m and f × 33.3 ms, so the lap takes exactly 50 s.
    for (let f = 0; f * 50 / 30 < LEN; f++) {
      frame(store, { lap, lapDistance: (f * 50) / 30, currentLapMs: f * dt, driverStatus: f * dt < 500 && n === 0 ? 3 : 1, lastLapMs });
    }
    lastLapMs = 50_000;
    t = 0;
    lap++;
  }
  // In-lap into the pit entry road (not flagged yet), 25 m off the track.
  for (let d = 0; d < LEN - 300; d += 50 / 30) frame(store, { lap, lapDistance: d, currentLapMs: (t += dt), driverStatus: 2, lastLapMs });
  for (let d = LEN - 300; d < LEN - 50; d += 25 / 30) frame(store, { lap, lapDistance: d, currentLapMs: (t += dt), driverStatus: 2, lastLapMs }, 25);
}

test('first flying lap after an out-lap is fully timed, even when the lap number does not change at the line', () => {
  const store = new LapStore();
  pitScenario(store);
  // lastMinis now holds flying lap 2 (in-lap is current); check flying lap 1 via the best lap.
  const best = store.bestLap!;
  assert.ok(best, 'a best lap exists');
  assert.equal(best.lap, 1);
  assert.ok(Math.abs(best.timeMs - 50_000) < 50, `best lap is the flying lap, not the out-lap: ${best.timeMs}`);
  assert.equal(best.minis.filter(Boolean).length, MINI_SECTORS, 'all 25 mini sectors timed, including the first');
  for (const m of best.minis) {
    assert.ok(Math.abs(m!.ms - 2000) < 5, `mini ${m!.ms}`);
    assert.equal(m!.colour, 3, 'first flying lap sets purple');
  }
});

test('out-lap and in-lap mini sectors are not counted', () => {
  const store = new LapStore();
  pitScenario(store);
  const inLap = store.minis.filter(Boolean);
  assert.ok(inLap.length > 5);
  for (const m of inLap) assert.equal(m!.colour, 0, 'in-lap is grey');
  // Out-lap pit exit road sector must not have set a (slow) best: flying lap was purple everywhere.
  assert.ok(store.bestLap!.minis.every((m) => m!.colour === 3));
});

test('the track map survives the garage, pit lane and pit entry road', () => {
  const store = new LapStore();
  pitScenario(store);
  const off = store.outline.filter((p) => p && Math.abs(p.z) > 5);
  assert.equal(off.length, 0, `${off.length} outline points pulled off the track`);
  assert.ok(store.outlineFilled > OUTLINE_BINS * 0.95);
});

test('with only one flying lap before pitting, the pit entry road still cannot bend the map', () => {
  const store = new LapStore();
  pitScenario(store, 1);
  const off = store.outline.filter((p) => p && Math.abs(p.z) > 5);
  assert.equal(off.length, 0, `${off.length} outline points pulled off the track`);
});

test('every lap is archived with its kind, sectors and stats', () => {
  const store = new LapStore();
  pitScenario(store);
  const kinds = store.laps.map((l) => l.kind);
  assert.deepEqual(kinds, ['out', 'timed', 'timed'], 'out-lap from the garage, then two flying laps');
  const [, fly1, fly2] = store.laps;
  assert.notEqual(fly1.id, fly2.id);
  // 50 m/s with sectors at 1000 m and 2000 m → 20 s, 20 s, 10 s.
  for (const lap of [fly1, fly2]) {
    assert.equal(lap.timeMs, 50_000);
    const [s1, s2, s3] = lap.sectors;
    assert.ok(Math.abs(s1! - 20_000) < 40 && Math.abs(s2! - 20_000) < 40 && Math.abs(s3! - 10_000) < 40, `sectors ${lap.sectors}`);
    assert.ok(Math.abs(lap.stats.boostPct - 50) < 1, `boost ${lap.stats.boostPct}`);
    assert.ok(Math.abs(lap.stats.deployedJ - 1.25e6) < 2e4, `deployed ${lap.stats.deployedJ}`);
    assert.ok(Math.abs(lap.stats.harvestedJ - 1.25e6) < 2e4, `harvested ${lap.stats.harvestedJ}`);
    assert.ok(Math.abs(lap.stats.avgSpeed! - 180) < 0.5);
    assert.ok(lap.stats.fuelUsedKg! > 1 && lap.stats.fuelUsedKg! < 2, `fuel ${lap.stats.fuelUsedKg}`);
    assert.ok(lap.samples.length < 700, 'trace is trimmed for history');
  }
});
