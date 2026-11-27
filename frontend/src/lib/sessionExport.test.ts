import { describe, expect, it } from 'vitest';
import type { CarRow, PlayerDetail, SetupInfo, Snapshot } from '../api/types.ts';
import { LapView } from '../laps/lapView.ts';
import { lap } from '../laps/testLaps.ts';
import { sessionExport } from './sessionExport.ts';
import { unzip } from './testZip.ts';

const setup = { frontWing: 28, rearWing: 24, brakeBias: 55, tyresPressure: [21.2, 21.2, 23.1, 23.1] } as unknown as SetupInfo;

function fixture() {
  const mine = { ...lap(4, 82_700, [3000, 3100]), setup, stats: { ...lap(4, 0, []).stats, speedTrapKmh: 331.5 } };
  const theirs = { ...lap(9, 82_200, []), carIdx: 3 };
  const store = new LapView();
  store.loadHistory({
    sessionUid: 's1', playerIdx: 0, playerBestLapId: 4, laps: [mine], driverBests: [theirs], outline: [], minis: [], lastMinis: [], current: [], savedLaps: [],
  });
  const cars = [
    { idx: 0, name: 'VERSTAPPEN', teamId: 478, isPlayer: true, speedTrapKmh: 331.5, speedTrapLap: 4 },
    { idx: 3, name: 'NORRIS', teamId: 484, isPlayer: false, speedTrapKmh: 334, speedTrapLap: 9 },
  ] as CarRow[];
  const player = { idx: 0, setup, speedTrapKmh: 331.5, race: { position: 2, speedTrapLap: 4 }, tyreSets: null } as unknown as PlayerDetail;
  const snap = {
    source: 'sim', gameVersion: '1.25', sessionTime: 400, cars, player, events: [],
    session: { uid: 's1', trackId: 42, trackLength: 5470, sessionType: 15, totalLaps: 30, weather: 1, trackTemp: 41, airTemp: 28 },
  } as unknown as Snapshot;
  return { snap, store };
}

const rows = (csv: string) => {
  const [head, ...rest] = csv.trim().split('\n').map((l) => l.split(','));
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};

describe('sessionExport', () => {
  const { snap, store } = fixture();
  const out = sessionExport(snap, store, new Date('2026-11-27T10:00:00Z'));
  const files = unzip(out.data);

  it('names the file after the track and time', () => {
    expect(out.name).toBe('pitwall-madrid-2026-11-27_10-00.zip');
  });

  it('contains the session, laps, samples and speed traps with a README', () => {
    expect(Object.keys(files)).toEqual(['README.txt', 'session.csv', 'laps.csv', 'samples.csv', 'speed_traps.csv']);
  });

  it('writes the session facts and the current setup', () => {
    const facts = Object.fromEntries(rows(files['session.csv']).map((r) => [r.key, r.value]));
    expect(facts).toMatchObject({ track: 'Madrid', session_type: 'Race', player: 'VERSTAPPEN', current_setup_brake_bias_pct: '55', your_laps: '1' });
  });

  it('writes one row per lap with minis, speed trap and that lap\'s setup', () => {
    const [mine, theirs] = rows(files['laps.csv']);
    expect(mine).toMatchObject({ group: 'yours', driver: 'VERSTAPPEN', lap: 'L4', mini_1_ms: '3000', speed_trap_kmh: '331.5', setup_front_wing: '28', setup_tyre_pressure_fl_psi: '23.1' });
    expect(theirs).toMatchObject({ group: 'driver best', driver: 'NORRIS', lap: 'NOR L9', setup_front_wing: '' });
  });

  it('writes every sample of every lap', () => {
    expect(rows(files['samples.csv'])).toHaveLength(4);
  });

  it('ranks the speed traps', () => {
    expect(rows(files['speed_traps.csv']).map((r) => [r.rank, r.driver, r.lap])).toEqual([['1', 'NORRIS', '9'], ['2', 'VERSTAPPEN', '4']]);
  });
});
