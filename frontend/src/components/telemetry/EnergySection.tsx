import { ERS_MAX_J, type PlayerDetail } from '../../api/types.ts';
import type { Lap } from '../../laps/lapMath.ts';
import { lapTime } from '../../lib/format.ts';
import { ENERGY, ERS_MODES, FUEL_MIX } from '../../lib/meta.ts';

const MJ = (j: number) => (j / 1e6).toFixed(2);
/** Colour of each deploy mode's cell: None has no flow, then the warm ramp. */
const MODE_COLOUR = [null, ENERGY[1].colour, ENERGY[2].colour, ENERGY[3].colour];

export function EnergySection({ p, flowKw }: { p: PlayerDetail; flowKw: number }) {
  const ers = Math.max(0, Math.min(1, p.ersStoreJ / ERS_MAX_J));
  const limit = p.ersHarvestLimitLapJ;
  const harvestShare = limit > 0 ? Math.min(1, p.ersHarvestedLapJ / limit) : null;
  const net = p.ersHarvestedLapJ - p.ersDeployedLapJ;
  return (
    <section className="a-section" aria-labelledby="tele-energy">
      <div className="section-head">
        <h2 id="tele-energy">Energy</h2>
        <span className="aside">{p.regs2026 ? '2026 power unit' : 'Legacy power unit'}</span>
      </div>

      <div className="energy-grid">
        <div className="eg-block">
          <div className="eg-label">Battery (ERS store)</div>
          <div className="eg-figure"><span className="num">{(ers * 100).toFixed(1)}%</span> <small className="num">{MJ(p.ersStoreJ)} / {MJ(ERS_MAX_J)} MJ</small></div>
          <div className="gauge" role="meter" aria-label="Battery" aria-valuenow={Math.round(ers * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${ers * 100}%`, background: 'var(--blue)' }} />
          </div>
        </div>

        <div className="eg-block">
          <div className="eg-label">Deploy mode</div>
          <div className="modes4" role="list">
            {ERS_MODES.map((m, i) => (
              <div key={m} role="listitem" className={`m4 ${p.ersDeployMode === i ? 'on' : ''}`} aria-current={p.ersDeployMode === i ? 'true' : undefined}>
                <i className={`sw ${MODE_COLOUR[i] ? '' : 'none'}`} style={MODE_COLOUR[i] ? { background: MODE_COLOUR[i]! } : undefined} />{m}
              </div>
            ))}
          </div>
          <div className="eg-sub">
            {flowKw < -2 ? <>Harvesting <span className="num">{Math.round(-flowKw)} kW</span></>
              : flowKw > 2 ? <>Deploying <span className="num">{Math.round(flowKw)} kW</span></>
              : 'No battery flow right now'}
          </div>
        </div>

        <div className="eg-block">
          <div className="eg-label">Harvested this lap{limit > 0 && ' · of the lap limit'}</div>
          <div className="eg-figure"><span className="num">{MJ(p.ersHarvestedLapJ)} MJ</span>{limit > 0 && <small className="num"> / {MJ(limit)} MJ</small>}</div>
          {harvestShare !== null && (
            <div className="gauge" role="meter" aria-label="Harvest limit used" aria-valuenow={Math.round(harvestShare * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${harvestShare * 100}%`, background: ENERGY[0].colour }} />
            </div>
          )}
          <div className="eg-sub">MGU-K <span className="num">{MJ(p.ersHarvestedMgukLapJ)}</span> · MGU-H <span className="num">{MJ(p.ersHarvestedMguhLapJ)}</span> MJ</div>
        </div>
      </div>

      <dl className="facts">
        <div><dt>Deployed this lap</dt><dd className="num">{MJ(p.ersDeployedLapJ)} MJ</dd></div>
        <div><dt>Net this lap</dt><dd className={`num ${net >= 0 ? 'gained' : 'lost'}`}>{net >= 0 ? '+' : '−'}{MJ(Math.abs(net))} MJ</dd></div>
        <div><dt>ICE power</dt><dd className="num">{Math.round(p.powerIceW / 1000)} kW</dd></div>
        <div><dt>MGU-K power</dt><dd className="num">{Math.round(p.powerMgukW / 1000)} kW</dd></div>
        <div><dt>Battery flow</dt><dd className="num">{flowKw >= 0 ? '' : '−'}{Math.abs(Math.round(flowKw))} kW</dd></div>
        <div><dt>Overtake mode</dt><dd>{p.overtakeActive ? 'Active' : p.overtakeAvailable ? 'Armed' : 'Off'}{p.overtakeActivationDistance > 0 && !p.overtakeActive && <span className="dim"> · in <span className="num">{p.overtakeActivationDistance} m</span></span>}</dd></div>
        <div><dt>Active aero</dt><dd>{p.aeroMode === 1 ? 'Straight' : 'Corner'}<span className="dim"> · {p.aeroAvailable ? 'available' : 'not available'}</span></dd></div>
        <div><dt>Fuel mix</dt><dd>{FUEL_MIX[p.fuelMix] ?? '—'}</dd></div>
      </dl>
    </section>
  );
}

const KIND: Record<Lap['kind'], string> = { timed: '', invalid: 'Invalid', out: 'Out-lap', in: 'In-lap', pit: 'Pit', partial: 'Partial' };

export function EnergyPerLap({ laps }: { laps: Lap[] }) {
  const rows = [...laps].reverse();
  return (
    <section className="a-section" aria-labelledby="tele-per-lap">
      <div className="section-head">
        <h2 id="tele-per-lap">Energy per lap</h2>
        <span className="aside">Your laps, newest first</span>
      </div>
      {rows.length === 0 ? (
        <p className="section-note">Appears once you complete a lap.</p>
      ) : (
        <div className="data-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="left"><button tabIndex={-1}>Lap</button></th>
                <th><button tabIndex={-1}>Time</button></th>
                <th><button tabIndex={-1} title="ERS energy deployed, MJ">Deploy MJ</button></th>
                <th><button tabIndex={-1} title="ERS energy harvested, MJ">Harvest MJ</button></th>
                <th><button tabIndex={-1} title="Harvested minus deployed, MJ">Net MJ</button></th>
                <th><button tabIndex={-1} title="Share of the lap in Boost">Boost</button></th>
                <th><button tabIndex={-1} title="Battery at the start and end of the lap">Battery</button></th>
                <th><button tabIndex={-1} title="Fuel used, kg">Fuel kg</button></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const s = l.stats;
                const net = s.harvestedJ - s.deployedJ;
                return (
                  <tr key={l.id} className={l.kind === 'timed' ? '' : 'untimed'}>
                    <th className="left" scope="row">Lap <span className="num">{l.lap}</span>{KIND[l.kind] && <span className="kind" style={{ marginLeft: 8 }}>{KIND[l.kind]}</span>}</th>
                    <td className="num">{lapTime(l.timeMs)}</td>
                    <td className="num">{MJ(s.deployedJ)}</td>
                    <td className="num">{MJ(s.harvestedJ)}</td>
                    <td className={`num ${net >= 0 ? 'gained' : 'lost'}`}>{net >= 0 ? '+' : '−'}{MJ(Math.abs(net))}</td>
                    <td className="num">{Math.round(s.boostPct)}%</td>
                    <td className="num">{Math.round((s.ersStartJ / ERS_MAX_J) * 100)}% → {Math.round((s.ersEndJ / ERS_MAX_J) * 100)}%</td>
                    <td className="num">{s.fuelUsedKg === null ? '—' : s.fuelUsedKg.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
