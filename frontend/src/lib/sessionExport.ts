// Everything the dashboard knows about the current session, as a ZIP of CSV files:
// session facts, one row per lap, every sample, speed traps and tyre sets.
import type { SetupInfo, Snapshot } from '../api/types.ts';
import type { Lap } from '../laps/lapMath.ts';
import type { LapView } from '../laps/lapView.ts';
import { toCsv, type Cell } from './csv.ts';
import { code } from './format.ts';
import { ACTUAL_TO_LABEL, SESSION_TYPES, WEATHER, team, trackName } from './meta.ts';
import { zip } from './zip.ts';

const COMPOUNDS: Record<number, string> = { 16: 'soft', 17: 'medium', 18: 'hard', 7: 'inter', 8: 'wet' };
const ERS_MODE = ['none', 'medium', 'hotlap', 'boost'];

/** Setup fields in a fixed column order, with their CSV names. */
const SETUP: [keyof SetupInfo, string][] = [
  ['frontWing', 'front_wing'], ['rearWing', 'rear_wing'], ['onThrottle', 'diff_on_throttle_pct'], ['offThrottle', 'diff_off_throttle_pct'],
  ['frontCamber', 'front_camber_deg'], ['rearCamber', 'rear_camber_deg'], ['frontToe', 'front_toe_deg'], ['rearToe', 'rear_toe_deg'],
  ['frontSuspension', 'front_suspension'], ['rearSuspension', 'rear_suspension'], ['frontAntiRollBar', 'front_anti_roll_bar'],
  ['rearAntiRollBar', 'rear_anti_roll_bar'], ['frontRideHeight', 'front_ride_height'], ['rearRideHeight', 'rear_ride_height'],
  ['brakePressure', 'brake_pressure_pct'], ['brakeBias', 'brake_bias_pct'], ['engineBraking', 'engine_braking_pct'],
  ['ballast', 'ballast'], ['fuelLoad', 'fuel_load_kg'], ['nextFrontWing', 'next_front_wing'],
];
const TYRE_PSI = ['tyre_pressure_rl_psi', 'tyre_pressure_rr_psi', 'tyre_pressure_fl_psi', 'tyre_pressure_fr_psi'];
const SETUP_HEADER = [...SETUP.map(([, name]) => `setup_${name}`), ...TYRE_PSI.map((n) => `setup_${n}`)];
const setupCells = (s: SetupInfo | null | undefined): Cell[] =>
  s ? [...SETUP.map(([k]) => s[k] as number), ...s.tyresPressure] : new Array<Cell>(SETUP_HEADER.length).fill(null);

const MINIS = 25;

interface Owned { lap: Lap; group: 'yours' | 'driver best'; driver: string; team: string; label: string }

export function sessionExport(snap: Snapshot, store: LapView, now = new Date()): { name: string; data: Uint8Array<ArrayBuffer> } {
  const s = snap.session;
  const p = snap.player;
  const car = (idx: number) => snap.cars.find((c) => c.idx === idx);
  const driverOf = (idx: number) => car(idx)?.name ?? `Car ${idx + 1}`;
  const teamOf = (idx: number) => { const c = car(idx); return c && c.teamId >= 0 ? team(c.teamId).name : ''; };

  const laps: Owned[] = [
    ...store.laps.map((lap) => ({ lap, group: 'yours' as const, driver: driverOf(lap.carIdx), team: teamOf(lap.carIdx), label: `L${lap.lap}` })),
    ...store.driverBests().map((lap) => ({ lap, group: 'driver best' as const, driver: driverOf(lap.carIdx), team: teamOf(lap.carIdx), label: `${code(driverOf(lap.carIdx))} L${lap.lap}` })),
  ];

  const session: [string, Cell][] = [
    ['exported_at', now.toISOString()],
    ['source', snap.source],
    ['game_version', snap.gameVersion],
    ['session_uid', s?.uid],
    ['track', s ? trackName(s.trackId) : null],
    ['track_id', s?.trackId],
    ['track_length_m', s?.trackLength],
    ['session_type', s ? SESSION_TYPES[s.sessionType] ?? s.sessionType : null],
    ['total_laps', s?.totalLaps],
    ['session_time_s', snap.sessionTime],
    ['time_left_s', s?.timeLeft],
    ['weather', s ? WEATHER[s.weather] ?? s.weather : null],
    ['track_temp_c', s?.trackTemp],
    ['air_temp_c', s?.airTemp],
    ['pit_speed_limit_kmh', s?.pitSpeedLimit],
    ['sector2_start_m', s?.sector2Start],
    ['sector3_start_m', s?.sector3Start],
    ['player', p ? driverOf(p.idx) : null],
    ['player_team', p ? teamOf(p.idx) : null],
    ['player_position', p?.race.position],
    ['player_speed_trap_kmh', p?.speedTrapKmh || null],
    ['player_speed_trap_lap', p && p.race.speedTrapLap !== 255 ? p.race.speedTrapLap : null],
    ['your_laps', store.laps.length],
    ['driver_best_laps', store.driverBests().length],
    ...SETUP_HEADER.map((name, i): [string, Cell] => [`current_${name}`, setupCells(p?.setup)[i]]),
  ];

  const lapHeader = [
    'group', 'driver', 'team', 'car_idx', 'lap', 'lap_number', 'kind', 'lap_time_ms', 's1_ms', 's2_ms', 's3_ms',
    ...Array.from({ length: MINIS }, (_, k) => `mini_${k + 1}_ms`),
    'top_speed_kmh', 'avg_speed_kmh', 'speed_trap_kmh', 'full_throttle_pct', 'braking_pct', 'gear_changes',
    'deployed_mj', 'harvested_mj', 'net_mj', 'boost_pct', 'battery_start_mj', 'battery_end_mj',
    'fuel_used_kg', 'tyre_wear_added_pct', 'compound', 'tyre_age_laps', 'samples',
    ...SETUP_HEADER,
  ];
  const ms = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v));
  const lapRows = laps.map(({ lap: l, group, driver, team: t, label }): Cell[] => {
    const st = l.stats;
    return [
      group, driver, t, l.carIdx, label, l.lap, l.kind, l.timeMs, ms(l.sectors[0]), ms(l.sectors[1]), ms(l.sectors[2]),
      ...Array.from({ length: MINIS }, (_, k) => ms(l.minis[k]?.ms)),
      st.topSpeed, st.avgSpeed, st.speedTrapKmh ?? null, st.fullThrottlePct, st.brakingPct, st.gearChanges,
      st.deployedJ / 1e6, st.harvestedJ / 1e6, (st.harvestedJ - st.deployedJ) / 1e6, st.boostPct, st.ersStartJ / 1e6, st.ersEndJ / 1e6,
      st.fuelUsedKg, st.wearDeltaPct, COMPOUNDS[st.compound] ?? st.compound, st.tyreAge, l.samples.length,
      ...setupCells(l.setup),
    ];
  });

  const sampleHeader = [
    'group', 'driver', 'lap', 'lap_number', 'kind', 'distance_m', 'time_ms', 'speed_kmh', 'throttle', 'brake', 'gear',
    'rpm', 'steer', 'g_lat', 'g_lon', 'ers_j', 'ers_mode', 'slip_front_pct', 'slip_rear_pct',
  ];
  const sampleRows: Cell[][] = [];
  for (const { lap: l, group, driver, label } of laps) {
    for (const x of l.samples) {
      sampleRows.push([group, driver, label, l.lap, l.kind, x.d, x.t, x.speed, x.throttle, x.brake, x.gear,
        x.rpm, x.steer, x.gLat, x.gLon, x.ers, ERS_MODE[x.mode] ?? x.mode, x.slipFront, x.slipRear]);
    }
  }

  const trapRows = [...snap.cars]
    .filter((c) => c.speedTrapKmh > 0)
    .sort((a, b) => b.speedTrapKmh - a.speedTrapKmh)
    .map((c, i): Cell[] => [i + 1, c.name, c.teamId >= 0 ? team(c.teamId).name : '', c.idx, c.isPlayer, c.speedTrapKmh, c.speedTrapLap === 255 ? null : c.speedTrapLap]);

  const files = [
    { name: 'README.txt', text: README },
    { name: 'session.csv', text: toCsv(['key', 'value'], session) },
    { name: 'laps.csv', text: toCsv(lapHeader, lapRows) },
    { name: 'samples.csv', text: toCsv(sampleHeader, sampleRows) },
    { name: 'speed_traps.csv', text: toCsv(['rank', 'driver', 'team', 'car_idx', 'is_player', 'speed_trap_kmh', 'lap'], trapRows) },
  ];
  if (p?.tyreSets) {
    files.push({
      name: 'tyre_sets.csv',
      text: toCsv(
        ['set', 'compound', 'actual_compound', 'wear_pct', 'laps_left', 'usable_life_laps', 'lap_delta_ms', 'available', 'fitted', 'recommended_session'],
        p.tyreSets.sets.map((t, i) => [i + 1, COMPOUNDS[t.visualCompound] ?? t.visualCompound, ACTUAL_TO_LABEL[t.actualCompound] ?? t.actualCompound,
          t.wear, t.lifeSpan, t.usableLife, t.lapDeltaMs, t.available, t.fitted, SESSION_TYPES[t.recommendedSession] ?? t.recommendedSession]),
      ),
    });
  }

  const track = s ? trackName(s.trackId).toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'session';
  const stamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  return { name: `pitwall-${track}-${stamp}.zip`, data: zip(files, now) };
}

const README = `Pit Wall session export
======================

Everything the dashboard recorded in this session: your laps (every kind) and each
other driver's fastest lap. Numbers use a dot as decimal separator.

session.csv      Track, session type, weather, temperatures, your speed trap and your
                 current car setup (current_setup_*), as key,value pairs.
laps.csv         One row per lap. group = yours / driver best. kind = timed (clean lap
                 from line to line), invalid, out, in, pit or partial.
                 s1..s3 and mini_1..mini_25 in ms. Energy in MJ (battery holds 4 MJ).
                 speed_trap_kmh: the game only reports each car's fastest trap pass, so
                 a lap has it only when it set a new fastest pass for that car.
                 setup_*: your setup at the end of that lap (empty for other drivers).
samples.csv      Every sample of every lap above, about one every 4 m.
                 throttle/brake 0..1, steer -1 (left) .. +1 (right), g_lon < 0 = braking,
                 ers_j = battery charge in joules, ers_mode = deploy mode,
                 slip_*_pct = mean wheel slip per axle (your laps only; positive =
                 wheelspin, negative = locking).
speed_traps.csv  Each driver's fastest speed-trap pass this session and its lap.
tyre_sets.csv    Your tyre sets for the weekend (when the game sent them):
                 wear, laps left, lap time against the fitted set.

Other drivers' telemetry is empty (zeros) when they keep it private.
`;
