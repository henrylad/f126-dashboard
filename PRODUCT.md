# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
One person: the developer, who is also the driver. They play EA F1 25 with the 2026 Season Pack ("F1 26") and run the dashboard on a second screen. They glance at it while driving and study it between sessions. It is a personal tool. Onboarding for strangers, multi-user roles and public distribution are out of scope unless that changes.

## Product Purpose
Pit Wall turns the game's UDP telemetry into the information a driver needs to get faster. The main job is **analysis**: compare every lap of the session (sectors, speed/throttle/brake traces, energy use) with your own best lap and with other drivers' fastest laps, and see where time is lost. Live race awareness (gaps, tyres, ERS, damage) is a secondary job.

Success means that after a session the driver can say where they lose time and why: a specific corner, a braking point, how energy was deployed.

## Positioning
The decoder is a from-scratch implementation of `packetFormat 2026`, so it reads the 2026 regulations' data that generic F1 telemetry tools don't: **active aero**, **overtake mode** and the new energy/ERS model. Laps are recorded for every car on track, not only the player's, so your laps can be compared with rivals' fastest laps.

## Operating Context
- The game runs on a PC or console and sends UDP to port 20777 at 30 or 60 Hz. The dashboard is a browser tab on another screen, often on another machine on the LAN.
- The driver runs it with Docker Desktop on Windows (cmd) and develops on Fedora.
- Glances during a session are short and peripheral: the driver's eyes are on the road. Analysis between sessions is seated, focused and unhurried.
- Modes: live UDP, the built-in simulator (a synthetic 22-car race that emits real 2026 packets), and record/replay of `.f1rec` files.
- Failure states that happen in practice: the game isn't sending yet, the game is set to the wrong UDP format (2025 instead of 2026), the data has gone stale, and other cars' data is missing when their telemetry is private.

## Capabilities and Constraints
- Backend: .NET (`backend/`, projects PitWall.Core, PitWall.Server, PitWall.Simulator, PitWall.Telemetry) handles UDP ingest, the packet codec, session state, lap recording and recordings, and streams snapshots to the browser in real time.
- Frontend: React + Vite + TypeScript (`frontend/`). There are three tabs. **Live** has the timing tower, track map, live traces against your best lap, cockpit, energy, tyres, damage and an event feed. **Telemetry** is the player's car only: rolling time traces of every channel (pedals, steering, RPM, battery, deploy/harvest flow, ICE and MGU-K power, G-forces, ride height, wheel slip), the energy breakdown, a G-G diagram, per-wheel dynamics from extended motion, tyres and brakes, power-unit wear, race control and the car setup. **Lap analysis** has the lap table, compare chart, energy compare and mini compare.
- The repository is mid-migration from a Node server to the .NET backend. `frontend/package.json` scripts and the README still point to the old `server/` paths.
- Open question: the scale factor for G-force (sent as int16) is unconfirmed.
- Terminology follows the 2026 F1 regulations and the game's terms: overtake mode, active aero, ERS, sectors, compounds.

## Brand Commitments
None binding. The current look (described in the README as styled after a team's sim-racing pit wall) is evidence and inspiration only, and a redesign is on the table. Team names, liveries and logos are not to be used.

## Evidence on Hand
- `screenshot.png`: the current dashboard.
- `recordings/` is empty. No real session captures are committed yet, so the simulator is the reproducible data source.
- There are no users, testimonials or benchmarks, and none should be invented.

## Product Principles
1. **Analysis first.** The comparison of laps is the product. Live widgets earn their space by feeding it or by being glanceable.
2. **Readable at a glance, deep on demand.** The live view can be taken in within a second from the cockpit. The analysis view rewards close reading.
3. **The data is the truth.** Show values decoded from the 2026 format faithfully. Flag unknowns (unconfirmed scales, missing private telemetry) rather than guessing silently.
4. **2026 rules are first-class.** Active aero, overtake mode and the energy model are primary data, not afterthoughts.
5. **Honest connection state.** Always make it clear whether data is live, stale, simulated, replayed or in the wrong format.
