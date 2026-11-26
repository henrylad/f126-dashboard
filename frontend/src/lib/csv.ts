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

/** Every sample of the given laps, one row each, labelled per lap. */
export function lapsCsv(laps: { lap: Lap; label: string }[]): string {
  const header = ['lap', 'lap_number', 'kind', 'lap_time_ms', 'distance_m', 'time_ms', 'speed_kmh', 'throttle', 'brake', 'gear', 'ers_j', 'ers_mode'];
  const rows: Cell[][] = [];
  for (const { lap, label } of laps) {
    for (const s of lap.samples) {
      rows.push([label, lap.lap, lap.kind, lap.timeMs, s.d, s.t, s.speed, s.throttle, s.brake, s.gear, s.ers, s.mode]);
    }
  }
  return toCsv(header, rows);
}

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
