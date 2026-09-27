import { ERS_MAX_J, type PlayerDetail } from '../../shared/types.ts';
import { ERS_MODES, FUEL_MIX } from '../../shared/meta.ts';

const MJ = (j: number) => (j / 1e6).toFixed(2);

export function Energy({ p }: { p: PlayerDetail }) {
  const ers = Math.max(0, Math.min(100, (p.ersStoreJ / ERS_MAX_J) * 100));
  const straight = p.aeroMode === 1;
  const aeroState = straight ? 'on-yellow' : p.aeroAvailable ? 'ready' : '';
  const otState = p.overtakeActive ? 'on-red' : p.overtakeAvailable ? 'ready' : '';
  return (
    <section className="panel">
      <h2>Energy & Aero <span className="aside">{p.regs2026 ? '2026 rules' : 'Legacy car'}</span></h2>
      <div className="modes">
        <div className={`mode ${aeroState}`}>
          <div className="k">Active aero</div>
          <div className="v">{straight ? 'STRAIGHT' : 'CORNER'}</div>
          <div className="s num">
            {straight ? 'Low drag' : p.aeroActivationDistance > 0 ? `Zone in ${p.aeroActivationDistance} m` : p.aeroAvailable ? 'Available' : 'High downforce'}
          </div>
        </div>
        <div className={`mode ${otState}`}>
          <div className="k">Overtake mode</div>
          <div className="v">{p.overtakeActive ? 'ACTIVE' : p.overtakeAvailable ? 'ARMED' : 'OFF'}</div>
          <div className="s num">
            {p.overtakeActive ? 'Extra MGU-K deploy' : p.overtakeActivationDistance > 0 ? `In ${p.overtakeActivationDistance} m` : '—'}
          </div>
        </div>
      </div>
      <div className="battery">
        <div className="cell" role="meter" aria-valuenow={Math.round(ers)} aria-valuemin={0} aria-valuemax={100} aria-label="ERS store">
          <div style={{ width: `${ers}%` }} />
        </div>
        <span className="pct num">{ers.toFixed(0)}%</span>
      </div>
      <div className="grid3" style={{ marginBottom: 8 }}>
        <div className="kv"><div className="k">Deploy</div><div className="v">{ERS_MODES[p.ersDeployMode] ?? '—'}</div></div>
        <div className="kv"><div className="k">Used lap</div><div className="v num">{MJ(p.ersDeployedLapJ)}<small style={{ color: 'var(--muted)' }}> MJ</small></div></div>
        <div className="kv"><div className="k">Harvest lap</div><div className="v num">{MJ(p.ersHarvestedLapJ)}<small style={{ color: 'var(--muted)' }}> MJ</small></div></div>
      </div>
      <div className="grid3">
        <div className="kv"><div className="k">MGU-K</div><div className="v num">{Math.round(p.powerMgukW / 1000)}<small style={{ color: 'var(--muted)' }}> kW</small></div></div>
        <div className="kv"><div className="k">Fuel</div><div className="v num">{p.fuelKg.toFixed(1)}<small style={{ color: 'var(--muted)' }}> kg</small></div></div>
        <div className="kv">
          <div className="k">Fuel Δ laps</div>
          <div className="v num" style={{ color: p.fuelLaps < 0 ? 'var(--red-soft)' : undefined }}>{p.fuelLaps >= 0 ? '+' : ''}{p.fuelLaps.toFixed(2)}</div>
        </div>
        <div className="kv"><div className="k">Mix</div><div className="v">{FUEL_MIX[p.fuelMix] ?? '—'}</div></div>
        <div className="kv"><div className="k">Brake bias</div><div className="v num">{p.brakeBias}%</div></div>
        <div className="kv"><div className="k">Pit limiter</div><div className="v" style={{ color: p.pitLimiter ? 'var(--yellow)' : 'var(--dim)' }}>{p.pitLimiter ? 'ON' : 'OFF'}</div></div>
      </div>
    </section>
  );
}
