export function lapTime(ms: number): string {
  if (!ms) return '—';
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

export function sectorTime(ms: number): string {
  return ms ? (ms / 1000).toFixed(3) : '—';
}

export function gap(ms: number): string {
  return `+${(ms / 1000).toFixed(3)}`;
}

export function delta(ms: number): string {
  return `${ms < 0 ? '−' : '+'}${Math.abs(ms / 1000).toFixed(3)}`;
}

export function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

export const code = (name: string) => name.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase();
