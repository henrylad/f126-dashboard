import { MINI_SECTORS } from '../../laps/lapView.ts';
import type { Lap } from '../../laps/lapMath.ts';
import { delta as fmtDelta, lapTime } from '../../lib/format.ts';
import type { Compared } from './CompareChart.tsx';

/** Loss (ms) at which a cell reaches full intensity. */
const FULL_LOSS_MS = 300;

/**
 * Heatmap of mini-sector times: each cell is the loss against the best time in
 * that mini sector among your valid laps and the laps being compared (so a
 * faster driver's mini sector becomes the benchmark). Purple ● = that best;
 * deeper red = more time lost.
 */
export function MiniCompare({ laps, allLaps }: { laps: Compared[]; allLaps: Lap[] }) {
  const timed = [...allLaps.filter((l) => l.kind === 'timed'), ...laps.map((c) => c.lap).filter((l) => l.kind === 'timed')];
  const best = Array.from({ length: MINI_SECTORS }, (_, k) => {
    const v = timed.map((l) => l.minis[k]?.ms).filter((x): x is number => !!x);
    return v.length ? Math.min(...v) : null;
  });
  const theoretical = best.every((b) => b !== null) ? best.reduce((a, b) => a + b!, 0) : null;

  if (!laps.length) return <p className="dim">Select laps in the table to compare their mini sectors.</p>;

  return (
    <div className="mini-wrap">
      <table className="mini-table num">
        <thead>
          <tr>
            <th>Lap</th>
            {best.map((_, k) => <th key={k}>{k + 1}</th>)}
            <th title="Sum of the time lost in each mini sector">Lost</th>
          </tr>
        </thead>
        <tbody>
          <tr className="best-row">
            <td>Best{theoretical !== null && <small className="dim"> {lapTime(Math.round(theoretical))}</small>}</td>
            {best.map((b, k) => <td key={k} className="cell best" title={b ? `Best mini ${k + 1}: ${(b / 1000).toFixed(3)} s` : undefined}>{b ? (b / 1000).toFixed(2) : '—'}</td>)}
            <td />
          </tr>
          {laps.map(({ lap, colour, label }) => {
            let lost = 0;
            return (
              <tr key={lap.id}>
                <td><i className="sw" style={{ background: colour }} />{label}</td>
                {lap.minis.map((m, k) => {
                  const b = best[k];
                  if (!m || !b) return <td key={k} className="cell">—</td>;
                  const loss = m.ms - b;
                  lost += Math.max(0, loss);
                  const isBest = loss <= 0.5;
                  const a = Math.min(1, loss / FULL_LOSS_MS);
                  return (
                    <td key={k} className={`cell${isBest ? ' best' : ''}`} title={`Mini ${k + 1}: ${(m.ms / 1000).toFixed(3)} s${isBest ? ' (best)' : ` · ${fmtDelta(loss)} vs best`}`}
                      style={isBest ? undefined : { background: `rgba(255, 51, 85, ${0.18 + a * 0.62})` }}>
                      {isBest ? '●' : `+${(loss / 1000).toFixed(3).replace(/^0/, '')}`}
                    </td>
                  );
                })}
                <td className="lost">{fmtDelta(lost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
