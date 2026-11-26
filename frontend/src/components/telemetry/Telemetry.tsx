import { useRef, useState } from 'react';
import { ERS_MAX_J, type PlayerDetail, type Snapshot } from '../../api/types.ts';
import type { LapView } from '../../laps/lapView.ts';
import { delta as fmtDelta, lapTime } from '../../lib/format.ts';
import { download, stamp, windowCsv } from '../../lib/csv.ts';
import { ENERGY, ERS_MODES } from '../../lib/meta.ts';
import { TelemetryHistory } from './history.ts';
import { CHANNEL_DEFS, RollingChart } from './RollingChart.tsx';
import { EnergySection, EnergyPerLap } from './EnergySection.tsx';
import { ChassisSection } from './ChassisSection.tsx';
import { CarSide } from './CarSide.tsx';

const WINDOWS = [10, 30, 60, 120];
const WINDOW_KEY = 'pitwall.telemetry.window';
const HIDDEN_KEY = 'pitwall.telemetry.hidden';
const REF_KEY = 'pitwall.telemetry.ref';

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* per-browser convenience only */ }
}

export function Telemetry({ snap, store }: { snap: Snapshot; store: LapView }) {
  const p = snap.player!;
  const history = useRef(new TelemetryHistory()).current;
  // Idempotent: a snapshot without a newer session time is ignored.
  history.push(snap);

  const [windowS, setWindowS] = useState<number>(() => {
    const w = load(WINDOW_KEY, 30);
    return WINDOWS.includes(w) ? w : 30;
  });
  const [hidden, setHidden] = useState<string[]>(() => load<string[]>(HIDDEN_KEY, []));
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [withRef, setWithRef] = useState<boolean>(() => load(REF_KEY, true));
  const best = store.bestLap;

  const latest = history.samples.at(-1)?.t ?? snap.sessionTime;
  const end = pausedAt ?? latest;
  const available = CHANNEL_DEFS.filter((c) => !c.chassis || p.chassis);
  const shown = available.filter((c) => !hidden.includes(c.key));

  const pickWindow = (w: number) => { setWindowS(w); save(WINDOW_KEY, w); };
  const toggleRef = () => { setWithRef(!withRef); save(REF_KEY, !withRef); };
  const exportWindow = () => download(`pitwall-telemetry-${stamp()}.csv`, windowCsv(history.samples, end - windowS, end));
  const toggle = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    setHidden(next);
    save(HIDDEN_KEY, next);
  };

  return (
    <div className="tele">
      <Strip p={p} flowKw={history.samples.at(-1)?.flowKw ?? 0} deltaMs={store.delta()} />
      <div className="tele-body">
        <div className="tele-main">
          <section className="a-section" aria-labelledby="tele-live">
            <div className="section-head">
              <h2 id="tele-live">Live channels</h2>
              <span className="aside">Session time, newest on the right</span>
              <div className="head-tools">
                <div className="seg" role="group" aria-label="Time window">
                  {WINDOWS.map((w) => (
                    <button key={w} className={w === windowS ? 'on' : ''} aria-pressed={w === windowS} onClick={() => pickWindow(w)}>
                      {w < 60 ? `${w} s` : `${w / 60} min`}
                    </button>
                  ))}
                </div>
                <button className="btn" aria-pressed={withRef && !!best} disabled={!best} onClick={toggleRef}
                  title={best ? `Your best lap ${lapTime(best.timeMs)}, dashed, at the same point on the lap` : 'Available after your first timed lap'}>
                  vs best lap
                </button>
                <button className="btn" onClick={exportWindow} disabled={history.samples.length < 2} title="Download the shown time window as CSV">CSV</button>
                <button className={`btn ${pausedAt !== null ? 'held' : ''}`} aria-pressed={pausedAt !== null} onClick={() => setPausedAt(pausedAt === null ? latest : null)}>
                  {pausedAt === null ? 'Hold' : 'Resume'}
                </button>
              </div>
            </div>
            <div className="chips" role="group" aria-label="Channels">
              {available.map((c) => (
                <button key={c.key} className={`chip ${hidden.includes(c.key) ? '' : 'on'}`} aria-pressed={!hidden.includes(c.key)} onClick={() => toggle(c.key)}>
                  {c.label.split(' · ')[0]}
                </button>
              ))}
            </div>
            {pausedAt !== null && (
              <p className="section-note held-note">Held at this moment; recording continues. Resume to follow live again.</p>
            )}
            {shown.length ? (
              <RollingChart history={history} windowS={windowS} end={end} channels={shown} refLap={withRef && best ? best.samples : null} />
            ) : (
              <p className="section-note">All channels are hidden. Pick one above.</p>
            )}
          </section>
          <EnergySection p={p} flowKw={history.samples.at(-1)?.flowKw ?? 0} />
          <ChassisSection p={p} history={history} end={end} />
          <EnergyPerLap laps={store.laps} />
        </div>
        <CarSide p={p} />
      </div>
    </div>
  );
}

/** One row of figures readable at a glance. */
function Strip({ p, flowKw, deltaMs }: { p: PlayerDetail; flowKw: number; deltaMs: number | null }) {
  const gear = p.gear === 0 ? 'N' : p.gear < 0 ? 'R' : String(p.gear);
  const ers = Math.max(0, Math.min(100, (p.ersStoreJ / ERS_MAX_J) * 100));
  const deploying = flowKw > 2, harvesting = flowKw < -2;
  const alerts = [
    p.wrongWay && 'Wrong way',
    p.race.currentLapInvalid && 'Lap invalid',
    p.pitLimiter && 'Pit limiter',
    p.fiaFlag === 3 && 'Yellow flag',
    p.fiaFlag === 2 && 'Blue flag',
    p.damage.ersFault && 'ERS fault',
    p.damage.engineBlown && 'Engine blown',
    p.damage.engineSeized && 'Engine seized',
  ].filter(Boolean) as string[];
  return (
    <div className="tele-strip" role="group" aria-label="Live figures">
      <div className="ts big"><span className="k">Speed</span><span className="v num">{p.speed}<small>km/h</small></span></div>
      <div className="ts big">
        <span className="k">Gear</span>
        <span className="v num">{gear}{p.suggestedGear > 0 && p.suggestedGear !== p.gear && <small>→ {p.suggestedGear}</small>}</span>
      </div>
      <div className="ts"><span className="k">RPM</span><span className="v num">{p.rpm.toLocaleString('en-US')}</span><Bar value={p.rpm / (p.maxRpm || 1)} colour="var(--muted)" /></div>
      <div className="ts"><span className="k">Throttle</span><span className="v num">{Math.round(p.throttle * 100)}%</span><Bar value={p.throttle} colour="var(--green)" /></div>
      <div className="ts"><span className="k">Brake</span><span className="v num">{Math.round(p.brake * 100)}%</span><Bar value={p.brake} colour="var(--red)" /></div>
      <div className="ts"><span className="k">Steering</span><span className="v num">{Math.round(p.steer * 100) < 0 ? '−' : ''}{Math.abs(Math.round(p.steer * 100))}%</span><SteerBar value={p.steer} /></div>
      <div className="ts"><span className="k">Battery</span><span className="v num">{ers.toFixed(0)}%</span><Bar value={ers / 100} colour="var(--blue)" /></div>
      <div className="ts">
        <span className="k">ERS</span>
        <span className="v">
          <i className="sw" style={{ background: harvesting ? ENERGY[0].colour : deploying ? ENERGY[Math.max(1, p.ersDeployMode)].colour : 'var(--panel-2)' }} />
          {ERS_MODES[p.ersDeployMode] ?? '—'}
        </span>
        <span className="s">{harvesting ? <>Harvesting <span className="num">{Math.round(-flowKw)} kW</span></> : deploying ? <>Deploying <span className="num">{Math.round(flowKw)} kW</span></> : 'No flow'}</span>
      </div>
      <div className={`ts ${p.aeroMode === 1 ? 'aero-on' : ''}`}>
        <span className="k">Active aero</span>
        <span className="v">{p.aeroMode === 1 ? 'Straight' : 'Corner'}</span>
        <span className="s">{p.aeroMode === 1 ? 'Low drag' : p.aeroActivationDistance > 0 ? <>Zone in <span className="num">{p.aeroActivationDistance} m</span></> : p.aeroAvailable ? 'Available' : 'High downforce'}</span>
      </div>
      <div className={`ts ${p.overtakeActive ? 'ot-on' : ''}`}>
        <span className="k">Overtake</span>
        <span className="v">{p.overtakeActive ? 'Active' : p.overtakeAvailable ? 'Armed' : 'Off'}</span>
        <span className="s">{p.overtakeActivationDistance > 0 && !p.overtakeActive ? <>In <span className="num">{p.overtakeActivationDistance} m</span></> : p.overtakeActive ? 'Extra MGU-K deploy' : '—'}</span>
      </div>
      <div className="ts">
        <span className="k">Lap {p.lap}</span>
        <span className={`v num ${p.race.currentLapInvalid ? 'lost' : ''}`}>{lapTime(p.currentLapMs)}</span>
        <span className="s">Last <span className="num">{lapTime(p.race.lastLapMs)}</span></span>
      </div>
      <div className="ts">
        <span className="k">Δ best lap</span>
        <span className={`v num ${deltaMs === null ? 'dim' : deltaMs <= 0 ? 'gained' : 'lost'}`}>{deltaMs === null ? '—' : fmtDelta(deltaMs)}</span>
        <span className="s">{deltaMs === null ? 'After a timed lap' : 'Live, at this point'}</span>
      </div>
      {alerts.length > 0 && (
        <div className="ts alerts" role="status">
          {alerts.map((a) => <span key={a} className="alert">{a}</span>)}
        </div>
      )}
    </div>
  );
}

function Bar({ value, colour }: { value: number; colour: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return <span className="ts-bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: colour }} /></span>;
}

/** Centred bar: left of centre is steering left. */
function SteerBar({ value }: { value: number }) {
  const v = Math.max(-1, Math.min(1, value));
  return (
    <span className="ts-bar centred" aria-hidden="true">
      <span style={{ left: v < 0 ? `${50 + v * 50}%` : '50%', width: `${Math.abs(v) * 50}%`, background: 'var(--text)' }} />
    </span>
  );
}
