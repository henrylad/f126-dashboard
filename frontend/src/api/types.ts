import type { Lap, MiniSector, Sample } from '../laps/lapMath.ts';

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
  idleRpm: number;
  maxGears: number;
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
  /** Surface under each wheel (see SURFACES). */
  surfaceType: Wheels<number>;
  damage: {
    frontLeftWing: number; frontRightWing: number; rearWing: number; floor: number;
    diffuser: number; sidepod: number; gearbox: number; engine: number;
    ice: number; mguk: number; mguh: number; es: number; ce: number; tc: number;
    drsFault: boolean; ersFault: boolean; engineBlown: boolean; engineSeized: boolean;
  };
  fuelKg: number;
  fuelCapacityKg: number;
  fuelLaps: number;
  fuelMix: number;
  brakeBias: number;
  /** 0 off, 1 medium, 2 full */
  tractionControl: number;
  abs: boolean;
  /** -1 invalid, 0 none, 1 green, 2 blue, 3 yellow */
  fiaFlag: number;
  drs: boolean;
  drsAllowed: boolean;
  drsActivationDistance: number;
  ersStoreJ: number;
  ersDeployMode: number;
  ersDeployedLapJ: number;
  ersHarvestedLapJ: number;
  ersHarvestedMgukLapJ: number;
  ersHarvestedMguhLapJ: number;
  ersHarvestLimitLapJ: number;
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
  wrongWay: boolean;
  gLat: number;
  gLon: number;
  gVert: number;
  /** Radians. */
  yaw: number;
  pitch: number;
  roll: number;
  lapDistance: number;
  currentLapMs: number;
  lap: number;
  sector1Ms: number;
  sector2Ms: number;
  speedTrapKmh: number;
  race: LapInfo;
  /** Extended motion; null until the game sends it. */
  chassis: ChassisInfo | null;
  /** Car setup; null until the game sends it. */
  setup: SetupInfo | null;
}

export interface LapInfo {
  position: number;
  gridPosition: number;
  lastLapMs: number;
  sector: number;
  currentLapInvalid: boolean;
  totalDistance: number;
  gapAheadMs: number;
  gapLeaderMs: number;
  safetyCarDelta: number;
  penaltiesSec: number;
  totalWarnings: number;
  cornerCuttingWarnings: number;
  unservedDriveThroughs: number;
  unservedStopGos: number;
  pitStatus: number;
  numPitStops: number;
  pitLaneTimerActive: boolean;
  pitLaneTimeMs: number;
  pitStopTimerMs: number;
  servePenaltyAtStop: boolean;
  driverStatus: number;
  resultStatus: number;
  /** 255 when there is no speed-trap pass yet. */
  speedTrapLap: number;
}

/** Packet 13. Wheel arrays are [RL, RR, FL, FR]. */
export interface ChassisInfo {
  suspensionPosition: Wheels<number>;
  suspensionVelocity: Wheels<number>;
  suspensionAcceleration: Wheels<number>;
  /** m/s */
  wheelSpeed: Wheels<number>;
  wheelSlipRatio: Wheels<number>;
  /** rad */
  wheelSlipAngle: Wheels<number>;
  /** N */
  wheelLatForce: Wheels<number>;
  wheelLongForce: Wheels<number>;
  wheelVertForce: Wheels<number>;
  /** rad */
  wheelCamber: Wheels<number>;
  wheelCamberGain: Wheels<number>;
  /** m */
  heightOfCog: number;
  /** [x right, y up, z forward] m/s */
  localVelocity: [number, number, number];
  /** rad/s */
  angularVelocity: [number, number, number];
  angularAcceleration: [number, number, number];
  /** rad */
  frontWheelsAngle: number;
  /** m */
  frontAeroHeight: number;
  rearAeroHeight: number;
  /** rad */
  frontRollAngle: number;
  rearRollAngle: number;
  chassisYaw: number;
  chassisPitch: number;
}

/** Packet 5. */
export interface SetupInfo {
  frontWing: number;
  rearWing: number;
  onThrottle: number;
  offThrottle: number;
  frontCamber: number;
  rearCamber: number;
  frontToe: number;
  rearToe: number;
  frontSuspension: number;
  rearSuspension: number;
  frontAntiRollBar: number;
  rearAntiRollBar: number;
  frontRideHeight: number;
  rearRideHeight: number;
  brakePressure: number;
  brakeBias: number;
  engineBraking: number;
  tyresPressure: Wheels<number>;
  ballast: number;
  fuelLoad: number;
  nextFrontWing: number;
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

// --- Lap history (PitWall.Core.Laps), sent alongside the snapshot ---

export interface OutlinePoint { x: number; z: number }
export interface OutlinePatch { i: number; x: number; z: number }

/** Everything the server's lap tracker knows; sent on connect and when a new session starts. */
export interface LapHistory {
  sessionUid: string;
  playerIdx: number;
  playerBestLapId: number | null;
  /** Every player lap, oldest first. */
  laps: Lap[];
  /** Other drivers' fastest laps. */
  driverBests: Lap[];
  /** One point per outline bin, null where the circuit is not known yet. */
  outline: (OutlinePoint | null)[];
  minis: (MiniSector | null)[];
  lastMinis: (MiniSector | null)[];
  /** The player's current lap so far. */
  current: Sample[];
}

/** What changed since the previous delta. Applying one is idempotent. */
export interface LapDelta {
  playerIdx: number;
  playerBestLapId: number | null;
  minis: (MiniSector | null)[];
  lastMinis: (MiniSector | null)[];
  /** Samples of the current lap from index `from` on; replaces anything past it. */
  current: { from: number; samples: Sample[] };
  addedLaps: Lap[];
  removedLapIds: number[];
  /** Drivers whose fastest lap improved. */
  driverBests: Lap[];
  outline: OutlinePatch[];
}

// --- WebSocket messages (PitWall.Server.Realtime.ServerMessage) ---

export type ServerMessage =
  | { type: 'history'; laps: LapHistory }
  | { type: 'tick'; snapshot: Snapshot; laps: LapDelta };
