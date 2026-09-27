// Snapshot the server broadcasts to the dashboard over WebSocket.

export type Wheels<T> = [T, T, T, T]; // [RL, RR, FL, FR]

export interface Zone { start: number; end: number } // lap fractions 0..1

export interface SessionInfo {
  uid: string;
  trackId: number;
  trackLength: number;
  totalLaps: number;
  sessionType: number;
  timeLeft: number;
  weather: number;
  trackTemp: number;
  airTemp: number;
  safetyCar: number;
  pitSpeedLimit: number;
  marshalZones: { start: number; flag: number }[];
  aeroZonesFull: Zone[];
  aeroZonesPartial: Zone[];
  drsZones: Zone[];
  sector2Start: number;
  sector3Start: number;
  pitWindowIdeal: number;
  pitWindowLatest: number;
  rejoinPosition: number;
  forecast: { offset: number; weather: number; rain: number; trackTemp: number }[];
}

export interface CarRow {
  idx: number;
  position: number;
  name: string;
  raceNumber: number;
  teamId: number;
  colour: string;
  isPlayer: boolean;
  lap: number;
  lapDistance: number;
  sector: number;
  lastLapMs: number;
  bestLapMs: number;
  currentLapMs: number;
  currentLapInvalid: boolean;
  gapToLeaderMs: number;
  intervalMs: number;
  pitStatus: number;
  numPitStops: number;
  penaltiesSec: number;
  driverStatus: number;
  resultStatus: number;
  compound: number;
  tyreAge: number;
  x: number;
  z: number;
  aeroMode: number;
  overtakeActive: boolean;
  ersPct: number;
  // Per-car telemetry, used to record every driver's laps. Zero for online
  // players whose telemetry is restricted.
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  ersStoreJ: number;
  ersDeployMode: number;
  fuelKg: number;
  tyreWearAvg: number;
}

export interface PlayerDetail {
  idx: number;
  speed: number;
  throttle: number;
  brake: number;
  steer: number;
  clutch: number;
  gear: number;
  suggestedGear: number;
  rpm: number;
  maxRpm: number;
  revLightsPct: number;
  engineTemp: number;
  brakesTemp: Wheels<number>;
  tyresSurface: Wheels<number>;
  tyresInner: Wheels<number>;
  tyresPressure: Wheels<number>;
  tyresWear: Wheels<number>;
  tyresDamage: Wheels<number>;
  tyreBlisters: Wheels<number>;
  brakesDamage: Wheels<number>;
  damage: {
    frontLeftWing: number; frontRightWing: number; rearWing: number; floor: number;
    diffuser: number; sidepod: number; gearbox: number; engine: number;
    ice: number; mguk: number; mguh: number; es: number; ce: number; tc: number;
  };
  fuelKg: number;
  fuelLaps: number;
  fuelMix: number;
  brakeBias: number;
  ersStoreJ: number;
  ersDeployMode: number;
  ersDeployedLapJ: number;
  ersHarvestedLapJ: number;
  powerIceW: number;
  powerMgukW: number;
  pitLimiter: boolean;
  compound: number;
  visualCompound: number;
  tyreAge: number;
  aeroMode: number;
  aeroAvailable: boolean;
  aeroActivationDistance: number;
  overtakeAvailable: boolean;
  overtakeActive: boolean;
  overtakeActivationDistance: number;
  regs2026: boolean;
  gLat: number;
  gLon: number;
  lapDistance: number;
  currentLapMs: number;
  lap: number;
  sector1Ms: number;
  sector2Ms: number;
  speedTrapKmh: number;
}

export interface FeedEvent {
  t: number; // session time
  code: string;
  text: string;
}

export type Source = 'udp' | 'sim' | 'replay';

export interface Snapshot {
  source: Source;
  lastPacketAgoMs: number | null;
  packetsPerSec: number;
  wrongFormat: number | null; // packetFormat seen when it is not 2026
  gameVersion: string;
  sessionTime: number;
  session: SessionInfo | null;
  cars: CarRow[];
  player: PlayerDetail | null;
  events: FeedEvent[];
}

export const ERS_MAX_J = 4_000_000;
