import type { Snapshot } from '../api/types.ts';
import { WEATHER } from '../lib/meta.ts';
import { clock } from '../lib/format.ts';

export function Feed({ snap }: { snap: Snapshot }) {
  const s = snap.session!;
  return (
    <section className="panel">
      <h2>Race control</h2>
      {snap.events.length === 0 ? (
        <p style={{ color: 'var(--dim)', margin: 0 }}>No messages yet.</p>
      ) : (
        <ul className="feed">
          {snap.events.map((e, i) => (
            <li key={`${e.t}-${i}`} className={e.code}>
              <span className="time num">{clock(e.t)}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      )}
      {s.pitWindowIdeal > 0 && (
        <div className="grid3" style={{ marginTop: 10 }}>
          <div className="kv"><div className="k">Pit ideal</div><div className="v num">L{s.pitWindowIdeal}</div></div>
          <div className="kv"><div className="k">Pit latest</div><div className="v num">L{s.pitWindowLatest}</div></div>
          <div className="kv"><div className="k">Rejoin</div><div className="v num">P{s.rejoinPosition}</div></div>
        </div>
      )}
      {s.forecast.length > 0 && (
        <div className="forecast">
          {s.forecast.map((f) => (
            <div key={f.offset}>
              <span className="num">+{f.offset}m</span>
              <b>{WEATHER[f.weather] ?? '—'}</b>
              <span className="num">{f.rain}% · {f.trackTemp}°</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
