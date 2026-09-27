import type { Sample } from '../shared/store.ts';
import type { EnergyKey } from '../shared/meta.ts';

// Battery change per sample below this counts as neutral (≈ 15 kW at 30 Hz).
const NEUTRAL_J = 500;

/**
 * What the battery was doing at each sample. Harvest vs deploy comes from the
 * store actually rising or falling; the deploy mode only labels the deploy.
 */
export function energyState(prev: Sample | undefined, s: Sample): EnergyKey | null {
  if (s.ot || s.mode === 3) return 'overtake';
  if (!prev) return null;
  const dE = s.ers - prev.ers;
  if (dE > NEUTRAL_J) return 'harvest';
  if (dE < -NEUTRAL_J) return s.mode === 2 ? 'hotlap' : 'medium';
  return null;
}

/** Energy state per outline bin across a lap (null = neutral / no data). */
export function energyBins(samples: Sample[], len: number, bins: number): (EnergyKey | null)[] {
  const out = new Array<EnergyKey | null>(bins).fill(null);
  const seen = new Array<boolean>(bins).fill(false);
  samples.forEach((s, i) => {
    const b = Math.floor((s.d / len) * bins);
    if (b < 0 || b >= bins) return;
    const st = energyState(samples[i - 1], s);
    // Keep the first non-neutral state in a bin so short spikes still show.
    if (!seen[b] || (out[b] === null && st !== null)) out[b] = st;
    seen[b] = true;
  });
  return out;
}

/** Which bins the samples cover at all. */
export function coveredBins(samples: Sample[], len: number, bins: number): boolean[] {
  const out = new Array<boolean>(bins).fill(false);
  for (const s of samples) {
    const b = Math.floor((s.d / len) * bins);
    if (b >= 0 && b < bins) out[b] = true;
  }
  return out;
}
