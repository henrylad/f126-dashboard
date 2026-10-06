import { useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '../../api/types.ts';
import type { LapView } from '../../laps/lapView.ts';
import { theoreticalBest, type Lap } from '../../laps/lapMath.ts';
import { hasTelemetry, verdict as findVerdict } from '../../laps/lossZones.ts';
import { code } from '../../lib/format.ts';
import { LAP_COLOURS, type Range } from '../../lib/chart.ts';
import { team } from '../../lib/meta.ts';
import { LapRail, type Filter } from './LapRail.tsx';
import { Verdict } from './Verdict.tsx';
import { CompareChart, type Compared } from './CompareChart.tsx';
import { MiniCompare } from './MiniCompare.tsx';
import { EnergyCompare } from './EnergyCompare.tsx';
import { LapTable } from './LapTable.tsx';

const byTime = (a: Lap, b: Lap) => a.timeMs - b.timeMs;
const usable = (l: Lap) => l.kind === 'timed' && hasTelemetry(l);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Session bests across every valid lap on the tab, yours and other drivers'. */
export interface Bests { time: number | null; sectors: (number | null)[]; top: number | null; yourTime: number | null }

function sessionBests(own: Lap[], others: Lap[]): Bests {
  const timed = [...own, ...others].filter((l) => l.kind === 'timed');
  const min = (v: (number | null)[]) => {
    const xs = v.filter((x): x is number => x !== null && x > 0);
    return xs.length ? Math.min(...xs) : null;
  };
  return {
    time: min(timed.map((l) => l.timeMs)),
    sectors: [0, 1, 2].map((i) => min(timed.map((l) => l.sectors[i]))),
    top: timed.length ? Math.max(...timed.map((l) => l.stats.topSpeed)) : null,
    yourTime: min(own.filter((l) => l.kind === 'timed').map((l) => l.timeMs)),
  };
}

/** Eases the shown distance range towards the target (one axis, no overshoot). */
function useEasedRange(target: Range): Range {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reducedMotion()) { setShown(target); return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 220);
      const e = 1 - Math.pow(1 - k, 3);
      const r = { from: a.from + (target.from - a.from) * e, to: a.to + (target.to - a.to) * e };
      from.current = r;
      setShown(r);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.from, target.to]);
  return shown;
}

export function LapAnalysis({ snap, store }: { snap: Snapshot; store: LapView }) {
  const session = snap.session!;
  const len = session.trackLength || 1;
  const laps = store.laps;
  const driverLaps = store.driverBests();
  const everyLap = [...laps, ...driverLaps];
  const timed = laps.filter((l) => l.kind === 'timed');
  const fastest = timed.length ? [...timed].sort(byTime)[0] : null;

  const [filter, setFilter] = useState<Filter>('all');
  // Selected laps keep their colour slot while selected (colour follows the lap).
  const [selected, setSelected] = useState<{ id: number; slot: number }[]>([]);
  const [refId, setRefId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [zoom, setZoom] = useState<Range | null>(null);
  const [activeZone, setActiveZone] = useState<number | null>(null);

  // Until you pick something: your fastest lap as the reference against your latest.
  const latestTimed = timed.at(-1)?.id;
  useEffect(() => {
    if (touched || !fastest) return;
    const ids = [fastest.id, ...(latestTimed !== undefined && latestTimed !== fastest.id ? [latestTimed] : [])];
    setSelected(ids.map((id, slot) => ({ id, slot })));
  }, [touched, fastest?.id, latestTimed]);

  const ownerOf = (l: Lap) => {
    const car = snap.cars.find((c) => c.idx === l.carIdx);
    return { name: car?.name ?? `Car ${l.carIdx + 1}`, colour: car ? team(car.teamId).colour : '#808a96' };
  };
  const labelOf = (l: Lap) => (l.carIdx === store.playerIdx ? `L${l.lap}` : `${code(ownerOf(l).name)} L${l.lap}`);

  const select = (ids: number[], ref?: number) => {
    setTouched(true);
    setSelected(ids.slice(0, LAP_COLOURS.length).map((id, slot) => ({ id, slot })));
    if (ref !== undefined) setRefId(ref);
    setFocusId(null);
  };
  const toggle = (id: number) => {
    setTouched(true);
    setSelected((prev) => {
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
      const used = new Set(prev.map((s) => s.slot));
      const slot = LAP_COLOURS.findIndex((_, i) => !used.has(i));
      return slot === -1 ? prev : [...prev, { id, slot }];
    });
  };
  const setRef = (id: number) => {
    setTouched(true);
    setRefId(id);
    // The reference is always drawn, so make sure it is compared.
    if (!selected.some((s) => s.id === id)) toggle(id);
  };

  const refLap = everyLap.find((l) => l.id === (refId ?? fastest?.id) && usable(l)) ?? null;
  const compared: Compared[] = selected.flatMap((s) => {
    const lap = everyLap.find((l) => l.id === s.id);
    return lap && hasTelemetry(lap) ? [{ lap, colour: LAP_COLOURS[s.slot], label: labelOf(lap) }] : [];
  });
  const refCompared = compared.find((c) => c.lap.id === refLap?.id) ?? null;
  const others = compared.filter((c) => c !== refCompared);
  const focus = others.find((c) => c.lap.id === focusId) ?? others[0] ?? null;

  const verdict = useMemo(
    () => (focus && refLap ? findVerdict(focus.lap, refLap, len, session.sector2Start, session.sector3Start) : null),
    [focus?.lap.id, refLap?.id, len, session.sector2Start, session.sector3Start],
  );
  // A new question resets the zoom and the highlighted zone.
  useEffect(() => { setActiveZone(null); }, [focus?.lap.id, refLap?.id]);

  const target = zoom ?? { from: 0, to: len };
  const range = useEasedRange(target);
  const zoomTo = (r: Range | null) => setZoom(r && r.to - r.from >= 50 ? { from: Math.max(0, r.from), to: Math.min(len, r.to) } : null);
  const showZone = (i: number) => {
    const z = verdict?.losses[i];
    if (!z) return;
    if (activeZone === i) { setActiveZone(null); zoomTo(null); return; }
    const pad = Math.max(150, (z.to - z.from) * 0.6);
    setActiveZone(i);
    zoomTo({ from: z.from - pad, to: z.to + pad });
  };

  const bests = sessionBests(laps, driverLaps);
  const theo = theoreticalBest(laps);
  const fastestDriver = driverLaps.find((l) => l.kind === 'timed') ?? null;

  if (!laps.length && !driverLaps.length) {
    return (
      <div className="empty">
        <h1>No laps yet</h1>
        <p>Every lap you finish shows up here. Pick two and this tab shows how much time you lost, where on the lap, and what the telemetry did differently there.</p>
        <p className="dim">Other drivers' fastest laps appear as soon as they set one.</p>
      </div>
    );
  }

  return (
    <div className="analysis">
      <LapRail
        laps={laps} driverLaps={driverLaps} filter={filter} onFilter={setFilter}
        ownerOf={ownerOf} labelOf={labelOf} bests={bests} refLap={refLap}
        selected={selected} onToggle={toggle} onRef={setRef}
        presets={{
          bestVsLast: fastest && laps.length > 1 ? () => select([fastest.id, ...laps.filter((l) => l.kind === 'timed' && l.id !== fastest.id).slice(-3).map((l) => l.id)], fastest.id) : null,
          meVsFastest: fastest && fastestDriver && usable(fastestDriver) ? () => select([fastest.id, fastestDriver.id], fastestDriver.id) : null,
          meVsTop3: fastest && driverLaps.some(usable) ? () => { const top = driverLaps.filter(usable).slice(0, 3); select([fastest.id, ...top.map((l) => l.id)], top[0].id); } : null,
          clear: selected.length ? () => select([]) : null,
        }}
      />

      <div className="analysis-main">
        <Verdict
          verdict={verdict} focus={focus} others={others} refCompared={refCompared} refLap={refLap}
          refLabel={refLap ? labelOf(refLap) : null} onFocus={setFocusId}
          activeZone={activeZone} onZone={showZone}
          yourBest={fastest} theoretical={theo} fastestDriver={fastestDriver} ownerOf={ownerOf} laps={laps}
        />

        <section className="a-section" aria-labelledby="h-telemetry">
          <CompareChart
            headingId="h-telemetry"
            laps={compared} refLap={refLap} focusId={focus?.lap.id ?? null} session={session}
            zones={verdict?.losses ?? []} activeZone={activeZone}
            range={range} zoomed={zoom !== null} onZoom={(r) => { setActiveZone(null); zoomTo(r); }}
          />
        </section>

        <section className="a-section" aria-labelledby="h-minis">
          <MiniCompare headingId="h-minis" laps={compared} refLap={refLap} len={len} range={zoom}
            onMini={(k) => { setActiveZone(null); zoomTo({ from: (k * len) / 25 - 60, to: ((k + 1) * len) / 25 + 60 }); }} />
        </section>

        <section className="a-section" aria-labelledby="h-energy">
          <EnergyCompare headingId="h-energy" laps={compared} trackLength={len} range={range} />
        </section>

        <section className="a-section" aria-labelledby="h-data">
          <LapTable headingId="h-data" laps={laps} driverLaps={driverLaps} ownerOf={ownerOf} bests={bests}
            refLap={refLap} colourOf={(id) => { const s = selected.find((x) => x.id === id); return s ? LAP_COLOURS[s.slot] : null; }} />
        </section>
      </div>
    </div>
  );
}
