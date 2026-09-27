# Pit Wall — F1 25 · 2026 Season telemetry dashboard

A live pit-wall dashboard for **EA F1 25 with the 2026 Season Pack** ("F1 26"), styled
after the Oracle Red Bull sim-racing pit wall: timing tower, live track map, lap traces
against your best lap, tyres, damage, and the new 2026 **active aero** and **overtake mode**.

The UDP parser is written from scratch (`server/codec.ts` + `server/packets.ts`) for
`packetFormat 2026`; every packet layout is checked against the published byte sizes.

## Run it

```bash
npm install
npm run sim     # simulated 22-car race, no game needed
npm run dev     # live: listens for the game on UDP 20777
```

Open <http://localhost:5173>.

Production: `npm run build && npm start`.

### Docker

```bash
docker compose up -d                                          # live telemetry
docker compose run --rm --service-ports pitwall --sim         # simulator
docker compose run --rm --service-ports pitwall --record recordings/race.f1rec
```

The container runs on its own `pitwall` bridge network and publishes the dashboard on
`5173/tcp` and the telemetry port on `20777/udp`. Point the game at **your PC's LAN IP**
(not the container's IP). Change the host ports with `PITWALL_HTTP_PORT` / `PITWALL_UDP_PORT`,
e.g. `PITWALL_HTTP_PORT=8080 docker compose up -d`. Recordings land in `./recordings`.

### Game settings

In F1 25: **Settings → Telemetry Settings**

| Setting | Value |
|---|---|
| UDP Telemetry | On |
| UDP Format | **2026** (older saves default to 2025 — the dashboard warns you) |
| UDP IP Address | IP of the machine running this dashboard |
| UDP Port | 20777 |
| UDP Send Rate | 30 Hz or 60 Hz |
| Your Telemetry | Public (needed to see other cars' ERS/tyres online) |

If the game runs on another machine (PS5, Xbox, a Windows PC) open the port — on Fedora:

```bash
sudo firewall-cmd --add-port=20777/udp            # until reboot
sudo firewall-cmd --permanent --add-port=20777/udp # permanently
```

### Options

```bash
npm run dev -- --record session.f1rec   # save raw packets while driving
npm run dev -- --replay session.f1rec   # replay them later (loops)
npm run dev -- --udp-port 20778 --port 8080
```

## Layout

```
server/codec.ts     schema-driven little-endian binary reader/writer
server/packets.ts   2026 packet layouts (ids 0–16) + decodePacket()
server/state.ts     folds packets into one Snapshot
server/sim.ts       synthetic race that emits real 2026 binary packets
server/index.ts     UDP / sim / replay → WebSocket (30 Hz) + Vite
shared/             snapshot types, id lookups, lap-trace store
web/                React dashboard
```

`npm test` checks every packet size against the spec and round-trips fields.

## Known unknowns

- The 2026 format sends G-forces as int16. The scale factor isn't confirmed; it's
  `G_FORCE_SCALE` in `server/packets.ts` — adjust if the G readout looks off in-game.
- ERS percentage assumes a 4 MJ store (`ERS_MAX_J` in `shared/types.ts`).
