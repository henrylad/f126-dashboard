import type { PlayerDetail } from '../api/types.ts';
import { lapTime, sectorTime } from '../lib/format.ts';

const LEDS = 15;

export function Cockpit({ p }: { p: PlayerDetail }) {
  const lit = Math.round((p.revLightsPct / 100) * LEDS);
  const gear = p.gear === 0 ? 'N' : p.gear === -1 ? 'R' : String(p.gear);
  return (
    <section className="panel">
      <h2>Driver <span className="aside num">Lap {p.lap} · {lapTime(p.currentLapMs)}</span></h2>
      <div className="cockpit">
        <div className="speed num">{p.speed}<small>KM/H</small></div>
        <div className="gear num">
          {gear}
          {p.suggestedGear > 0 && p.suggestedGear !== p.gear && <span className="hint">→{p.suggestedGear}</span>}
        </div>
        <div className="revs" aria-label={`Rev lights ${p.revLightsPct}%`}>
          {Array.from({ length: LEDS }, (_, i) => (
            <i key={i} className={`${i < lit ? 'on' : ''} ${i < 5 ? 'g' : i < 10 ? 'r' : 'b'}`} />
          ))}
        </div>
        <div className="pedals">
          <Meter label="Throttle" value={p.throttle} colour="var(--blue-soft)" />
          <Meter label="Brake" value={p.brake} colour="var(--red-soft)" />
        </div>
        <div className="cockpit-foot">
          <div className="kv"><div className="k">RPM</div><div className="v num">{p.rpm.toLocaleString()}</div></div>
          <div className="kv"><div className="k">S1 / S2</div><div className="v num" style={{ fontSize: 13 }}>{sectorTime(p.sector1Ms)} / {sectorTime(p.sector2Ms)}</div></div>
          <div className="kv"><div className="k">G lat / lon</div><div className="v num" style={{ fontSize: 13 }}>{p.gLat.toFixed(1)} / {p.gLon.toFixed(1)}</div></div>
        </div>
      </div>
    </section>
  );
}

function Meter({ label, value, colour }: { label: string; value: number; colour: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="meter">
      <div className="lbl"><span>{label.toUpperCase()}</span><span className="num">{pct}%</span></div>
      <div className="track"><div className="fill" style={{ width: `${pct}%`, background: colour }} /></div>
    </div>
  );
}
