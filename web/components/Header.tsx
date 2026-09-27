import type { Snapshot } from '../../shared/types.ts';
import { SAFETY_CAR, SESSION_TYPES, WEATHER, isRace, trackName } from '../../shared/meta.ts';
import { clock } from '../format.ts';

const SOURCE_LABEL = { udp: 'Live', sim: 'Simulator', replay: 'Replay' };

export function Header({ snap, connected, stale }: { snap: Snapshot | null; connected: boolean; stale: boolean }) {
  const s = snap?.session;
  const leaderLap = snap?.cars[0]?.lap ?? 0;
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          PIT WALL
          <small>F1 25 · 2026 SEASON</small>
        </div>
      </div>
      {s && (
        <>
          <div className="hstat">
            <span className="k">{SESSION_TYPES[s.sessionType] ?? 'Session'}</span>
            <span className="v big">{trackName(s.trackId)}</span>
          </div>
          {isRace(s.sessionType) ? (
            <div className="hstat">
              <span className="k">Lap</span>
              <span className="v big num">{Math.min(leaderLap, s.totalLaps)}<span style={{ color: 'var(--dim)' }}>/{s.totalLaps}</span></span>
            </div>
          ) : (
            <div className="hstat">
              <span className="k">Time left</span>
              <span className="v big num">{clock(s.timeLeft)}</span>
            </div>
          )}
          <div className="hstat">
            <span className="k">Weather</span>
            <span className="v">{WEATHER[s.weather] ?? '—'}</span>
          </div>
          <div className="hstat">
            <span className="k">Track / Air</span>
            <span className="v num">{s.trackTemp}° / {s.airTemp}°</span>
          </div>
          {s.safetyCar > 0 && <span className="badge sc">{SAFETY_CAR[s.safetyCar]}</span>}
        </>
      )}
      <div className="spacer" />
      {snap && !stale && (
        <span className="hstat" style={{ textAlign: 'right' }}>
          <span className="k">Packets/s</span>
          <span className="v num" style={{ fontSize: 14 }}>{snap.packetsPerSec}</span>
        </span>
      )}
      <span className={`badge ${connected && !stale ? 'live' : 'warn'}`}>
        <span className="dot" />
        {!connected ? 'Server offline' : stale ? 'No signal' : SOURCE_LABEL[snap!.source]}
        {snap?.gameVersion && !stale ? ` · v${snap.gameVersion}` : ''}
      </span>
    </header>
  );
}
