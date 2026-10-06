import { MINI_SECTORS } from '../../laps/lapView.ts';
import type { Lap } from '../../laps/lapMath.ts';
import { delta as fmtDelta } from '../../lib/format.ts';
import type { Range } from '../../lib/chart.ts';
import type { Compared } from './CompareChart.tsx';

/** Differences inside this band read as level. */
const LEVEL_MS = 3;

interface Props {
  headingId: string;
  laps: Compared[];
  refLap: Lap | null;
  len: number;
  /** The charts' zoomed range; mini sectors outside it are dimmed. */
  range: Range | null;
  onMini: (k: number) => void;
}

/**
 * Each compared lap's mini-sector times against the reference lap's. The colour
 * scale follows the biggest difference on screen, so a 20 ms loss still reads.
 */
export function MiniCompare({ headingId, laps, refLap, len, range, onMini }: Props) {
  const head = (
    <div className="section-head">
      <h2 id={headingId}>Mini sectors</h2>
      <span className="aside">each lap's time in the 25 equal mini sectors, against the reference</span>
    </div>
  );
  const others = laps.filter((c) => c.lap.id !== refLap?.id);
  if (!refLap || !others.length) {
    return <>{head}<p className="section-note">{!refLap ? 'Pick a reference lap to compare mini sectors.' : 'Tick another lap to compare its mini sectors with the reference.'}</p></>;
  }

  const diffs = others.map(({ lap }) => lap.minis.map((m, k) => (m && refLap.minis[k] ? m.ms - refLap.minis[k]!.ms : null)));
  const scale = Math.max(40, ...diffs.flat().map((d) => Math.abs(d ?? 0)));
  const inView = (k: number) => !range || ((k + 1) * len) / MINI_SECTORS > range.from && (k * len) / MINI_SECTORS < range.to;

  return (
    <>
      {head}
      <div className="mini-wrap">
        <table className="mini-table num">
          <thead>
            <tr>
              <th scope="col" className="mini-lap">Lap</th>
              {Array.from({ length: MINI_SECTORS }, (_, k) => (
                <th key={k} scope="col" className={inView(k) ? '' : 'out'}>
                  <button onClick={() => onMini(k)} aria-label={`Zoom to mini sector ${k + 1}`}>{k + 1}</button>
                </th>
              ))}
              <th scope="col" title="Sum of the mini-sector differences: the gap to the reference">Net</th>
            </tr>
          </thead>
          <tbody>
            <tr className="ref-row">
              <th scope="row" className="mini-lap"><i className="sw dashed" style={{ color: laps.find((c) => c.lap.id === refLap.id)?.colour ?? 'var(--muted)' }} aria-hidden />ref</th>
              {refLap.minis.map((m, k) => <td key={k} className={inView(k) ? '' : 'out'}>{m ? (m.ms / 1000).toFixed(2) : '—'}</td>)}
              <td />
            </tr>
            {others.map(({ lap, colour, label }, row) => {
              let net = 0;
              return (
                <tr key={lap.id}>
                  <th scope="row" className="mini-lap"><i className="sw" style={{ background: colour }} aria-hidden />{label}</th>
                  {diffs[row].map((d, k) => {
                    if (d === null) return <td key={k} className={inView(k) ? '' : 'out'}>—</td>;
                    net += d;
                    const level = Math.abs(d) < LEVEL_MS;
                    const a = Math.min(1, Math.abs(d) / scale);
                    const bg = level ? undefined : d > 0 ? `rgba(248, 81, 73, ${0.12 + a * 0.55})` : `rgba(86, 211, 100, ${0.1 + a * 0.4})`;
                    return (
                      <td key={k} className={`cell${level ? ' level' : ''}${inView(k) ? '' : ' out'}`} style={{ background: bg }}
                        title={`Mini ${k + 1}: ${fmtDelta(d)} s against the reference`}>
                        {level ? '·' : `${d > 0 ? '+' : '−'}${(Math.abs(d) / 1000).toFixed(3).replace(/^0/, '')}`}
                      </td>
                    );
                  })}
                  <td className={`net ${net > 0 ? 'lost' : 'gained'}`}>{fmtDelta(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
