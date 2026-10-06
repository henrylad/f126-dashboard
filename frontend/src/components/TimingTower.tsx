import { useState } from 'react';
import type { CarRow } from '../api/types.ts';
import { compound, isRace, team } from '../lib/meta.ts';
import { code, gap, lapTime } from '../lib/format.ts';

export function TimingTower({ cars, sessionType }: { cars: CarRow[]; sessionType: number }) {
  const [mode, setMode] = useState<'interval' | 'leader'>('interval');
  const race = isRace(sessionType);
  const fastest = Math.min(...cars.map((c) => c.bestLapMs).filter(Boolean));

  return (
    <section className="panel tower">
      <h2>Timing <span className="aside">{cars.length} cars</span></h2>
      <div className="tower-head">
        <span>POS</span>
        <span />
        <span>DRIVER</span>
        {race ? (
          <button className="toggle" onClick={() => setMode(mode === 'interval' ? 'leader' : 'interval')} title="Toggle interval / gap to leader">
            {mode === 'interval' ? 'INT ⇄' : 'LEADER ⇄'}
          </button>
        ) : (
          <span style={{ textAlign: 'right' }}>BEST</span>
        )}
        <span style={{ textAlign: 'right' }}>LAST</span>
        <span style={{ textAlign: 'right' }}>TYRE</span>
      </div>
      <div className="tower-rows">
        {cars.map((c) => {
          const tyre = compound(c.compound);
          const pb = c.lastLapMs > 0 && c.lastLapMs === c.bestLapMs;
          const gapMs = mode === 'interval' ? c.intervalMs : c.gapToLeaderMs;
          return (
            <div key={c.idx} className={`tower-row${c.isPlayer ? ' player' : ''}`}>
              <span className="pos num">{c.position}</span>
              <span className="bar" style={{ background: team(c.teamId).colour }} />
              <span className="who" title={c.name}>
                <b>{code(c.name)}</b>
                <span className="num">{c.raceNumber || ''}</span>
                {c.pitStatus > 0 && <span className="tag pit">PIT</span>}
                {c.overtakeActive && <span className="tag ot" title="Overtake mode active">OT</span>}
              </span>
              {race ? (
                <span className="t num">{c.position === 1 ? (mode === 'interval' ? 'Interval' : 'Leader') : gap(gapMs)}</span>
              ) : (
                <span className={`t num best${c.bestLapMs === fastest ? ' purple' : ''}`}>{lapTime(c.bestLapMs)}</span>
              )}
              <span
                className={`t num ${c.lastLapMs && c.lastLapMs === fastest ? 'best purple' : pb ? '' : 'dim'}`}
                style={pb && c.lastLapMs !== fastest ? { color: 'var(--green)' } : undefined}
              >
                {lapTime(c.lastLapMs)}
              </span>
              <span className="tyre-cell">
                <span className="tyre" style={{ color: tyre.colour }}>{tyre.label}</span>
                <small className="num">{c.tyreAge}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
