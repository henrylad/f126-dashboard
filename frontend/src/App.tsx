import { useState } from 'react';
import { useTelemetry } from './api/useTelemetry.ts';
import { Header } from './components/Header.tsx';
import { TimingTower } from './components/TimingTower.tsx';
import { TrackMap } from './components/TrackMap.tsx';
import { Traces } from './components/Traces.tsx';
import { Cockpit } from './components/Cockpit.tsx';
import { Energy } from './components/Energy.tsx';
import { Tyres } from './components/Tyres.tsx';
import { Damage } from './components/Damage.tsx';
import { Feed } from './components/Feed.tsx';
import { LapAnalysis } from './components/analysis/LapAnalysis.tsx';
import { Telemetry } from './components/telemetry/Telemetry.tsx';

const STALE_MS = 3000;

type Tab = 'live' | 'telemetry' | 'laps';
const TABS: Tab[] = ['live', 'telemetry', 'laps'];
const TAB_KEY = 'pitwall.tab';

function savedTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY) as Tab | null;
    return t && TABS.includes(t) ? t : 'live';
  } catch {
    return 'live';
  }
}

export function App() {
  const { snap, store, connected } = useTelemetry();
  const waiting = !snap || snap.lastPacketAgoMs === null || snap.lastPacketAgoMs > STALE_MS;
  const [tab, setTab] = useState<Tab>(savedTab);
  const pick = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* per-browser convenience only */ }
  };

  return (
    <div className="app">
      <Header snap={snap} connected={connected} stale={waiting} />
      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'live'} className={tab === 'live' ? 'on' : ''} onClick={() => pick('live')}>Live</button>
        <button role="tab" aria-selected={tab === 'telemetry'} className={tab === 'telemetry' ? 'on' : ''} onClick={() => pick('telemetry')}>Telemetry</button>
        <button role="tab" aria-selected={tab === 'laps'} className={tab === 'laps' ? 'on' : ''} onClick={() => pick('laps')}>
          Lap analysis{store.laps.length ? <span className="count num">{store.laps.length}</span> : null}
        </button>
      </nav>
      {snap?.wrongFormat && (
        <div className="banner">
          The game is sending <b>packet format {snap.wrongFormat}</b>. In F1 25 go to
          <b> Settings → Telemetry Settings → UDP Format</b> and choose <b>2026</b>.
        </div>
      )}
      {!snap?.session || !snap.player ? (
        <Setup connected={connected} />
      ) : (
        <>
        {/* Every tab stays mounted so selections, scroll and the telemetry buffer survive switching. */}
        <div className="tab-body" hidden={tab !== 'laps'}><LapAnalysis snap={snap} store={store} /></div>
        <div className="tab-body" hidden={tab !== 'telemetry'}><Telemetry snap={snap} store={store} /></div>
        <main className="main" hidden={tab !== 'live'}>
          <div className="col">
            <TimingTower cars={snap.cars} sessionType={snap.session.sessionType} />
          </div>
          <div className="center">
            <TrackMap snap={snap} store={store} />
            <Traces snap={snap} store={store} />
          </div>
          <div className="col scroll right">
            <Cockpit p={snap.player} />
            <Energy p={snap.player} />
            <Tyres p={snap.player} />
            <Damage p={snap.player} />
            <Feed snap={snap} />
          </div>
        </main>
        </>
      )}
    </div>
  );
}

function Setup({ connected }: { connected: boolean }) {
  return (
    <div className="empty">
      <h1>Waiting for telemetry</h1>
      <p>
        {connected
          ? 'The dashboard server is running but no 2026-format packets have arrived yet.'
          : 'Connecting to the dashboard server…'}
      </p>
      <ol>
        <li>In F1 25 open <b>Settings → Telemetry Settings</b>.</li>
        <li>Set <b>UDP Telemetry</b> to <code>On</code> and <b>UDP Format</b> to <code>2026</code>.</li>
        <li>Set <b>UDP IP Address</b> to this computer’s IP and port to <code>20777</code>.</li>
        <li>Set <b>UDP Send Rate</b> to <code>30Hz</code> or <code>60Hz</code>, then get on track.</li>
      </ol>
      <p>No game handy? Start the server with <code>--sim</code> for a simulated race.</p>
    </div>
  );
}
