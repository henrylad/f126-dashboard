// CSV export: plain comma-separated files with a header row, numbers in
// invariant format (dot decimals), one row per sample.
import type { Lap } from '../laps/lapMath.ts';
import type { TSample } from '../components/telemetry/history.ts';

type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '';
  const s = typeof v === 'number' ? String(Math.round(v * 1e4) / 1e4) : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

/** Every sample of the given laps (about one every 4 m), one row each, labelled per lap. */
export function lapsCsv(laps: { lap: Lap; label: string }[]): string {
  const header = [
    'lap', 'lap_number', 'kind', 'lap_time_ms', 'distance_m', 'time_ms', 'speed_kmh', 'throttle', 'brake', 'gear',
    'rpm', 'steer', 'g_lat', 'g_lon', 'ers_j', 'ers_mode', 'slip_front_pct', 'slip_rear_pct',
  ];
  const rows: Cell[][] = [];
  for (const { lap, label } of laps) {
    for (const s of lap.samples) {
      rows.push([
        label, lap.lap, lap.kind, lap.timeMs, s.d, s.t, s.speed, s.throttle, s.brake, s.gear,
        s.rpm, s.steer, s.gLat, s.gLon, s.ers, s.mode, s.slipFront, s.slipRear,
      ]);
    }
  }
  return toCsv(header, rows);
}

/** One row per lap: times, sectors and the lap's stats, as in the Lap data table. */
export function lapSummaryCsv(laps: { lap: Lap; label: string; group: string }[]): string {
  const header = [
    'group', 'lap', 'lap_number', 'kind', 'lap_time_ms', 's1_ms', 's2_ms', 's3_ms', 'top_speed_kmh', 'avg_speed_kmh',
    'full_throttle_pct', 'braking_pct', 'gear_changes', 'deployed_mj', 'harvested_mj', 'net_mj', 'boost_pct',
    'battery_start_mj', 'battery_end_mj', 'fuel_used_kg', 'tyre_wear_added_pct', 'compound', 'tyre_age_laps', 'saved_at',
  ];
  const rows: Cell[][] = laps.map(({ lap: l, label, group }) => {
    const s = l.stats;
    return [
      group, label, l.lap, l.kind, l.timeMs, ms(l.sectors[0]), ms(l.sectors[1]), ms(l.sectors[2]), s.topSpeed, s.avgSpeed,
      s.fullThrottlePct, s.brakingPct, s.gearChanges, s.deployedJ / 1e6, s.harvestedJ / 1e6, (s.harvestedJ - s.deployedJ) / 1e6, s.boostPct,
      s.ersStartJ / 1e6, s.ersEndJ / 1e6, s.fuelUsedKg, s.wearDeltaPct, COMPOUND_NAMES[s.compound] ?? s.compound, s.tyreAge, l.saved?.savedAt ?? null,
    ];
  });
  return toCsv(header, rows);
}

/** Sector times are interpolated; whole milliseconds are all the game resolves. */
const ms = (v: number | null) => (v === null ? null : Math.round(v));

/** Visual compounds as the game names them. */
const COMPOUND_NAMES: Record<number, string> = { 16: 'soft', 17: 'medium', 18: 'hard', 7: 'inter', 8: 'wet' };

/** The Telemetry tab's rolling buffer between two session times. */
export function windowCsv(samples: TSample[], from: number, to: number): string {
  const header = [
    'session_time_s', 'lap', 'lap_distance_m', 'speed_kmh', 'throttle', 'brake', 'steer', 'gear', 'rpm',
    'ers_j', 'ers_mode', 'battery_flow_kw', 'ice_kw', 'mguk_kw', 'g_lat', 'g_lon',
    'ride_height_front_mm', 'ride_height_rear_mm', 'slip_front_pct', 'slip_rear_pct',
  ];
  const rows = samples.filter((s) => s.t >= from && s.t <= to).map((s) => [
    s.t, s.lap, s.d, s.speed, s.throttle, s.brake, s.steer, s.gear, s.rpm,
    s.ers, s.mode, s.flowKw, s.iceKw, s.mgukKw, s.gLat, s.gLon,
    s.frontMm, s.rearMm, s.slipFront, s.slipRear,
  ]);
  return toCsv(header, rows);
}

/** Hands the text to the browser as a file download. */
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name-safe timestamp, e.g. 2026-11-26_14-03. */
export const stamp = () => new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
