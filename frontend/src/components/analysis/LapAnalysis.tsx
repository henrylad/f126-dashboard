import { useEffect, useState } from 'react';
import type { Snapshot } from '../../api/types.ts';
import type { LapView } from '../../laps/lapView.ts';
import { theoreticalBest, type Lap } from '../../laps/lapMath.ts';
import { code, delta as fmtDelta, lapTime, sectorTime } from '../../lib/format.ts';
import { LAP_COLOURS } from '../../lib/chart.ts';
import { team } from '../../lib/meta.ts';
import { LapTable, sortValue, type Owner, type SortKey } from './LapTable.tsx';
import { CompareChart, type Compared } from './CompareChart.tsx';
import { MiniCompare } from './MiniCompare.tsx';
import { EnergyCompare } from './EnergyCompare.tsx';

type Filter = 'all' | 'valid' | 'fastest5';
const FILTERS: [Filter, string][] = [['all', 'All laps'], ['valid', 'Valid only'], ['fastest5', 'Fastest 5']];
/** Columns where bigger is better sort descending first. */
const DESC_FIRST = new Set<SortKey>(['top', 'throttle', 'harvested']);

const byTime = (a: Lap, b: Lap) => a.timeMs - b.timeMs;

function sortLaps(laps: Lap[], sort: { key: SortKey; dir: 1 | -1 }): Lap[] {
  return [...laps].sort((a, b) => {
    const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return (va - vb) * sort.dir;
  });
}

export function LapAnalysis({ snap, store }: { snap: Snapshot; store: LapView }) {
  const laps = store.laps;
  const timed = laps.filter((l) => l.kind === 'timed');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'id', dir: 1 });
  const [driverSort, setDriverSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'time', dir: 1 });
  const driverLaps = store.driverBests();
  const everyLap = [...laps, ...driverLaps];
  const ownerOf = (l: Lap): Owner => {
    const car = snap.cars.find((c) => c.idx === l.carIdx);
    return { name: car?.name ?? `Car ${l.carIdx + 1}`, colour: car ? team(car.teamId).colour : '#8d98c7' };
  };
  const labelOf = (l: Lap) => (l.carIdx === store.playerIdx ? `L${l.lap}` : `${code(ownerOf(l).name)} L${l.lap}`);
  // Selected laps keep their colour slot while selected (colour follows the lap).
  const [selected, setSelected] = useState<{ id: number; slot: number }[]>([]);
  const [refId, setRefId] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);

  // Start with fastest vs latest valid lap until the user picks something.
  const latestTimed = timed.at(-1)?.id;
  const fastest = timed.length ? [...timed].sort(byTime)[0] : null;
  useEffect(() => {
    if (touched || !fastest) return;
    const ids = [fastest.id, ...(latestTimed !== undefined && latestTimed !== fastest.id ? [latestTimed] : [])];
    setSelected(ids.map((id, slot) => ({ id, slot })));
  }, [touched, fastest?.id, latestTimed]);

  const select = (ids: number[], ref?: number) => {
    setTouched(true);
    setSelected(ids.slice(0, LAP_COLOURS.length).map((id, slot) => ({ id, slot })));
    if (ref !== undefined) setRefId(ref);
  };
  const toggle = (id: number) => {
    setTouched(true);
    setSelected((prev) => {
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
      const used = new Set(prev.map((s) => s.slot));
      const slot = LAP_COLOURS.findIndex((_, i) => !used.has(i));
      if (slot === -1) return [...prev.slice(1), { id, slot: prev[0].slot }]; // full: replace the oldest
      return [...prev, { id, slot }];
    });
  };
  const sorter = (set: typeof setSort) => (key: SortKey) =>
    set((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: DESC_FIRST.has(key) ? -1 : 1 }));
  const setRef = (id: number) => { setTouched(true); setRefId(id); };

  const fastestDriver = driverLaps[0] ?? null;
  const refLap = everyLap.find((l) => l.id === (refId ?? fastest?.id)) ?? null;
  const colourOf = (id: number) => {
    const s = selected.find((x) => x.id === id);
    return s ? LAP_COLOURS[s.slot] : null;
  };
  const compared: Compared[] = selected.flatMap((s) => {
    const lap = everyLap.find((l) => l.id === s.id);
    return lap ? [{ lap, colour: LAP_COLOURS[s.slot], label: labelOf(lap) }] : [];
  });

  const rows = sortLaps(filter === 'all' ? laps : filter === 'valid' ? timed : [...timed].sort(byTime).slice(0, 5), sort);
  const driverRows = sortLaps(driverLaps, driverSort);

  const theo = theoreticalBest(laps);
  const bestSector = (i: 0 | 1 | 2) => {
    const v = timed.map((l) => l.sectors[i]).filter((x): x is number => x !== null);
    return v.length ? Math.min(...v) : null;
  };
  const bs = [bestSector(0), bestSector(1), bestSector(2)];
  const ideal = bs.every((x) => x !== null) ? bs.reduce((a, b) => a! + b!, 0)! : null;
  const topLap = laps.length ? laps.reduce((a, b) => (b.stats.topSpeed > a.stats.topSpeed ? b : a)) : null;

  if (!snap.session) return null;
  if (!laps.length && !driverLaps.length) {
    return (
      <div className="empty">
        <h1>No laps yet</h1>
        <p>Every lap you complete this session shows up here — lap and sector times, mini sectors, telemetry and energy use — ready to compare.</p>
      </div>
    );
  }

  return (
    <div className="analysis">
      <section className="cards">
        <Card k="Laps" v={`${laps.length}`} s={`${timed.length} valid`} />
        <Card k="Best lap" v={fastest ? lapTime(fastest.timeMs) : '—'} s={fastest ? `Lap ${fastest.lap}` : 'No valid lap yet'} purple />
        <Card k="Theoretical best" v={theo ? lapTime(Math.round(theo)) : '—'} s={theo && fastest ? `${fmtDelta(theo - fastest.timeMs)} · best mini sectors` : 'Best of each mini sector'} />
        <Card k="Best sectors" v={bs.map((x) => (x === null ? '—' : sectorTime(x))).join(' · ')} s={ideal && fastest ? `Ideal ${lapTime(Math.round(ideal))} (${fmtDelta(ideal - fastest.timeMs)})` : 'S1 · S2 · S3'} />
        <Card k="Top speed" v={topLap ? `${topLap.stats.topSpeed} km/h` : '—'} s={topLap ? `Lap ${topLap.lap}` : ''} />
        <Card k="Fastest driver" v={fastestDriver ? lapTime(fastestDriver.timeMs) : '—'}
          s={fastestDriver ? `${ownerOf(fastestDriver).name}${fastest ? ` · you ${fmtDelta(fastest.timeMs - fastestDriver.timeMs)}` : ''}` : 'No other driver has a valid lap yet'} />
      </section>

      <section className="panel">
        <h2>
          Laps
          <span className="aside legend">
            <span className="seg" role="group" aria-label="Filter laps">
              {FILTERS.map(([f, label]) => (
                <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{label}</button>
              ))}
            </span>
            <span className="seg" role="group" aria-label="Quick selections">
              <button disabled={!fastest} onClick={() => fastest && select([fastest.id], fastest.id)}>Fastest lap</button>
              <button disabled={timed.length < 2} onClick={() => { const f = [...timed].sort(byTime).slice(0, 3); select(f.map((l) => l.id), f[0].id); }}>Fastest 3</button>
              <button disabled={!fastest} onClick={() => fastest && select([fastest.id, ...laps.slice(-3).map((l) => l.id).filter((id) => id !== fastest.id)], fastest.id)}>Best vs last 3</button>
              <button onClick={() => select([])}>Clear</button>
            </span>
          </span>
        </h2>
        <p className="hint">Click rows to compare (up to {LAP_COLOURS.length}). <b>Ref</b> sets the lap the delta is measured against. Click a column to sort.</p>
        <LapTable laps={rows} allLaps={laps} sort={sort} onSort={sorter(setSort)} colourOf={colourOf} onToggle={toggle} refId={refLap?.id ?? null} onRef={setRef} />
      </section>

      <section className="panel">
        <h2>
          Drivers' fastest laps
          <span className="aside legend">
            <span className="seg" role="group" aria-label="Compare with drivers">
              <button disabled={!fastest || !fastestDriver} onClick={() => fastest && fastestDriver && select([fastest.id, fastestDriver.id], fastestDriver.id)}>Me vs fastest</button>
              <button disabled={!fastest || !fastestDriver} onClick={() => fastest && fastestDriver && select([fastest.id, ...driverLaps.slice(0, 3).map((l) => l.id)], fastestDriver.id)}>Me vs top 3</button>
            </span>
          </span>
        </h2>
        <p className="hint">Each driver's best valid lap this session, with the same data as yours. Time gap is to <b>your</b> best lap. Select them to compare alongside your laps.</p>
        {driverLaps.length ? (
          <LapTable laps={driverRows} allLaps={[...driverLaps, ...timed]} baseline={fastest?.timeMs ?? null} ownerOf={ownerOf}
            sort={driverSort} onSort={sorter(setDriverSort)} colourOf={colourOf} onToggle={toggle} refId={refLap?.id ?? null} onRef={setRef} />
        ) : (
          <p className="dim">No other driver has completed a valid lap yet.</p>
        )}
      </section>

      <section className="panel">
        <h2>
          Telemetry comparison
          <span className="aside legend">
            {compared.map((c) => (
              <span key={c.lap.id}>
                <i className={c.lap.id === refLap?.id ? 'dash-colour' : ''} style={{ background: c.colour, color: c.colour }} />
                {c.label} · {lapTime(c.lap.timeMs)}{c.lap.id === refLap?.id ? ' (ref)' : ''}
              </span>
            ))}
          </span>
        </h2>
        <CompareChart laps={compared} refLap={refLap} session={snap.session} />
      </section>

      <section className="panel">
        <h2>Mini sectors <span className="aside">loss vs the best of your laps and the compared laps · ● = best</span></h2>
        <MiniCompare laps={compared} allLaps={laps} />
      </section>

      <section className="panel">
        <h2>Energy use <span className="aside">where each lap harvested, deployed and boosted</span></h2>
        <EnergyCompare laps={compared} trackLength={snap.session.trackLength} />
      </section>
    </div>
  );
}

function Card({ k, v, s, purple }: { k: string; v: string; s: string; purple?: boolean }) {
  return (
    <div className="panel card">
      <div className="k">{k}</div>
      <div className={`v num${purple ? ' purple' : ''}`}>{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}
