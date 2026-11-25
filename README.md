# Pit Wall — F1 25 · 2026 Season telemetry dashboard

A live pit-wall dashboard for **EA F1 25 with the 2026 Season Pack** ("F1 26"). It turns the
game's UDP telemetry into what a driver needs to get faster: where a lap loses time, how the
battery was deployed, and everything the car reports, including the new 2026 **active aero**
and **overtake mode**.

The UDP parser is written from scratch (`backend/src/PitWall.Telemetry`) for
`packetFormat 2026`; every packet layout is checked against the published byte sizes.

![Telemetry tab](docs/telemetry.png)

## What's in it

- **Live**: timing tower, track map with mini sectors and an energy map, lap trace against
  your best lap with a live delta, cockpit, energy and aero, tyres, damage and an event feed.
- **Telemetry**: your car only, every channel. Rolling traces of speed, pedals, steering,
  gear and RPM, battery, deploy/harvest flow by ERS mode, ICE and MGU-K power, G-forces, ride
  height and wheel slip. Also an energy breakdown with the per-lap harvest limit, a G-G
  diagram, per-wheel slip, loads and suspension, tyres and brakes, power-unit wear, race
  control and the car setup.
- **Lap analysis**: compare any of your laps with each other and with other drivers' fastest
  laps; it leads with the loss zones (where, how much, and why) and zooms every chart to them.
- A **simulator** that emits real 2026-format packets, so everything runs without the game,
  and **record / replay** of raw sessions.

| Live | Lap analysis |
|---|---|
| ![Live tab](docs/live.png) | ![Lap analysis tab](docs/laps.png) |

## Run it

Development runs the .NET server and the Vite dev server side by side:

```bash
cd backend/src/PitWall.Server
dotnet run --launch-profile sim    # simulated 22-car race, no game needed
dotnet run --launch-profile live   # live: listens for the game on UDP 20777

cd frontend
npm install
npm run dev                        # dashboard, proxies /ws to the server on :5080
```

Open <http://localhost:5173>. Point the dev server at another backend with
`PITWALL_API=http://host:port npm run dev`.

Production is the Docker image below: the server serves the built dashboard itself.

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
dotnet run -- --record session.f1rec   # save raw packets while driving
dotnet run -- --replay session.f1rec   # replay them later (loops)
dotnet run -- --udp-port 20778 --port 8080
```

## Layout

```
backend/src/PitWall.Telemetry   2026 packet layouts + little-endian codec
backend/src/PitWall.Core        folds packets into a Snapshot; lap archive, mini sectors
backend/src/PitWall.Simulator   synthetic race that emits real 2026 binary packets
backend/src/PitWall.Server      UDP / sim / replay → WebSocket (30 Hz), serves the dashboard
backend/tests                   packet sizes vs the spec, round-trips, lap tracking
frontend/                       React dashboard (Vite)
```

`dotnet test` (in `backend/`) checks every packet size against the spec and round-trips fields.
`npm run typecheck` (in `frontend/`) checks the dashboard.

## Known unknowns

- The 2026 format sends G-forces as int16. The scale factor isn't confirmed; it's
  `GForceScale` in `backend/src/PitWall.Telemetry/PacketFormat.cs` — adjust if the G readout looks off in-game.
- ERS percentage assumes a 4 MJ store (`ERS_MAX_J` in `frontend/src/api/types.ts`).

## License

[MIT](LICENSE)

## Disclaimer

An unofficial fan project. Not affiliated with, endorsed or sponsored by Electronic Arts,
Codemasters, Formula One or any team. F1 and related marks belong to their owners. Team names
and colours are used only to identify cars in the game's own telemetry.
