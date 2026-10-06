import type { PlayerDetail } from '../api/types.ts';

// Status colours only — each value also shows its number, so colour is never the only cue.
const level = (v: number) => (v >= 50 ? 'var(--red-soft)' : v >= 20 ? 'var(--yellow)' : 'var(--green)');

export function Damage({ p }: { p: PlayerDetail }) {
  const d = p.damage;
  const rows: [string, number][] = [
    ['Front wing L', d.frontLeftWing], ['Front wing R', d.frontRightWing],
    ['Rear wing', d.rearWing], ['Floor', d.floor],
    ['Diffuser', d.diffuser], ['Sidepods', d.sidepod],
    ['Gearbox', d.gearbox], ['Engine', d.engine],
  ];
  const pu: [string, number][] = [
    ['ICE', d.ice], ['MGU-K', d.mguk], ['ES', d.es], ['CE', d.ce], ['TC', d.tc], ['MGU-H', d.mguh],
  ];
  return (
    <section className="panel">
      <h2>Car condition</h2>
      <div className="dmg">{rows.map(([k, v]) => <Row key={k} label={k} value={v} />)}</div>
      <h2 style={{ marginTop: 14 }}>Power unit wear</h2>
      <div className="dmg">{pu.map(([k, v]) => <Row key={k} label={k} value={v} />)}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="row">
      <div className="lbl">
        {label}
        <div className="bar"><div style={{ width: `${Math.min(100, value)}%`, background: level(value) }} /></div>
      </div>
      <span className="v num">{value}%</span>
    </div>
  );
}
