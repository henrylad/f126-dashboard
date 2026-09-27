import type { Lap } from '../../../shared/laps.ts';
import { compound } from '../../../shared/meta.ts';
import { delta as fmtDelta, lapTime, sectorTime } from '../../format.ts';

export type SortKey = 'id' | 'time' | 's1' | 's2' | 's3' | 'top' | 'throttle' | 'deployed' | 'harvested' | 'boost' | 'fuel' | 'wear';

const KIND_LABEL: Record<Lap['kind'], string> = {
  timed: '', invalid: 'Invalid', out: 'Out-lap', in: 'In-lap', pit: 'Pit', partial: 'Partial',
};

/** Sort value per column; null sorts last. */
export function sortValue(l: Lap, key: SortKey): number | null {
  switch (key) {
    case 'id': return l.id;
    case 'time': return l.timeMs || null;
    case 's1': return l.sectors[0];
    case 's2': return l.sectors[1];
    case 's3': return l.sectors[2];
    case 'top': return l.stats.topSpeed;
    case 'throttle': return l.stats.fullThrottlePct;
    case 'deployed': return l.stats.deployedJ;
    case 'harvested': return l.stats.harvestedJ;
    case 'boost': return l.stats.boostPct;
    case 'fuel': return l.stats.fuelUsedKg;
    case 'wear': return l.stats.wearDeltaPct;
  }
}

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'id', label: 'Lap', title: 'Lap number (in driving order)' },
  { key: 'time', label: 'Time', title: 'Lap time' },
  { key: 's1', label: 'S1', title: 'Sector 1' },
  { key: 's2', label: 'S2', title: 'Sector 2' },
  { key: 's3', label: 'S3', title: 'Sector 3' },
  { key: 'top', label: 'Top', title: 'Top speed, km/h' },
  { key: 'throttle', label: 'Full thr.', title: 'Share of the lap at full throttle' },
  { key: 'deployed', label: 'Deploy', title: 'ERS energy deployed, MJ' },
  { key: 'harvested', label: 'Harvest', title: 'ERS energy harvested, MJ' },
  { key: 'boost', label: 'Boost', title: 'Share of the lap in Boost deploy mode' },
  { key: 'fuel', label: 'Fuel', title: 'Fuel used, kg' },
  { key: 'wear', label: 'Wear', title: 'Average tyre wear added this lap' },
];

interface Props {
  laps: Lap[];
  allLaps: Lap[];
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
  colourOf: (id: number) => string | null;
  onToggle: (id: number) => void;
  refId: number | null;
  onRef: (id: number) => void;
}

export function LapTable({ laps, allLaps, sort, onSort, colourOf, onToggle, refId, onRef }: Props) {
  const timed = allLaps.filter((l) => l.kind === 'timed');
  // Session bests among valid laps, shown purple.
  const best = (key: SortKey, pick: 'min' | 'max' = 'min') => {
    const vals = timed.map((l) => sortValue(l, key)).filter((v): v is number => v !== null);
    return vals.length ? (pick === 'min' ? Math.min(...vals) : Math.max(...vals)) : null;
  };
  const bestTime = best('time'), bestS = [best('s1'), best('s2'), best('s3')], bestTop = best('top', 'max');

  return (
    <div className="lap-table-wrap">
      <table className="lap-table">
        <thead>
          <tr>
            <th title="Select laps to compare (up to 6)">Cmp</th>
            <th title="Reference lap for the delta">Ref</th>
            {COLUMNS.map((c) => (
              <th key={c.key} title={c.title} className={sort.key === c.key ? 'sorted' : ''} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button onClick={() => onSort(c.key)}>
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </button>
              </th>
            ))}
            <th title="Tyre compound and age at the end of the lap">Tyre</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((l) => {
            const colour = colourOf(l.id);
            const valid = l.kind === 'timed';
            const tyre = compound(l.stats.compound);
            const dBest = valid && bestTime !== null ? l.timeMs - bestTime : null;
            return (
              <tr key={l.id} className={`${colour ? 'selected' : ''} ${valid ? '' : 'untimed'}`} onClick={() => onToggle(l.id)}>
                <td>
                  <span className="lap-check" style={colour ? { background: colour, borderColor: colour } : undefined} aria-label={colour ? 'Selected' : 'Not selected'}>
                    {colour ? '✓' : ''}
                  </span>
                </td>
                <td onClick={(e) => { e.stopPropagation(); if (valid) onRef(l.id); }}>
                  <input type="radio" name="ref" checked={refId === l.id} disabled={!valid} onChange={() => onRef(l.id)} aria-label={`Use lap ${l.lap} as reference`} />
                </td>
                <td className="num">
                  <b>{l.lap}</b>
                  {KIND_LABEL[l.kind] && <span className="kind">{KIND_LABEL[l.kind]}</span>}
                </td>
                <td className={`num ${valid && l.timeMs === bestTime ? 'purple' : ''}`}>
                  {lapTime(l.timeMs)}
                  {dBest !== null && dBest > 0 && <small className="dim"> {fmtDelta(dBest)}</small>}
                </td>
                {l.sectors.map((sv, i) => (
                  <td key={i} className={`num ${valid && sv !== null && sv === bestS[i] ? 'purple' : ''}`}>{sv === null ? '—' : sectorTime(sv)}</td>
                ))}
                <td className={`num ${valid && l.stats.topSpeed === bestTop ? 'purple' : ''}`}>{l.stats.topSpeed}</td>
                <td className="num">{l.stats.fullThrottlePct.toFixed(0)}%</td>
                <td className="num">{(l.stats.deployedJ / 1e6).toFixed(2)}</td>
                <td className="num">{(l.stats.harvestedJ / 1e6).toFixed(2)}</td>
                <td className="num">{l.stats.boostPct.toFixed(0)}%</td>
                <td className="num">{l.stats.fuelUsedKg === null ? '—' : l.stats.fuelUsedKg.toFixed(2)}</td>
                <td className="num">{l.stats.wearDeltaPct === null ? '—' : `${l.stats.wearDeltaPct.toFixed(1)}%`}</td>
                <td>
                  <span className="tyre-cell" style={{ justifyContent: 'flex-start' }}>
                    <span className="tyre" style={{ color: tyre.colour }}>{tyre.label}</span>
                    <small className="num">{l.stats.tyreAge}</small>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
