// Synthetic race that emits genuine packetFormat-2026 binary packets, so the
// whole pipeline (parser → state → dashboard) runs without the game.
import { encode } from './codec.ts';
import { Bodies, Header, PACKET_FORMAT, PacketId } from './packets.ts';

const TICK_HZ = 30;
const DT = 1 / TICK_HZ;
const TRACK_LENGTH = 5470;
const STEP = 5; // metres between track samples
const V_MAX = 93; // m/s (~335 km/h)
const A_LAT = 44; // m/s² cornering grip
const BRAKE = 40; // m/s²
const TOTAL_LAPS = 30;
const TRACK_ID = 42; // Madrid

const GRID: [string, number, number][] = [
  ['VERSTAPPEN', 478, 1], ['HADJAR', 478, 6], ['NORRIS', 484, 4], ['PIASTRI', 484, 81],
  ['LECLERC', 477, 16], ['HAMILTON', 477, 44], ['RUSSELL', 476, 63], ['ANTONELLI', 476, 12],
  ['ALONSO', 480, 14], ['STROLL', 480, 18], ['ALBON', 479, 23], ['SAINZ', 479, 55],
  ['GASLY', 481, 10], ['COLAPINTO', 481, 43], ['LAWSON', 482, 30], ['LINDBLAD', 482, 41],
  ['OCON', 483, 31], ['BEARMAN', 483, 87], ['HULKENBERG', 485, 27], ['BORTOLETO', 485, 5],
  ['PEREZ', 486, 11], ['BOTTAS', 486, 77],
];

interface Track {
  x: Float64Array; z: Float64Array; curv: Float64Array; v: Float64Array; n: number;
  aeroZones: { zoneStart: number; zoneEnd: number }[];
}

// Made-up circuit: a closed polygon whose corners are filleted with a radius
// that shrinks as the corner gets sharper (90° corner ~37 m, small kinks ~200 m).
const WAYPOINTS: [number, number][] = [
  [0, 0], [1100, 0], [1150, 280], [820, 320], [800, 520], [1350, 520], // T1–T5, hairpin at T6
  [1060, 640], [500, 720], [250, 930], [-350, 930], [-480, 760],
  [-380, 560], [-450, 470], [-360, 380], [-420, 140], // chicane, final corner
];

function buildTrack(): Track {
  const raw: [number, number][] = [];
  const W = WAYPOINTS.length;
  const fillets = WAYPOINTS.map((B, k) => {
    const A = WAYPOINTS[(k - 1 + W) % W], C = WAYPOINTS[(k + 1) % W];
    const l1 = Math.hypot(B[0] - A[0], B[1] - A[1]), l2 = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const u1 = [(B[0] - A[0]) / l1, (B[1] - A[1]) / l1], u2 = [(C[0] - B[0]) / l2, (C[1] - B[1]) / l2];
    const turn = Math.atan2(u1[0] * u2[1] - u1[1] * u2[0], u1[0] * u2[0] + u1[1] * u2[1]);
    const sharp = Math.abs(turn) / Math.PI; // 0 (straight) .. 1 (U-turn)
    let r = 18 + 300 * (1 - sharp) ** 4;
    const maxD = 0.45 * Math.min(l1, l2);
    r = Math.min(r, maxD / Math.tan(Math.abs(turn) / 2 || 1e-6));
    const d = r * Math.tan(Math.abs(turn) / 2);
    const t1: [number, number] = [B[0] - u1[0] * d, B[1] - u1[1] * d];
    const side = Math.sign(turn) || 1;
    const centre = [t1[0] - u1[1] * r * side, t1[1] + u1[0] * r * side];
    return { t1, turn, r, centre, start: Math.atan2(t1[1] - centre[1], t1[0] - centre[0]) };
  });
  for (let k = 0; k < W; k++) {
    const f = fillets[k];
    const steps = Math.max(2, Math.ceil((Math.abs(f.turn) * f.r) / 2));
    for (let j = 0; j < steps; j++) {
      const ang = f.start + f.turn * (j / steps);
      raw.push([f.centre[0] + Math.cos(ang) * f.r, f.centre[1] + Math.sin(ang) * f.r]);
    }
    // straight to the next fillet is implied by the arc-length resampling below
  }
  const M = raw.length;
  const cum = [0];
  for (let i = 1; i <= M; i++) {
    const [ax, az] = raw[i - 1], [bx, bz] = raw[i % M];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, bz - az));
  }
  const scale = TRACK_LENGTH / cum[M];
  const n = Math.round(TRACK_LENGTH / STEP);
  const x = new Float64Array(n), z = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * cum[M];
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / (cum[j + 1] - cum[j]);
    const [ax, az] = raw[j], [bx, bz] = raw[(j + 1) % M];
    x[i] = (ax + (bx - ax) * f) * scale;
    z[i] = (az + (bz - az) * f) * scale;
  }
  const curv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i - 3 + n) % n, q = (i + 3) % n;
    const h1 = Math.atan2(z[i] - z[p], x[i] - x[p]);
    const h2 = Math.atan2(z[q] - z[i], x[q] - x[i]);
    let d = h2 - h1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    curv[i] = d / (3 * STEP);
  }
  // Speed profile: grip limit, then braking (backward) and traction (forward) passes.
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(V_MAX, Math.sqrt(A_LAT / Math.max(Math.abs(curv[i]), 1e-6)));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = n - 1; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[(i + 1) % n] ** 2 + 2 * BRAKE * STEP));
    for (let i = 0; i < n; i++) {
      const prev = v[(i - 1 + n) % n];
      const acc = Math.max(2, 16 * (1 - prev / (V_MAX * 1.05)));
      v[i] = Math.min(v[i], Math.sqrt(prev ** 2 + 2 * acc * STEP));
    }
  }
  // Active aero "straight mode" zones: long full-speed stretches.
  const aeroZones: Track['aeroZones'] = [];
  let runStart = -1;
  for (let i = 0; i <= n; i++) {
    const fast = i < n && v[i] > V_MAX * 0.8 && Math.abs(curv[i]) < 0.004;
    if (fast && runStart < 0) runStart = i;
    if (!fast && runStart >= 0) {
      if ((i - runStart) * STEP > 350) aeroZones.push({ zoneStart: runStart / n, zoneEnd: (i - 1) / n });
      runStart = -1;
    }
  }
  return { x, z, curv, v, n, aeroZones: aeroZones.slice(0, 8) };
}

interface Car {
  name: string; teamId: number; number: number; pace: number;
  dist: number; // total distance, may start negative on the grid
  speed: number; accel: number;
  lapStartT: number; lapTimes: { t: number; s1: number; s2: number }[];
  s1: number; s2: number; bestMs: number;
  passTimes: number[]; // session time at each 10 m of total distance
  ers: number; ersDeployedLap: number; ersHarvestLap: number;
  fuel: number; wear: number[]; brakeTemp: number[];
  overtake: boolean; lastPos: number;
  throttle: number; brake: number;
}

export class RaceSim {
  private track = buildTrack();
  private t = 0;
  private frame = 0;
  private cars: Car[];
  private uid = BigInt.asUintN(64, BigInt(Date.now()) * 2654435761n).toString();
  private historyCursor = 0;
  private overallBest = Infinity;
  private lastPass = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private emit: (buf: Uint8Array) => void) {
    this.cars = GRID.map(([name, teamId, number], i) => ({
      name, teamId, number,
      pace: i === 0 ? 0.99 : 0.955 + Math.random() * 0.04,
      dist: -12 - i * 8, speed: 0, accel: 0,
      lapStartT: 0, lapTimes: [], s1: 0, s2: 0, bestMs: 0,
      passTimes: [],
      ers: 4_000_000, ersDeployedLap: 0, ersHarvestLap: 0,
      fuel: 100, wear: [0, 0, 0, 0], brakeTemp: [400, 400, 400, 400],
      overtake: false, lastPos: i + 1,
      throttle: 0, brake: 0,
    }));
  }

  start() {
    this.event('SSTA');
    this.event('LGOT');
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private idx(dist: number) {
    const { n } = this.track;
    return ((Math.floor(dist / STEP) % n) + n) % n;
  }

  private order() {
    return [...this.cars.keys()].sort((a, b) => this.cars[b].dist - this.cars[a].dist);
  }

  private gapMs(behind: Car, ahead: Car): number {
    const bin = Math.floor(behind.dist / 10);
    const t = ahead.passTimes[bin];
    return t === undefined ? 0 : Math.max(0, Math.round((this.t - t) * 1000));
  }

  private tick() {
    this.t += DT;
    this.frame++;
    const { v, curv, n } = this.track;
    const order = this.order();
    const posOf = new Map(order.map((ci, p) => [ci, p + 1]));

    for (const [p, ci] of order.entries()) {
      const car = this.cars[ci];
      const ahead = p > 0 ? this.cars[order[p - 1]] : null;
      const i = this.idx(car.dist);
      const inAero = this.inAeroZone(i / n);
      car.overtake = !!ahead && car.dist > TRACK_LENGTH && inAero && this.gapMs(car, ahead) < 1000 && car.ers > 500_000;
      const boost = car.overtake ? 1.025 : 1;
      const wobble = 1 + 0.0015 * Math.sin(this.t * 0.4 + ci);
      const factor = car.pace * boost * wobble * (1 - car.wear[0] / 1500);
      const target = v[i] * factor;
      const prev = car.speed;
      car.speed = prev < target ? Math.min(target, prev + 16 * DT) : Math.max(target, prev - BRAKE * 1.1 * DT);
      car.accel = (car.speed - prev) / DT;
      car.dist += car.speed * DT;
      const bin = Math.floor(car.dist / 10);
      for (let b = car.passTimes.length; b <= bin; b++) if (b >= 0) car.passTimes[b] = this.t;

      // Pedals from track position (not instantaneous acceleration, which steps
      // with the 5 m speed profile): brake where the profile drops ahead, part
      // throttle at grip-limited corners, flat out everywhere else. Smoothed like a foot.
      const targetAhead = v[(i + 3) % n] * factor;
      const braking = targetAhead < car.speed - 0.3;
      const grip = Math.sqrt(A_LAT / Math.max(Math.abs(curv[i]), 1e-6));
      const inCorner = grip < V_MAX && v[i] >= grip * 0.97;
      const throttleTarget = braking ? 0 : inCorner ? 0.4 + 0.5 * (grip / V_MAX) : 1;
      const brakeTarget = braking ? Math.min(1, 0.35 + (car.speed - targetAhead) / 8) : 0;
      car.throttle += (throttleTarget - car.throttle) * 0.35;
      car.brake += (brakeTarget - car.brake) * 0.5;

      // Energy: deploy on full throttle, harvest under braking.
      const flatOut = car.speed > V_MAX * car.pace * 0.97;
      const deploy = car.throttle > 0.95 && !flatOut ? (car.overtake ? 300_000 : 110_000) * DT : 0;
      const harvest = (car.brake > 0.1 ? 350_000 : flatOut ? 90_000 : 0) * DT;
      car.ers = Math.max(0, Math.min(4_000_000, car.ers - deploy + harvest));
      car.ersDeployedLap += deploy;
      car.ersHarvestLap += harvest;
      car.brakeTemp = car.brakeTemp.map((bt, w) => bt + (car.brake * (w >= 2 ? 1400 : 1100) - (bt - 350) * 0.6) * DT);

      // Lap & sector bookkeeping.
      const lapLen = TRACK_LENGTH;
      const lapDist = car.dist - Math.floor(car.dist / lapLen) * lapLen;
      const lapNum = Math.floor(car.dist / lapLen) + 1;
      const currentMs = (this.t - car.lapStartT) * 1000;
      if (car.dist > 0 && lapNum > car.lapTimes.length + 1) {
        const ms = Math.round(currentMs);
        car.lapTimes.push({ t: ms, s1: car.s1, s2: car.s2 });
        car.lapStartT = this.t;
        car.s1 = car.s2 = 0;
        car.ersDeployedLap = car.ersHarvestLap = 0;
        car.fuel = Math.max(0, car.fuel - 1.65);
        car.wear = car.wear.map((w, k) => w + (k < 2 ? 1.9 : 1.5) * (0.9 + Math.random() * 0.2));
        if (car.lapTimes.length > 1 && (!car.bestMs || ms < car.bestMs)) car.bestMs = ms;
        if (car.lapTimes.length > 1 && ms < this.overallBest) {
          this.overallBest = ms;
          this.event('FTLP', [['vehicleIdx', 'u8', ci], ['lapTime', 'f32', ms / 1000]]);
        }
      }
      if (car.dist > 0 && !car.s1 && lapDist > lapLen / 3) car.s1 = Math.round(currentMs);
      if (car.dist > 0 && !car.s2 && lapDist > (2 * lapLen) / 3) car.s2 = Math.round(currentMs - car.s1);

      const pos = posOf.get(ci)!;
      const passed = order[p + 1];
      const key = `${ci}:${passed}`;
      if (pos < car.lastPos && passed !== undefined && car.dist > 300 && this.t - (this.lastPass.get(key) ?? -99) > 15) {
        this.lastPass.set(key, this.t);
        this.event('OVTK', [['overtakingVehicleIdx', 'u8', ci], ['beingOvertakenVehicleIdx', 'u8', passed]]);
      }
      car.lastPos = pos;
    }

    this.send(PacketId.Motion, { carMotionData: this.cars.map((c, ci) => this.motion(c, ci)) });
    this.send(PacketId.LapData, { lapData: this.cars.map((c, ci) => this.lapData(c, ci, order, posOf.get(ci)!)), timeTrialPBCarIdx: 255, timeTrialRivalCarIdx: 255 });
    this.send(PacketId.CarTelemetry, { carTelemetryData: this.cars.map((c) => this.telemetry(c)), mfdPanelIndex: 255, mfdPanelIndexSecondaryPlayer: 255, suggestedGear: 0 });
    this.send(PacketId.CarStatus, { carStatusData: this.cars.map((c) => this.status(c)) });
    this.send(PacketId.CarTelemetry2, { carTelemetry2Data: this.cars.map((c) => this.tel2(c)) });
    if (this.frame % 3 === 0) this.send(PacketId.CarDamage, { carDamageData: this.cars.map((c) => ({ tyresWear: c.wear, engineICEWear: 8, engineMGUKWear: 11, engineESWear: 9, gearBoxDamage: 4 })) });
    if (this.frame % 15 === 0) this.send(PacketId.Session, this.session());
    if (this.frame % 30 === 0) this.send(PacketId.Participants, this.participants());
    this.sendHistory();
  }

  private inAeroZone(frac: number) {
    return this.track.aeroZones.some((z) => frac >= z.zoneStart && frac <= z.zoneEnd);
  }

  private motion(c: Car, ci: number) {
    const { x, z, curv, n } = this.track;
    const i = this.idx(c.dist), q = (i + 1) % n;
    const lane = ((ci % 3) - 1) * 2; // spread cars across the track width
    const dx = x[q] - x[i], dz = z[q] - z[i];
    const len = Math.hypot(dx, dz) || 1;
    const fx = dx / len, fz = dz / len;
    const g = 9.81;
    return {
      worldPositionX: x[i] - fz * lane, worldPositionY: 0, worldPositionZ: z[i] + fx * lane,
      worldVelocityX: fx * c.speed, worldVelocityZ: fz * c.speed,
      worldForwardDirX: Math.round(fx * 32767), worldForwardDirZ: Math.round(fz * 32767),
      worldRightDirX: Math.round(-fz * 32767), worldRightDirZ: Math.round(fx * 32767),
      gForceLateral: Math.round(((c.speed ** 2 * curv[i]) / g) * 1000),
      gForceLongitudinal: Math.round((c.accel / g) * 1000),
      gForceVertical: 1000,
      yaw: Math.atan2(fx, fz),
    };
  }

  private lapData(c: Car, ci: number, order: number[], pos: number) {
    const leader = this.cars[order[0]];
    const ahead = pos > 1 ? this.cars[order[pos - 2]] : null;
    const lapDist = c.dist - Math.floor(c.dist / TRACK_LENGTH) * TRACK_LENGTH;
    const split = (ms: number) => ({ min: Math.floor(ms / 60000), ms: ms % 60000 });
    const gl = split(ahead ? this.gapMs(c, leader) : 0);
    const ga = split(ahead ? this.gapMs(c, ahead) : 0);
    const last = c.lapTimes.at(-1);
    return {
      lastLapTimeInMS: last?.t ?? 0,
      currentLapTimeInMS: Math.max(0, Math.round((this.t - c.lapStartT) * 1000)),
      sector1TimeMSPart: c.s1 % 60000, sector1TimeMinutesPart: Math.floor(c.s1 / 60000),
      sector2TimeMSPart: c.s2 % 60000, sector2TimeMinutesPart: Math.floor(c.s2 / 60000),
      deltaToCarInFrontMSPart: ga.ms, deltaToCarInFrontMinutesPart: ga.min,
      deltaToRaceLeaderMSPart: gl.ms, deltaToRaceLeaderMinutesPart: gl.min,
      lapDistance: c.dist < 0 ? c.dist : lapDist,
      totalDistance: c.dist,
      carPosition: pos,
      currentLapNum: Math.max(1, Math.floor(c.dist / TRACK_LENGTH) + 1),
      sector: lapDist < TRACK_LENGTH / 3 ? 0 : lapDist < (2 * TRACK_LENGTH) / 3 ? 1 : 2,
      gridPosition: ci + 1,
      driverStatus: 4,
      resultStatus: 2,
      speedTrapFastestLap: 255,
    };
  }

  private telemetry(c: Car) {
    const { curv } = this.track;
    const i = this.idx(c.dist);
    const kmh = c.speed * 3.6;
    const gear = Math.max(1, Math.min(8, Math.ceil(kmh / 42)));
    const gearLow = (gear - 1) * 42;
    const rpm = Math.round(Math.min(12_500, 7_000 + ((kmh - gearLow) / 42) * 5_200));
    const lat = Math.abs(c.speed ** 2 * curv[i]) / 9.81;
    const surf = c.wear.map((w, k) => Math.round(88 + lat * 3 + (k >= 2 ? 4 : 0) + w * 0.2 + Math.sin(this.t + k) * 2));
    return {
      speed: Math.round(kmh), throttle: c.throttle, brake: c.brake,
      steer: Math.max(-1, Math.min(1, curv[i] * 60)),
      gear, engineRPM: rpm,
      revLightsPercent: Math.round(Math.max(0, (rpm - 10_500) / 2_000) * 100),
      brakesTemperature: c.brakeTemp.map(Math.round),
      tyresSurfaceTemperature: surf,
      tyresInnerTemperature: surf.map((s) => s + 6),
      engineTemperature: 108,
      tyresPressure: [21.2, 21.2, 23.1, 23.1].map((p) => p + lat * 0.05),
    };
  }

  private status(c: Car) {
    return {
      tractionControl: 0, antiLockBrakes: 0, fuelMix: 1, frontBrakeBias: 55,
      fuelInTank: c.fuel, fuelCapacity: 110, fuelRemainingLaps: c.fuel / 1.65 - (TOTAL_LAPS - c.lapTimes.length),
      maxRPM: 12_500, idleRPM: 4_000, maxGears: 8,
      actualTyreCompound: 17, visualTyreCompound: 17,
      tyresAgeLaps: c.lapTimes.length,
      vehicleFiaFlags: 1,
      enginePowerICE: c.throttle > 0.95 ? 400_000 : 90_000,
      enginePowerMGUK: c.throttle > 0.95 ? (c.overtake ? 350_000 : 150_000) : 0,
      ersStoreEnergy: c.ers,
      ersDeployMode: c.overtake ? 3 : 1,
      ersHarvestedThisLapMGUK: c.ersHarvestLap,
      ersHarvestLimitPerLap: 8_500_000,
      ersDeployedThisLap: c.ersDeployedLap,
    };
  }

  private tel2(c: Car) {
    const { n } = this.track;
    const frac = this.idx(c.dist) / n;
    const next = this.track.aeroZones.map((z) => ((z.zoneStart - frac + 1) % 1) * TRACK_LENGTH);
    const inZone = this.inAeroZone(frac);
    return {
      activeAeroMode: inZone ? 1 : 0,
      activeAeroAvailable: inZone,
      activeAeroActivationDistance: inZone ? 0 : Math.round(Math.min(...next)),
      overtakeAvailable: c.overtake || (c.dist > TRACK_LENGTH && c.ers > 1_000_000),
      overtakeActive: c.overtake,
      overtakeActivationDistance: inZone ? 0 : Math.round(Math.min(...next)),
      regulations2026Applicable: true,
    };
  }

  private session() {
    const zones = (list: { zoneStart: number; zoneEnd: number }[], count: number) => list.slice(0, count);
    return {
      weather: 1, trackTemperature: 41, airTemperature: 28,
      totalLaps: TOTAL_LAPS, trackLength: TRACK_LENGTH,
      sessionType: 15, trackId: TRACK_ID, formula: 0,
      sessionTimeLeft: 7200 - Math.floor(this.t), sessionDuration: 7200,
      pitSpeedLimit: 80,
      numMarshalZones: 3,
      marshalZones: [{ zoneStart: 0.1, zoneFlag: 0 }, { zoneStart: 0.45, zoneFlag: Math.floor(this.t / 20) % 5 === 4 ? 3 : 0 }, { zoneStart: 0.8, zoneFlag: 0 }],
      numWeatherForecastSamples: 5,
      weatherForecastSamples: [0, 5, 10, 15, 30].map((offset, k) => ({ sessionType: 15, timeOffset: offset, weather: k < 3 ? 1 : 2, trackTemperature: 41 - k, airTemperature: 28, rainPercentage: k * 6 })),
      pitStopWindowIdealLap: 14, pitStopWindowLatestLap: 18, pitStopRejoinPosition: 6,
      sector2LapDistanceStart: TRACK_LENGTH / 3, sector3LapDistanceStart: (2 * TRACK_LENGTH) / 3,
      activeAeroTrackStatus: 0,
      numActiveAeroZonesFull: this.track.aeroZones.length,
      activeAeroZonesFull: zones(this.track.aeroZones, 8),
      numActiveAeroZonesPartial: 0,
      numDrsZones: 0,
      timeOfDay: 14 * 60 + Math.floor(this.t / 60),
      numSessionsInWeekend: 1, weekendStructure: [15],
    };
  }

  private participants() {
    return {
      numActiveCars: this.cars.length,
      participants: this.cars.map((c, i) => ({
        aiControlled: i !== 0, driverId: 255, networkId: 255, teamId: c.teamId, raceNumber: c.number,
        nationality: 0, name: c.name, yourTelemetry: true, showOnlineNames: true, platform: 255,
      })),
    };
  }

  private sendHistory() {
    const ci = this.historyCursor++ % this.cars.length;
    const c = this.cars[ci];
    const laps = c.lapTimes.slice(-100);
    let best = 0;
    laps.forEach((l, k) => { if (k > 0 && (!best || l.t < laps[best - 1].t)) best = k + 1; });
    this.send(PacketId.SessionHistory, {
      carIdx: ci, numLaps: laps.length + 1, numTyreStints: 1, bestLapTimeLapNum: best,
      lapHistoryData: laps.map((l) => ({
        lapTimeInMS: l.t, sector1TimeMSPart: l.s1 % 60000, sector2TimeMSPart: l.s2 % 60000,
        sector3TimeMSPart: (l.t - l.s1 - l.s2) % 60000, lapValidBitFlags: 0x0f,
      })),
      tyreStintsHistoryData: [{ endLap: 255, tyreActualCompound: 17, tyreVisualCompound: 17 }],
    });
  }

  private event(code: string, fields: [string, 'u8' | 'f32', number][] = []) {
    this.send(PacketId.Event, { eventCode: code }, (bytes, off) => {
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      let o = off + 4;
      for (const [, type, value] of fields) {
        if (type === 'u8') view.setUint8(o++, value);
        else { view.setFloat32(o, value, true); o += 4; }
      }
    });
  }

  private send(packetId: number, body: unknown, patch?: (bytes: Uint8Array, bodyOffset: number) => void) {
    const h = encode({ struct: Header }, {
      packetFormat: PACKET_FORMAT, gameYear: 25, gameMajorVersion: 1, gameMinorVersion: 25,
      packetVersion: 1, packetId, sessionUID: this.uid, sessionTime: this.t,
      frameIdentifier: this.frame, overallFrameIdentifier: this.frame,
      playerCarIndex: 0, secondaryPlayerCarIndex: 255,
    });
    const b = encode({ struct: Bodies[packetId]! }, body);
    const out = new Uint8Array(h.length + b.length);
    out.set(h);
    out.set(b, h.length);
    patch?.(out, h.length);
    this.emit(out);
  }
}
