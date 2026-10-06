import type { Lap } from '../../laps/lapMath.ts';
import type { Verdict as V, Zone } from '../../laps/lossZones.ts';
import { code, delta as fmtDelta, lapTime } from '../../lib/format.ts';
import type { Compared } from './CompareChart.tsx';

interface Props {
  verdict: V | null;
  focus: Compared | null;
  others: Compared[];
  refCompared: Compared | null;
  refLap: Lap | null;
  refLabel: string | null;
  onFocus: (id: number) => void;
  activeZone: number | null;
  onZone: (i: number) => void;
  yourBest: Lap | null;
  theoretical: number | null;
  fastestDriver: Lap | null;
  ownerOf: (l: Lap) => { name: string };
  laps: Lap[];
}

const km = (m: number) => (m / 1000).toFixed(2);
const secs = (ms: number) => (Math.abs(ms) / 1000).toFixed(3);
/** Figures in mono, words in the UI face. */
const N = ({ children }: { children: React.ReactNode }) => <span className="num">{children}</span>;

function where(z: Zone) {
  const minis = z.minis[0] === z.minis[1] ? <>mini <N>{z.minis[0]}</N></> : <>minis <N>{z.minis[0]}–{z.minis[1]}</N></>;
  return <><N>{km(z.from)}–{km(z.to)}</N> km <span className="dim">· S<N>{z.sector}</N> · {minis}</span></>;
}

const Swatch = ({ colour, dashed }: { colour: string; dashed?: boolean }) =>
  <i className={`sw${dashed ? ' dashed' : ''}`} style={{ color: colour, background: dashed ? undefined : colour }} aria-hidden />;

export function Verdict({ verdict, focus, others, refCompared, refLap, refLabel, onFocus, activeZone, onZone, yourBest, theoretical, fastestDriver, ownerOf }: Props) {
  const losses = verdict?.losses ?? [];
  // From the rounded figures shown, so the parts add up to the headline gap exactly.
  const explained = losses.reduce((a, z) => a + Math.round(z.ms), 0) + Math.round(verdict?.gain?.ms ?? 0);
  const elsewhere = verdict ? Math.round(verdict.gapMs) - explained : 0;

  return (
    <section className="a-section verdict" aria-labelledby="h-verdict">
      <h2 id="h-verdict" className="sr-only">Where the time went</h2>

      {!refLap || !refLabel ? (
        <p className="verdict-line muted">Pick a reference lap with <b>Ref</b> in the list. Every gap on this tab is measured against it.</p>
      ) : !focus || !verdict ? (
        <p className="verdict-line muted">
          <b>{refLabel}</b> is the reference. Tick another lap to see where it loses time.
        </p>
      ) : (
        <>
          <div className="verdict-head">
            <p className="verdict-line" aria-live="polite">
              <Swatch colour={focus.colour} /> <b>{focus.label}</b> is{' '}
              <span className={`gap ${verdict.gapMs > 0 ? 'lost' : 'gained'}`}>{verdict.gapMs === 0 ? 'level' : <><N>{secs(verdict.gapMs)}</N> s {verdict.gapMs > 0 ? 'slower' : 'faster'}</>}</span>
              {verdict.gapMs === 0 ? ' with ' : ' than '}
              <b>{refLabel}</b>
              <span className="dim"> (ref)</span>
            </p>
            {others.length > 1 && (
              <span className="seg" role="group" aria-label="Explain lap">
                {others.map((c) => (
                  <button key={c.lap.id} className={c === focus ? 'on' : ''} aria-pressed={c === focus} onClick={() => onFocus(c.lap.id)}>
                    <Swatch colour={c.colour} />{c.label}
                  </button>
                ))}
              </span>
            )}
          </div>

          {losses.length ? (
            <ol className="zones" aria-label="Where the time was lost, biggest first">
              {losses.map((z, i) => (
                <li key={i}>
                  <button className={`zone${activeZone === i ? ' on' : ''}`} aria-pressed={activeZone === i} onClick={() => onZone(i)}
                    title={activeZone === i ? 'Show the whole lap again' : 'Zoom every chart to this stretch'}>
                    <span className="zone-n num" aria-hidden>{i + 1}</span>
                    <span className="zone-where">{where(z)}</span>
                    <span className="zone-ms lost"><N>+{secs(z.ms)}</N> s</span>
                    <span className="zone-why">{z.why.length ? z.why.join(' · ') : 'no single channel stands out; compare the traces'}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="verdict-note">No stretch loses more than 0.015 s; the gap is spread evenly round the lap.</p>
          )}

          <p className="verdict-note">
            {verdict.gain && <><span className="gained"><N>−{secs(verdict.gain.ms)}</N> s</span> gained at {where(verdict.gain)}{verdict.gain.why.length ? <span className="dim"> · {verdict.gain.why.join(' · ')}</span> : null}<span className="sep" aria-hidden> · </span></>}
            <span className={elsewhere > 0 ? 'lost' : elsewhere < 0 ? 'gained' : ''}><N>{fmtDelta(elsewhere)}</N> s</span> over the rest of the lap
          </p>
        </>
      )}

      <dl className="facts">
        <div><dt>Your best</dt><dd className="num">{yourBest ? <>{lapTime(yourBest.timeMs)} <span className="dim">L{yourBest.lap}</span></> : '—'}</dd></div>
        <div title="The sum of your fastest time in each of the 25 mini sectors, across your valid laps">
          <dt>Your theoretical best</dt>
          <dd className="num">{theoretical ? <>{lapTime(Math.round(theoretical))} <span className="dim">{yourBest ? (Math.abs(theoretical - yourBest.timeMs) < 1 ? 'same as best' : fmtDelta(theoretical - yourBest.timeMs)) : ''}</span></> : '—'}</dd>
        </div>
        <div><dt>Fastest driver</dt><dd className="num">{fastestDriver ? <>{lapTime(fastestDriver.timeMs)} <span className="dim">{code(ownerOf(fastestDriver).name)}{yourBest ? ` · you ${fmtDelta(yourBest.timeMs - fastestDriver.timeMs)}` : ''}</span></> : '—'}</dd></div>
      </dl>
    </section>
  );
}
