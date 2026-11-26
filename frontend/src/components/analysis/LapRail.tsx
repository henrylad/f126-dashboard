import { savedDate, type Lap } from '../../laps/lapMath.ts';
import { hasTelemetry } from '../../laps/lossZones.ts';
import { code, delta as fmtDelta, lapTime } from '../../lib/format.ts';
import { LAP_COLOURS } from '../../lib/chart.ts';
import type { Bests } from './LapAnalysis.tsx';

export type Filter = 'all' | 'valid' | 'fastest5';
const FILTERS: [Filter, string][] = [['all', 'All'], ['valid', 'Valid'], ['fastest5', 'Fastest 5']];

const KIND_LABEL: Record<Lap['kind'], string> = {
  timed: '', invalid: 'Invalid', out: 'Out-lap', in: 'In-lap', pit: 'Pit', partial: 'Partial',
};

interface Owner { name: string; colour: string }

interface Props {
  laps: Lap[];
  driverLaps: Lap[];
  /** Your fastest laps here from earlier sessions. */
  savedLaps: Lap[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  ownerOf: (l: Lap) => Owner;
  labelOf: (l: Lap) => string;
  bests: Bests;
  refLap: Lap | null;
  selected: { id: number; slot: number }[];
  onToggle: (id: number) => void;
  onRef: (id: number) => void;
  presets: Record<'bestVsLast' | 'meVsFastest' | 'meVsSaved' | 'meVsTop3' | 'clear', (() => void) | null>;
  activePreset: string | null;
  slotColour: (id: number, slot: number) => string;
}

export function LapRail({ laps, driverLaps, savedLaps, filter, onFilter, ownerOf, labelOf, bests, refLap, selected, onToggle, onRef, presets, activePreset, slotColour }: Props) {
  const timed = laps.filter((l) => l.kind === 'timed');
  const shown = filter === 'all' ? laps : filter === 'valid' ? timed : [...timed].sort((a, b) => a.timeMs - b.timeMs).slice(0, 5);
  const full = selected.length >= LAP_COLOURS.length;

  const row = (l: Lap, driver: boolean) => {
    const slot = selected.find((s) => s.id === l.id)?.slot;
    const colour = slot === undefined ? null : slotColour(l.id, slot);
    const valid = l.kind === 'timed';
    const telemetry = hasTelemetry(l);
    const isRef = refLap?.id === l.id;
    const gap = valid && refLap && !isRef ? l.timeMs - refLap.timeMs : null;
    const best = valid && l.timeMs === bests.time;
    const yourBest = !driver && valid && l.timeMs === bests.yourTime;
    const owner = driver ? ownerOf(l) : null;
    const date = savedDate(l);
    const name = driver ? `${owner!.name} lap ${l.lap}` : date ? `lap ${l.lap} from ${date}` : `lap ${l.lap}`;
    const disabled = !telemetry || (!colour && full);
    return (
      <li key={l.id} className={`rail-row${colour ? ' on' : ''}${valid ? '' : ' untimed'}`}>
        <label className="rail-pick" title={!telemetry ? 'No telemetry for this lap: the driver keeps it private' : !colour && full ? `Up to ${LAP_COLOURS.length} laps at once. Uncheck one to add this lap.` : undefined}>
          <input type="checkbox" className="lap-check" checked={!!colour} disabled={disabled}
            style={colour ? { '--slot': colour } as React.CSSProperties : undefined}
            onChange={() => onToggle(l.id)} aria-label={`Compare ${name}`} />
          <span className="rail-lap">
            {owner && <i className="team-dot" style={{ background: owner.colour }} aria-hidden />}
            <b className="num">{driver ? code(owner!.name) : date || `L${l.lap}`}</b>
            {(driver || date) && <span className="num dim">L{l.lap}</span>}
            {KIND_LABEL[l.kind] && <span className="kind">{KIND_LABEL[l.kind]}</span>}
            {!telemetry && <span className="kind">Private</span>}
          </span>
          <span className={`num rail-time${best ? ' purple' : yourBest ? ' green' : ''}`}>
            {lapTime(l.timeMs)}
            {best && <span className="sr-only"> (session best)</span>}
            {!best && yourBest && <span className="sr-only"> (your best)</span>}
          </span>
          <span className={`num rail-gap${gap === null ? '' : gap > 0 ? ' lost' : gap < 0 ? ' gained' : ''}`}>
            {isRef ? '' : gap === null ? '' : gap === 0 ? '±0' : fmtDelta(gap)}
          </span>
        </label>
        <button className={`ref-btn${isRef ? ' on' : ''}`} aria-pressed={isRef} disabled={!valid || !telemetry}
          onClick={() => onRef(l.id)} aria-label={`Use ${name} as the reference`}
          title={!valid ? 'Only clean, timed laps can be the reference' : isRef ? 'The reference lap: every gap and delta is measured against it' : 'Measure everything against this lap'}>
          Ref
        </button>
      </li>
    );
  };

  return (
    <aside className="rail" aria-label="Laps to compare">
      <div className="rail-block">
        <div className="rail-head">
          <h2>Compare</h2>
          <span className={`num rail-count${full ? ' full' : ''}`} aria-live="polite">
            {selected.length} of {LAP_COLOURS.length}
          </span>
        </div>
        <div className="presets">
          {([['bestVsLast', 'Best vs last 3'], ['meVsFastest', 'Me vs fastest'], ['meVsTop3', 'Me vs top 3'], ['meVsSaved', 'Me vs all-time best']] as const).filter(([key]) => key !== 'meVsSaved' || savedLaps.length > 0).map(([key, label]) => (
            <button key={key} className={activePreset === key ? 'on' : ''} aria-pressed={activePreset === key}
              disabled={!presets[key]} onClick={presets[key] ?? undefined}>{label}</button>
          ))}
          <button className="quiet" disabled={!presets.clear} onClick={presets.clear ?? undefined}>Clear</button>
        </div>
        {refLap && <p className="rail-note">Gaps are to the reference, <b className="num">{labelOf(refLap)}</b> {lapTime(refLap.timeMs)}.</p>}
      </div>

      <div className="rail-block">
        <div className="rail-head">
          <h2>Your laps <span className="num dim">{laps.length}</span></h2>
          <span className="seg" role="group" aria-label="Show laps">
            {FILTERS.map(([f, label]) => (
              <button key={f} className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => onFilter(f)}>{label}</button>
            ))}
          </span>
        </div>
        {shown.length ? <ul className="rail-list">{shown.map((l) => row(l, false))}</ul> : <p className="rail-note">No valid laps yet. Out-laps and invalid laps show under All.</p>}
      </div>

      {savedLaps.length > 0 && (
        <div className="rail-block">
          <div className="rail-head">
            <h2>Earlier sessions <span className="num dim">{savedLaps.length}</span></h2>
            <span className="rail-count">Your fastest here</span>
          </div>
          <ul className="rail-list">{savedLaps.map((l) => row(l, false))}</ul>
        </div>
      )}

      <div className="rail-block">
        <div className="rail-head">
          <h2>Drivers' fastest <span className="num dim">{driverLaps.length}</span></h2>
        </div>
        {driverLaps.length
          ? <ul className="rail-list">{driverLaps.map((l) => row(l, true))}</ul>
          : <p className="rail-note">Each driver's best valid lap appears here once they set one.</p>}
      </div>
    </aside>
  );
}
