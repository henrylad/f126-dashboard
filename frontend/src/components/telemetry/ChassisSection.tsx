import type { ChassisInfo, PlayerDetail } from '../../api/types.ts';
import { GGDiagram } from './GGDiagram.tsx';
import type { TelemetryHistory } from './history.ts';

const DEG = 180 / Math.PI;
/** Data arrays are [RL, RR, FL, FR]; tables read FL, FR, RL, RR. */
export const WHEEL_ORDER = [2, 3, 0, 1] as const;
export const WHEEL_NAMES = ['FL', 'FR', 'RL', 'RR'];

type Row = [label: string, unit: string, values: (c: ChassisInfo) => number[], fmt: (v: number) => string];

const ROWS: Row[] = [
  ['Wheel speed', 'km/h', (c) => c.wheelSpeed.map((v) => v * 3.6), (v) => v.toFixed(0)],
  ['Slip ratio', '%', (c) => c.wheelSlipRatio.map((v) => v * 100), (v) => v.toFixed(1)],
  ['Slip angle', '°', (c) => c.wheelSlipAngle.map((v) => v * DEG), (v) => v.toFixed(2)],
  ['Vertical load', 'kN', (c) => c.wheelVertForce.map((v) => v / 1000), (v) => v.toFixed(2)],
  ['Lateral force', 'kN', (c) => c.wheelLatForce.map((v) => v / 1000), (v) => v.toFixed(2)],
  ['Longitudinal force', 'kN', (c) => c.wheelLongForce.map((v) => v / 1000), (v) => v.toFixed(2)],
  ['Suspension travel', '', (c) => c.suspensionPosition, (v) => v.toFixed(1)],
  ['Suspension velocity', '', (c) => c.suspensionVelocity, (v) => v.toFixed(0)],
  ['Camber', '°', (c) => c.wheelCamber.map((v) => v * DEG), (v) => v.toFixed(2)],
  ['Camber gain', '°', (c) => c.wheelCamberGain.map((v) => v * DEG), (v) => v.toFixed(2)],
];

const signed = (v: number, digits: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`;

export function ChassisSection({ p, history, end }: { p: PlayerDetail; history: TelemetryHistory; end: number }) {
  const c = p.chassis;
  return (
    <section className="a-section" aria-labelledby="tele-chassis">
      <div className="section-head">
        <h2 id="tele-chassis">Chassis &amp; wheels</h2>
        <span className="aside">G trail of the last 4 s</span>
      </div>
      <div className="chassis">
        <GGDiagram history={history} end={end} />
        <dl className="kvl two">
          <div><dt>G lateral</dt><dd className="num">{signed(p.gLat, 2)} g</dd></div>
          <div><dt>G longitudinal</dt><dd className="num">{signed(p.gLon, 2)} g</dd></div>
          <div><dt>G vertical</dt><dd className="num">{signed(p.gVert, 2)} g</dd></div>
          <div><dt>Heading</dt><dd className="num">{((p.yaw * DEG + 360) % 360).toFixed(0)}°</dd></div>
          <div><dt>Pitch</dt><dd className="num">{signed(p.pitch * DEG, 2)}°</dd></div>
          <div><dt>Roll</dt><dd className="num">{signed(p.roll * DEG, 2)}°</dd></div>
          {c && <>
            <div><dt>Ride height front</dt><dd className="num">{(c.frontAeroHeight * 1000).toFixed(1)} mm</dd></div>
            <div><dt>Ride height rear</dt><dd className="num">{(c.rearAeroHeight * 1000).toFixed(1)} mm</dd></div>
            <div><dt>Centre of gravity</dt><dd className="num">{(c.heightOfCog * 1000).toFixed(0)} mm</dd></div>
            <div><dt>Front wheel angle</dt><dd className="num">{signed(c.frontWheelsAngle * DEG, 1)}°</dd></div>
            <div><dt>Roll front / rear</dt><dd className="num">{signed(c.frontRollAngle * DEG, 2)}° / {signed(c.rearRollAngle * DEG, 2)}°</dd></div>
            <div><dt>Chassis pitch</dt><dd className="num">{signed(c.chassisPitch * DEG, 2)}°</dd></div>
            <div><dt>Yaw rate</dt><dd className="num">{signed(c.angularVelocity[1] * DEG, 1)}°/s</dd></div>
            <div><dt>Yaw acceleration</dt><dd className="num">{signed(c.angularAcceleration[1] * DEG, 0)}°/s²</dd></div>
            <div><dt>Sideways velocity</dt><dd className="num">{signed(c.localVelocity[0], 2)} m/s</dd></div>
            <div><dt>Vertical velocity</dt><dd className="num">{signed(c.localVelocity[1], 2)} m/s</dd></div>
          </>}
        </dl>
      </div>
      {c ? (
        <>
          <div className="data-wrap wheels-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="left"><button tabIndex={-1}>Per wheel</button></th>
                  {WHEEL_NAMES.map((w) => <th key={w}><button tabIndex={-1}>{w}</button></th>)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, unit, values, fmt]) => {
                  const v = values(c);
                  return (
                    <tr key={label}>
                      <th className="left" scope="row">{label}{unit && <span className="dim"> {unit}</span>}</th>
                      {WHEEL_ORDER.map((i) => <td key={i} className="num">{fmt(v[i] ?? 0).replace('-', '−')}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="section-note" style={{ marginTop: 10 }}>
            From the game’s extended motion packet. Suspension travel and velocity are in the game’s own units;
            angles arrive in radians and are shown in degrees.
          </p>
        </>
      ) : (
        <p className="section-note" style={{ marginTop: 12 }}>
          Per-wheel slip, loads and suspension appear once the game sends extended motion data (packet 13).
        </p>
      )}
    </section>
  );
}
