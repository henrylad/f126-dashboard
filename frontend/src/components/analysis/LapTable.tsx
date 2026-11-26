import { useState } from 'react';
import type { Lap } from '../../laps/lapMath.ts';
import { compound } from '../../lib/meta.ts';
import { savedDate } from '../../laps/lapMath.ts';
import { download, lapSummaryCsv, lapsCsv, stamp } from '../../lib/csv.ts';
import { code, delta as fmtDelta, lapTime, sectorTime } from '../../lib/format.ts';
import type { Bests } from './LapAnalysis.tsx';

type SortKey = 'order' | 'time' | 's1' | 's2' | 's3' | 'top' | 'throttle' | 'deployed' | 'harvested' | 'boost' | 'fuel' | 'wear';

const KIND_LABEL: Record<Lap['kind'], string> = {
  timed: '', invalid: 'Invalid', out: 'Out-lap', in: 'In-lap', pit: 'Pit', partial: 'Partial',
};

/** Sort value per column; null sorts last. */
function sortValue(l: Lap, key: SortKey): number | null {
  switch (key) {
    case 'order': return l.id;
    case 'time': return l.kind === 'timed' ? l.timeMs : null;
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

/** Columns where bigger is better sort descending first. */
const DESC_FIRST = new Set<SortKey>(['top', 'throttle', 'harvested']);

const CORE: { key: SortKey; label: string; title: string }[] = [
  { key: 'time', label: 'Time', title: 'Lap time, and the gap to the reference lap' },
  { key: 's1', label: 'S1', title: 'Sector 1, s' },
  { key: 's2', label: 'S2', title: 'Sector 2, s' },
  { key: 's3', label: 'S3', title: 'Sector 3, s' },
  { key: 'top', label: 'Top km/h', title: 'Top speed, km/h' },
];
const MORE: { key: SortKey; label: string; title: string }[] = [
  { key: 'throttle', label: 'Full thr.', title: 'Share of the lap at full throttle' },
  { key: 'deployed', label: 'Deploy MJ', title: 'ERS energy deployed, MJ' },
  { key: 'harvested', label: 'Harvest MJ', title: 'ERS energy harvested, MJ' },
  { key: 'boost', label: 'Boost', title: 'Share of the lap in Boost deploy mode' },
  { key: 'fuel', label: 'Fuel kg', title: 'Fuel used, kg' },
  { key: 'wear', label: 'Wear', title: 'Average tyre wear added this lap' },
];

interface Props {
  headingId: string;
  laps: Lap[];
  driverLaps: Lap[];
  savedLaps: Lap[];
  labelOf: (l: Lap) => string;
  ownerOf: (l: Lap) => { name: string; colour: string };
  bests: Bests;
  refLap: Lap | null;
  colourOf: (id: number) => string | null;
  /** Laps being compared, with their chart labels, for the CSV export. */
  compared: { lap: Lap; label: string }[];
}

/** Session-best mark: a drawn dot, with its meaning for screen readers. */
const Best = () => (
  <svg className="best-mark" viewBox="0 0 8 8" width="7" height="7" role="img" aria-label="session best"><circle cx="4" cy="4" r="3.5" /></svg>
);
/** Sort direction: a 1.5px chevron in the table's stroke weight. */
const Arrow = ({ dir }: { dir: 1 | -1 }) => (
  <svg className="sort-arrow" viewBox="0 0 10 10" width="10" height="10" aria-hidden>
    <path d={dir === 1 ? 'M2 6.5 5 3.5 8 6.5' : 'M2 3.5 5 6.5 8 3.5'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function LapTable({ headingId, laps, driverLaps, savedLaps, labelOf, ownerOf, bests, refLap, colourOf, compared }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'order', dir: 1 });
  const [all, setAll] = useState(false);
  const cols = all ? [...CORE, ...MORE] : CORE;
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: DESC_FIRST.has(key) ? -1 : 1 }));
  const sorted = (ls: Lap[]) => [...ls].sort((a, b) => {
    const k = sort.key === 'order' && ls === driverLaps ? 'time' : sort.key;
    const va = sortValue(a, k), vb = sortValue(b, k);
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return (va - vb) * sort.dir;
  });

  const exportTable = () => download(`pitwall-lap-table-${stamp()}.csv`, lapSummaryCsv([
    ...sorted(laps).map((lap) => ({ lap, label: labelOf(lap), group: 'yours' })),
    ...sorted(savedLaps).map((lap) => ({ lap, label: labelOf(lap), group: 'earlier session' })),
    ...sorted(driverLaps).map((lap) => ({ lap, label: labelOf(lap), group: 'driver best' })),
  ]));

  const header = (
    <tr>
      <th scope="col" className="left">
        <button onClick={() => onSort('order')} aria-label="Sort by lap order">Lap{sort.key === 'order' && <Arrow dir={sort.dir} />}</button>
      </th>
      {cols.map((c) => (
        <th key={c.key} scope="col" title={c.title} className={sort.key === c.key ? 'sorted' : ''} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
          <button onClick={() => onSort(c.key)}>{c.label}{sort.key === c.key && <Arrow dir={sort.dir} />}</button>
        </th>
      ))}
      {all && <th scope="col" title="Tyre compound and age in laps at the end of the lap">Tyre</th>}
    </tr>
  );

  const row = (l: Lap, driver: boolean) => {
    const colour = colourOf(l.id);
    const valid = l.kind === 'timed';
    const gap = valid && refLap && refLap.id !== l.id ? l.timeMs - refLap.timeMs : null;
    const tyre = compound(l.stats.compound);
    const owner = driver ? ownerOf(l) : null;
    const best = (v: number | null, b: number | null) => valid && v !== null && v === b;
    return (
      <tr key={l.id} className={valid ? '' : 'untimed'}>
        <th scope="row" className="left">
          <span className="lap-name">
            <i className={`sw${colour ? '' : ' none'}`} style={colour ? { background: colour } : undefined} aria-hidden />
            {owner ? <><i className="team-dot" style={{ background: owner.colour }} aria-hidden /><b>{code(owner.name)}</b> <span className="dim">L{l.lap}</span></>
              : l.saved ? <><b>{savedDate(l)}</b> <span className="dim">L{l.lap}</span></> : <b>L{l.lap}</b>}
            {KIND_LABEL[l.kind] && <span className="kind">{KIND_LABEL[l.kind]}</span>}
            {refLap?.id === l.id && <span className="kind ref">Ref</span>}
          </span>
        </th>
        {cols.map((c) => {
          switch (c.key) {
            case 'time': return (
              <td key="time" className={best(l.timeMs, bests.time) ? 'purple' : ''}>
                {lapTime(l.timeMs)}{best(l.timeMs, bests.time) && <Best />}
                {gap !== null && <small className={gap > 0 ? 'lost' : gap < 0 ? 'gained' : 'dim'}>{gap === 0 ? '±0.000' : fmtDelta(gap)}</small>}
              </td>
            );
            case 's1': case 's2': case 's3': {
              const i = +c.key[1] - 1, v = l.sectors[i];
              return <td key={c.key} className={best(v, bests.sectors[i]) ? 'purple' : ''}>{v === null ? '—' : sectorTime(v)}{best(v, bests.sectors[i]) && <Best />}</td>;
            }
            case 'top': return <td key="top" className={best(l.stats.topSpeed, bests.top) ? 'purple' : ''}>{l.stats.topSpeed}{best(l.stats.topSpeed, bests.top) && <Best />}</td>;
            case 'throttle': return <td key="throttle">{l.stats.fullThrottlePct.toFixed(0)}%</td>;
            case 'deployed': return <td key="deployed">{(l.stats.deployedJ / 1e6).toFixed(2)}</td>;
            case 'harvested': return <td key="harvested">{(l.stats.harvestedJ / 1e6).toFixed(2)}</td>;
            case 'boost': return <td key="boost">{l.stats.boostPct.toFixed(0)}%</td>;
            case 'fuel': return <td key="fuel">{l.stats.fuelUsedKg === null ? '—' : l.stats.fuelUsedKg.toFixed(2)}</td>;
            case 'wear': return <td key="wear">{l.stats.wearDeltaPct === null ? '—' : `${l.stats.wearDeltaPct.toFixed(1)}%`}</td>;
            default: return null;
          }
        })}
        {all && (
          <td>
            <span className="tyre-cell">
              <span className="tyre" style={{ color: tyre.colour }} title={tyre.label}>{tyre.label}</span>
              <small>{l.stats.tyreAge} laps</small>
            </span>
          </td>
        )}
      </tr>
    );
  };

  return (
    <>
      <div className="section-head">
        <h2 id={headingId}>Lap data</h2>
        <span className="aside"><Best /> session best across all drivers · gaps to the reference</span>
        <span className="head-tools">
          <button className="btn" disabled={!compared.length} onClick={() => download(`pitwall-laps-${stamp()}.csv`, lapsCsv(compared))}
            title={compared.length ? 'Download every sample of the compared laps as CSV' : 'Pick laps to compare first'}>
            Export compared (CSV)
          </button>
          <button className="btn" onClick={exportTable} title="Download this table, one row per lap with sectors and stats, as CSV">
            Export table (CSV)
          </button>
          <button className="btn" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Fewer columns' : 'All columns'}</button>
        </span>
      </div>
      <div className="data-wrap">
        <table className="data-table num">
          <thead>{header}</thead>
          <tbody>
            <tr className="group"><th scope="rowgroup" colSpan={cols.length + (all ? 2 : 1)}>Your laps</th></tr>
            {sorted(laps).map((l) => row(l, false))}
          </tbody>
          {savedLaps.length > 0 && (
            <tbody>
              <tr className="group"><th scope="rowgroup" colSpan={cols.length + (all ? 2 : 1)}>Earlier sessions</th></tr>
              {sorted(savedLaps).map((l) => row(l, false))}
            </tbody>
          )}
          {driverLaps.length > 0 && (
            <tbody>
              <tr className="group"><th scope="rowgroup" colSpan={cols.length + (all ? 2 : 1)}>Drivers' fastest laps</th></tr>
              {sorted(driverLaps).map((l) => row(l, true))}
            </tbody>
          )}
        </table>
      </div>
    </>
  );
}
