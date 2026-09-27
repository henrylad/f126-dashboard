import type { PlayerDetail } from '../../shared/types.ts';
import { ACTUAL_TO_LABEL, compound } from '../../shared/meta.ts';

// Diverging scale around the working window: cold (blue) → optimal (neutral) → hot (red).
const COLD = [77, 157, 255], OPT = [201, 209, 234], HOT = [255, 77, 77];
const WINDOW = { lo: 80, opt: 98, hi: 118 };

function tempColour(t: number): string {
  const mix = (a: number[], b: number[], f: number) =>
    `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, f)))).join(',')})`;
  return t < WINDOW.opt
    ? mix(COLD, OPT, (t - WINDOW.lo) / (WINDOW.opt - WINDOW.lo))
    : mix(OPT, HOT, (t - WINDOW.opt) / (WINDOW.hi - WINDOW.opt));
}

// Data arrays are [RL, RR, FL, FR]; display order is FL, FR, RL, RR.
const LAYOUT = [
  { i: 2, name: 'FL', side: 'left' },
  { i: 3, name: 'FR', side: 'right' },
  { i: 0, name: 'RL', side: 'left' },
  { i: 1, name: 'RR', side: 'right' },
] as const;

export function Tyres({ p }: { p: PlayerDetail }) {
  const c = compound(p.visualCompound);
  return (
    <section className="panel">
      <h2>
        Tyres
        <span className="aside" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="tyre" style={{ color: c.colour }}>{c.label}</span>
          <span className="num">{ACTUAL_TO_LABEL[p.compound] ?? ''} · {p.tyreAge} laps</span>
        </span>
      </h2>
      <div className="tyres">
        {LAYOUT.map(({ i, name, side }) => (
          <div key={name} className={`wheel ${side}`} style={{ gridColumn: side === 'left' ? 1 : 3 }}>
            <div className="tyre-block" style={{ background: tempColour(p.tyresSurface[i]) }} title={`${name} surface ${p.tyresSurface[i]}°C`}>
              <div className="wear" style={{ height: `${Math.min(100, p.tyresWear[i])}%` }} />
            </div>
            <div className="info num">
              <span className="temp">{p.tyresSurface[i]}°</span>
              <span>inner {p.tyresInner[i]}°</span>
              <span>{p.tyresPressure[i].toFixed(1)} psi</span>
              <span>wear <b style={{ color: 'var(--text)' }}>{p.tyresWear[i].toFixed(1)}%</b></span>
              <span>brake {p.brakesTemp[i]}°</span>
            </div>
          </div>
        ))}
        <div className="car-body" aria-hidden />
      </div>
      <div className="scale num"><span>{WINDOW.lo}°</span><div className="ramp" /><span>{WINDOW.hi}°C</span></div>
    </section>
  );
}
