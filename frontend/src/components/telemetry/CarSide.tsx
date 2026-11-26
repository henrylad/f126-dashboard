import type { ReactNode } from 'react';
import type { PlayerDetail, TyreSetsInfo } from '../../api/types.ts';
import { delta as fmtDelta, gap, lapTime, sectorTime } from '../../lib/format.ts';
import {
  ACTUAL_TO_LABEL, DRIVER_STATUS, FIA_FLAGS, FUEL_MIX, PIT_STATES, RESULT_STATUS, SESSION_TYPES, SURFACES, TRACTION_CONTROL, compound,
} from '../../lib/meta.ts';
import { tempColour } from '../Tyres.tsx';
import { WHEEL_NAMES, WHEEL_ORDER } from './ChassisSection.tsx';

const n = (v: number | string, unit?: string) => <><span className="num">{v}</span>{unit && <span className="dim"> {unit}</span>}</>;
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

function Block({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rail-block" aria-labelledby={id}>
      <div className="rail-head">
        <h2 id={id}>{title}</h2>
        {aside && <span className="rail-count">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function KV({ rows }: { rows: [string, ReactNode, string?][] }) {
  return (
    <dl className="kvl">
      {rows.map(([k, v, cls]) => <div key={k}><dt>{k}</dt><dd className={cls}>{v}</dd></div>)}
    </dl>
  );
}

function WearRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const colour = v >= 50 ? 'var(--red)' : v >= 25 ? 'var(--amber)' : 'var(--muted)';
  return (
    <div className="wear-row">
      <span className="wl">{label}</span>
      <span className="wb" aria-hidden="true"><span style={{ width: `${v}%`, background: colour }} /></span>
      <span className="wv num">{Math.round(value)}%</span>
    </div>
  );
}

export function CarSide({ p }: { p: PlayerDetail }) {
  const tyre = compound(p.visualCompound);
  const r = p.race;
  const d = p.damage;
  const s = p.setup;
  const faults = [d.drsFault && 'DRS fault', d.ersFault && 'ERS fault', d.engineBlown && 'Engine blown', d.engineSeized && 'Engine seized'].filter(Boolean) as string[];
  const flag = FIA_FLAGS[p.fiaFlag] ?? '—';

  return (
    <aside className="tele-side" aria-label="Car state">
      <Block id="tele-tyres" title="Tyres & brakes" aside={<><span className="tyre" style={{ color: tyre.colour, width: 18, height: 18, fontSize: 9 }}>{tyre.label}</span> {ACTUAL_TO_LABEL[p.compound] ?? ''} · {n(p.tyreAge, 'laps')}</>}>
        <table className="wheel-table">
          <thead><tr><th />{WHEEL_NAMES.map((w) => <th key={w} scope="col">{w}</th>)}</tr></thead>
          <tbody>
            <WheelRow label="Surface °C" values={p.tyresSurface} colour />
            <WheelRow label="Inner °C" values={p.tyresInner} colour />
            <WheelRow label="Pressure psi" values={p.tyresPressure} fmt={(v) => v.toFixed(1)} />
            <WheelRow label="Wear %" values={p.tyresWear} fmt={(v) => v.toFixed(1)} />
            <WheelRow label="Damage %" values={p.tyresDamage} />
            <WheelRow label="Blisters %" values={p.tyreBlisters} />
            <WheelRow label="Brake °C" values={p.brakesTemp} />
            <WheelRow label="Brake dmg %" values={p.brakesDamage} />
            <tr>
              <th scope="row">Surface</th>
              {WHEEL_ORDER.map((i) => <td key={i} className={p.surfaceType[i] ? 'warn' : ''}>{SURFACES[p.surfaceType[i]] ?? p.surfaceType[i]}</td>)}
            </tr>
          </tbody>
        </table>
      </Block>

      <Block id="tele-sets" title="Tyre sets" aside={p.tyreSets ? <>{n(p.tyreSets.sets.filter((t) => t.available).length)} available</> : undefined}>
        {p.tyreSets ? <TyreSets info={p.tyreSets} /> : <p className="rail-note">Appears once the game sends your tyre sets (packet 12).</p>}
      </Block>

      <Block id="tele-car" title="Car">
        <KV rows={[
          ['Fuel', <>{n(p.fuelKg.toFixed(2), 'kg')}{p.fuelCapacityKg > 0 && <span className="dim"> of <span className="num">{p.fuelCapacityKg.toFixed(0)}</span></span>}</>],
          ['Fuel vs race distance', n(`${p.fuelLaps >= 0 ? '+' : '−'}${Math.abs(p.fuelLaps).toFixed(2)}`, 'laps'), p.fuelLaps < 0 ? 'lost' : ''],
          ['Fuel mix', FUEL_MIX[p.fuelMix] ?? '—'],
          ['Brake bias', n(`${p.brakeBias}%`, 'front')],
          ['Traction control', TRACTION_CONTROL[p.tractionControl] ?? n(p.tractionControl)],
          ['ABS', p.abs ? 'On' : 'Off'],
          ['Engine temp', n(p.engineTemp, '°C')],
          ['RPM', <>{n(p.rpm.toLocaleString('en-US'))}<span className="dim"> · idle <span className="num">{p.idleRpm.toLocaleString('en-US')}</span> · max <span className="num">{p.maxRpm.toLocaleString('en-US')}</span></span></>],
          ['Rev lights', n(`${p.revLightsPct}%`)],
          ['Gears', n(p.maxGears || '—')],
          ['Clutch', n(`${p.clutch}%`)],
          ['Pit limiter', p.pitLimiter ? 'On' : 'Off', p.pitLimiter ? 'warn' : ''],
          ['DRS', p.drsAllowed || p.drs ? <>{p.drs ? 'Open' : 'Allowed'}{p.drsActivationDistance > 0 && <span className="dim"> · in <span className="num">{p.drsActivationDistance} m</span></span>}</> : 'Not allowed'],
          ['FIA flag', flag, p.fiaFlag === 3 ? 'warn' : ''],
        ]} />
      </Block>

      <Block id="tele-pu" title="Power unit & damage" aside={faults.length ? <span className="lost">{faults.join(' · ')}</span> : undefined}>
        <div className="wear-list">
          <WearRow label="ICE" value={d.ice} />
          <WearRow label="MGU-K" value={d.mguk} />
          <WearRow label="MGU-H" value={d.mguh} />
          <WearRow label="Energy store" value={d.es} />
          <WearRow label="Control electronics" value={d.ce} />
          <WearRow label="Turbocharger" value={d.tc} />
          <WearRow label="Gearbox" value={d.gearbox} />
          <WearRow label="Engine" value={d.engine} />
        </div>
        <div className="wear-list" style={{ marginTop: 10 }}>
          <WearRow label="Front wing left" value={d.frontLeftWing} />
          <WearRow label="Front wing right" value={d.frontRightWing} />
          <WearRow label="Rear wing" value={d.rearWing} />
          <WearRow label="Floor" value={d.floor} />
          <WearRow label="Diffuser" value={d.diffuser} />
          <WearRow label="Sidepod" value={d.sidepod} />
        </div>
      </Block>

      <Block id="tele-race" title="Lap & race control">
        <KV rows={[
          ['Position', <>{n(`P${r.position}`)}<span className="dim"> · grid <span className="num">P{r.gridPosition}</span></span></>],
          ['Lap', <>{n(p.lap)}<span className="dim"> · sector <span className="num">{r.sector + 1}</span></span></>],
          ['Current lap', n(lapTime(p.currentLapMs)), r.currentLapInvalid ? 'lost' : ''],
          ['Lap valid', r.currentLapInvalid ? 'No' : 'Yes', r.currentLapInvalid ? 'lost' : ''],
          ['Last lap', n(lapTime(r.lastLapMs))],
          ['S1 / S2', n(`${sectorTime(p.sector1Ms)} / ${sectorTime(p.sector2Ms)}`)],
          ['Lap distance', n(Math.max(0, p.lapDistance).toFixed(0), 'm')],
          ['Total distance', n((r.totalDistance / 1000).toFixed(2), 'km')],
          ['Gap ahead', r.position > 1 ? n(gap(r.gapAheadMs)) : '—'],
          ['Gap to leader', r.position > 1 ? n(gap(r.gapLeaderMs)) : 'Leading'],
          ['Speed trap', p.speedTrapKmh > 0 ? <>{n(p.speedTrapKmh.toFixed(1), 'km/h')}{r.speedTrapLap !== 255 && <span className="dim"> · lap <span className="num">{r.speedTrapLap}</span></span>}</> : '—'],
          ['Warnings', <>{n(r.totalWarnings)}<span className="dim"> · corner cutting <span className="num">{r.cornerCuttingWarnings}</span></span></>, r.totalWarnings ? 'warn' : ''],
          ['Penalties', n(r.penaltiesSec, 's'), r.penaltiesSec ? 'lost' : ''],
          ['Unserved', <>{n(r.unservedDriveThroughs)}<span className="dim"> drive-through · </span>{n(r.unservedStopGos)}<span className="dim"> stop-go</span></>, r.unservedDriveThroughs + r.unservedStopGos ? 'lost' : ''],
          ['Pit', <>{PIT_STATES[r.pitStatus] ?? '—'}<span className="dim"> · stops <span className="num">{r.numPitStops}</span></span></>],
          ['Pit lane time', r.pitLaneTimerActive || r.pitLaneTimeMs ? n((r.pitLaneTimeMs / 1000).toFixed(1), 's') : '—'],
          ['Pit stop time', r.pitStopTimerMs ? n((r.pitStopTimerMs / 1000).toFixed(1), 's') : '—'],
          ['Serve penalty at stop', yesNo(r.servePenaltyAtStop)],
          ['Safety car delta', r.safetyCarDelta ? n(r.safetyCarDelta.toFixed(2), 's') : '—'],
          ['Driver status', DRIVER_STATUS[r.driverStatus] ?? '—'],
          ['Result status', RESULT_STATUS[r.resultStatus] ?? '—'],
        ]} />
      </Block>

      <Block id="tele-setup" title="Setup">
        {s ? (
          <KV rows={[
            ['Front / rear wing', n(`${s.frontWing} / ${s.rearWing}`)],
            ['Next front wing', n(s.nextFrontWing.toFixed(0))],
            ['Diff on / off throttle', n(`${s.onThrottle}% / ${s.offThrottle}%`)],
            ['Engine braking', n(`${s.engineBraking}%`)],
            ['Camber front / rear', n(`${s.frontCamber.toFixed(2)}° / ${s.rearCamber.toFixed(2)}°`.replace(/-/g, '−'))],
            ['Toe front / rear', n(`${s.frontToe.toFixed(2)}° / ${s.rearToe.toFixed(2)}°`)],
            ['Suspension front / rear', n(`${s.frontSuspension} / ${s.rearSuspension}`)],
            ['Anti-roll bar front / rear', n(`${s.frontAntiRollBar} / ${s.rearAntiRollBar}`)],
            ['Ride height front / rear', n(`${s.frontRideHeight} / ${s.rearRideHeight}`)],
            ['Brake pressure', n(`${s.brakePressure}%`)],
            ['Brake bias', n(`${s.brakeBias}%`)],
            ['Tyre pressure FL / FR', n(`${s.tyresPressure[2].toFixed(1)} / ${s.tyresPressure[3].toFixed(1)}`, 'psi')],
            ['Tyre pressure RL / RR', n(`${s.tyresPressure[0].toFixed(1)} / ${s.tyresPressure[1].toFixed(1)}`, 'psi')],
            ['Ballast', n(s.ballast)],
            ['Fuel load', n(s.fuelLoad.toFixed(1), 'kg')],
          ]} />
        ) : (
          <p className="rail-note">Appears once the game sends car setups (packet 5). Online, other cars’ setups stay hidden.</p>
        )}
      </Block>
    </aside>
  );
}

function WheelRow({ label, values, fmt = (v) => v.toFixed(0), colour = false }: { label: string; values: number[]; fmt?: (v: number) => string; colour?: boolean }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {WHEEL_ORDER.map((i) => {
        const v = values[i] ?? 0;
        return (
          <td key={i} className="num">
            {colour && <i className="temp-dot" style={{ background: tempColour(v) }} />}
            {fmt(v)}
          </td>
        );
      })}
    </tr>
  );
}

/** Every set for the weekend: compound, wear, laps left, and pace against the fitted set. */
function TyreSets({ info }: { info: TyreSetsInfo }) {
  return (
    <table className="wheel-table sets-table">
      <thead>
        <tr>
          <th scope="col">Set</th>
          <th scope="col" title="Wear, %">Wear</th>
          <th scope="col" title="Laps left of the recommended life">Laps left</th>
          <th scope="col" title="Lap time against the fitted set">Δ lap</th>
          <th scope="col" title="Session the game recommends this set for">For</th>
        </tr>
      </thead>
      <tbody>
        {info.sets.map((t, i) => {
          const c = compound(t.visualCompound);
          return (
            <tr key={i} className={`${t.fitted ? 'fitted' : ''} ${t.available ? '' : 'gone'}`}>
              <th scope="row">
                <span className="tyre" style={{ color: c.colour, width: 18, height: 18, fontSize: 9 }}>{c.label}</span>
                <span className="dim"> {ACTUAL_TO_LABEL[t.actualCompound] ?? ''}</span>
                {t.fitted && <span className="kind" style={{ marginLeft: 6 }}>Fitted</span>}
              </th>
              <td className="num">{t.wear}%</td>
              <td className="num">{t.lifeSpan}<span className="dim"> / {t.usableLife}</span></td>
              <td className={`num ${t.fitted ? 'dim' : t.lapDeltaMs < 0 ? 'gained' : t.lapDeltaMs > 0 ? 'lost' : ''}`}>{t.fitted ? '—' : t.lapDeltaMs === 0 ? '±0.000' : fmtDelta(t.lapDeltaMs)}</td>
              <td>{t.available ? (SESSION_TYPES[t.recommendedSession] ?? '—').replace('Qualifying', 'Quali') : 'Used up'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
