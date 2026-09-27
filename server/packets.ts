// Packet layouts for the "F1 25: 2026 Season Pack" UDP format (packetFormat 2026).
// Per-wheel arrays are always ordered [RL, RR, FL, FR].
import { decode, sizeOf, type FieldType, type Struct } from './codec.ts';

export const PACKET_FORMAT = 2026;
export const MAX_CARS = 24;

export const PacketId = {
  Motion: 0,
  Session: 1,
  LapData: 2,
  Event: 3,
  Participants: 4,
  CarSetups: 5,
  CarTelemetry: 6,
  CarStatus: 7,
  FinalClassification: 8,
  LobbyInfo: 9,
  CarDamage: 10,
  SessionHistory: 11,
  TyreSets: 12,
  MotionEx: 13,
  TimeTrial: 14,
  LapPositions: 15,
  CarTelemetry2: 16,
} as const;

// The 2026 format sends G-forces as int16 instead of float. The official scale
// factor could not be verified; adjust here if the G meter reads wrong in-game.
export const G_FORCE_SCALE = 1000;
// Direction vectors are normalised int16 (documented).
export const DIR_SCALE = 32767;

const arr = (t: FieldType, n: number): FieldType => ({ arr: t, n });
const st = (s: Struct): FieldType => ({ struct: s });
const wheels = (t: FieldType) => arr(t, 4);
const cars = (s: Struct) => arr(st(s), MAX_CARS);

export const Header: Struct = [
  ['packetFormat', 'u16'],
  ['gameYear', 'u8'],
  ['gameMajorVersion', 'u8'],
  ['gameMinorVersion', 'u8'],
  ['packetVersion', 'u8'],
  ['packetId', 'u8'],
  ['sessionUID', 'u64'],
  ['sessionTime', 'f32'],
  ['frameIdentifier', 'u32'],
  ['overallFrameIdentifier', 'u32'],
  ['playerCarIndex', 'u8'],
  ['secondaryPlayerCarIndex', 'u8'],
];

export const CarMotion: Struct = [
  ['worldPositionX', 'f32'], ['worldPositionY', 'f32'], ['worldPositionZ', 'f32'],
  ['worldVelocityX', 'f32'], ['worldVelocityY', 'f32'], ['worldVelocityZ', 'f32'],
  ['worldForwardDirX', 'i16'], ['worldForwardDirY', 'i16'], ['worldForwardDirZ', 'i16'],
  ['worldRightDirX', 'i16'], ['worldRightDirY', 'i16'], ['worldRightDirZ', 'i16'],
  ['gForceLateral', 'i16'], ['gForceLongitudinal', 'i16'], ['gForceVertical', 'i16'],
  ['yaw', 'f32'], ['pitch', 'f32'], ['roll', 'f32'],
];

const Zone: Struct = [['zoneStart', 'f32'], ['zoneEnd', 'f32']];

export const Session: Struct = [
  ['weather', 'u8'],
  ['trackTemperature', 'i8'],
  ['airTemperature', 'i8'],
  ['totalLaps', 'u8'],
  ['trackLength', 'u16'],
  ['sessionType', 'u8'],
  ['trackId', 'i8'],
  ['formula', 'u8'],
  ['sessionTimeLeft', 'u16'],
  ['sessionDuration', 'u16'],
  ['pitSpeedLimit', 'u8'],
  ['gamePaused', 'bool'],
  ['isSpectating', 'bool'],
  ['spectatorCarIndex', 'u8'],
  ['sliProNativeSupport', 'bool'],
  ['numMarshalZones', 'u8'],
  ['marshalZones', arr(st([['zoneStart', 'f32'], ['zoneFlag', 'i8']]), 21)],
  ['safetyCarStatus', 'u8'],
  ['networkGame', 'bool'],
  ['numWeatherForecastSamples', 'u8'],
  ['weatherForecastSamples', arr(st([
    ['sessionType', 'u8'],
    ['timeOffset', 'u8'],
    ['weather', 'u8'],
    ['trackTemperature', 'i8'],
    ['trackTemperatureChange', 'i8'],
    ['airTemperature', 'i8'],
    ['airTemperatureChange', 'i8'],
    ['rainPercentage', 'u8'],
  ]), 64)],
  ['forecastAccuracy', 'u8'],
  ['aiDifficulty', 'u8'],
  ['seasonLinkIdentifier', 'u32'],
  ['weekendLinkIdentifier', 'u32'],
  ['sessionLinkIdentifier', 'u32'],
  ['pitStopWindowIdealLap', 'u8'],
  ['pitStopWindowLatestLap', 'u8'],
  ['pitStopRejoinPosition', 'u8'],
  ['steeringAssist', 'u8'],
  ['brakingAssist', 'u8'],
  ['gearboxAssist', 'u8'],
  ['pitAssist', 'u8'],
  ['pitReleaseAssist', 'u8'],
  ['ersAssist', 'u8'],
  ['drsAssist', 'u8'],
  ['dynamicRacingLine', 'u8'],
  ['dynamicRacingLineType', 'u8'],
  ['gameMode', 'u8'],
  ['ruleSet', 'u8'],
  ['timeOfDay', 'u32'],
  ['sessionLength', 'u8'],
  ['speedUnitsLeadPlayer', 'u8'],
  ['temperatureUnitsLeadPlayer', 'u8'],
  ['speedUnitsSecondaryPlayer', 'u8'],
  ['temperatureUnitsSecondaryPlayer', 'u8'],
  ['numSafetyCarPeriods', 'u8'],
  ['numVirtualSafetyCarPeriods', 'u8'],
  ['numRedFlagPeriods', 'u8'],
  ['equalCarPerformance', 'u8'],
  ['recoveryMode', 'u8'],
  ['flashbackLimit', 'u8'],
  ['surfaceType', 'u8'],
  ['lowFuelMode', 'u8'],
  ['raceStarts', 'u8'],
  ['tyreTemperature', 'u8'],
  ['pitLaneTyreSim', 'u8'],
  ['carDamage', 'u8'],
  ['carDamageRate', 'u8'],
  ['collisions', 'u8'],
  ['collisionsOffForFirstLapOnly', 'u8'],
  ['mpUnsafePitRelease', 'u8'],
  ['mpOffForGriefing', 'u8'],
  ['cornerCuttingStringency', 'u8'],
  ['parcFermeRules', 'u8'],
  ['pitStopExperience', 'u8'],
  ['safetyCar', 'u8'],
  ['safetyCarExperience', 'u8'],
  ['formationLap', 'u8'],
  ['formationLapExperience', 'u8'],
  ['redFlags', 'u8'],
  ['affectsLicenceLevelSolo', 'u8'],
  ['affectsLicenceLevelMP', 'u8'],
  ['numSessionsInWeekend', 'u8'],
  ['weekendStructure', arr('u8', 12)],
  ['sector2LapDistanceStart', 'f32'],
  ['sector3LapDistanceStart', 'f32'],
  ['activeAeroTrackStatus', 'u8'], // 0 = full, 1 = partial
  ['numActiveAeroZonesFull', 'u8'],
  ['activeAeroZonesFull', arr(st(Zone), 8)],
  ['numActiveAeroZonesPartial', 'u8'],
  ['activeAeroZonesPartial', arr(st(Zone), 8)],
  ['numDrsZones', 'u8'],
  ['drsZones', arr(st(Zone), 4)],
  ['startReactionTime', 'f32'],
  ['antiLockBrakesAssist', 'u8'],
  ['tractionControlAssist', 'u8'],
  ['dynamicRacingLineHiVis', 'u8'],
  ['dynamicRacingLineColourBlind', 'u8'],
  ['recurringRewindPrompt', 'u8'],
];

export const LapData: Struct = [
  ['lastLapTimeInMS', 'u32'],
  ['currentLapTimeInMS', 'u32'],
  ['sector1TimeMSPart', 'u16'],
  ['sector1TimeMinutesPart', 'u8'],
  ['sector2TimeMSPart', 'u16'],
  ['sector2TimeMinutesPart', 'u8'],
  ['deltaToCarInFrontMSPart', 'u16'],
  ['deltaToCarInFrontMinutesPart', 'u8'],
  ['deltaToRaceLeaderMSPart', 'u16'],
  ['deltaToRaceLeaderMinutesPart', 'u8'],
  ['lapDistance', 'f32'],
  ['totalDistance', 'f32'],
  ['safetyCarDelta', 'f32'],
  ['carPosition', 'u8'],
  ['currentLapNum', 'u8'],
  ['pitStatus', 'u8'],
  ['numPitStops', 'u8'],
  ['sector', 'u8'],
  ['currentLapInvalid', 'bool'],
  ['penalties', 'u8'],
  ['totalWarnings', 'u8'],
  ['cornerCuttingWarnings', 'u8'],
  ['numUnservedDriveThroughPens', 'u8'],
  ['numUnservedStopGoPens', 'u8'],
  ['gridPosition', 'u8'],
  ['driverStatus', 'u8'],
  ['resultStatus', 'u8'],
  ['pitLaneTimerActive', 'bool'],
  ['pitLaneTimeInLaneInMS', 'u16'],
  ['pitStopTimerInMS', 'u16'],
  ['pitStopShouldServePen', 'bool'],
  ['speedTrapFastestSpeed', 'f32'],
  ['speedTrapFastestLap', 'u8'],
];

export const Participant: Struct = [
  ['aiControlled', 'bool'],
  ['driverId', 'u16'],
  ['networkId', 'u16'],
  ['teamId', 'u16'],
  ['myTeam', 'bool'],
  ['raceNumber', 'u8'],
  ['nationality', 'u8'],
  ['name', { str: 32 }],
  ['yourTelemetry', 'bool'],
  ['showOnlineNames', 'bool'],
  ['techLevel', 'u16'],
  ['platform', 'u8'],
  ['numColours', 'u8'],
  ['liveryColours', arr(st([['red', 'u8'], ['green', 'u8'], ['blue', 'u8']]), 4)],
];

export const CarTelemetry: Struct = [
  ['speed', 'u16'],
  ['throttle', 'f32'],
  ['steer', 'f32'],
  ['brake', 'f32'],
  ['clutch', 'u8'],
  ['gear', 'i8'],
  ['engineRPM', 'u16'],
  ['drs', 'bool'],
  ['revLightsPercent', 'u8'],
  ['revLightsBitValue', 'u16'],
  ['brakesTemperature', wheels('u16')],
  ['tyresSurfaceTemperature', wheels('u8')],
  ['tyresInnerTemperature', wheels('u8')],
  ['engineTemperature', 'u8'],
  ['tyresPressure', wheels('f32')],
  ['surfaceType', wheels('u8')],
];

export const CarStatus: Struct = [
  ['tractionControl', 'u8'],
  ['antiLockBrakes', 'u8'],
  ['fuelMix', 'u8'],
  ['frontBrakeBias', 'u8'],
  ['pitLimiterStatus', 'bool'],
  ['fuelInTank', 'f32'],
  ['fuelCapacity', 'f32'],
  ['fuelRemainingLaps', 'f32'],
  ['maxRPM', 'u16'],
  ['idleRPM', 'u16'],
  ['maxGears', 'u8'],
  ['drsAllowed', 'bool'],
  ['drsActivationDistance', 'u16'],
  ['actualTyreCompound', 'u8'],
  ['visualTyreCompound', 'u8'],
  ['tyresAgeLaps', 'u8'],
  ['vehicleFiaFlags', 'i8'],
  ['enginePowerICE', 'f32'],
  ['enginePowerMGUK', 'f32'],
  ['ersStoreEnergy', 'f32'],
  ['ersDeployMode', 'u8'],
  ['ersHarvestedThisLapMGUK', 'f32'],
  ['ersHarvestedThisLapMGUH', 'f32'],
  ['ersHarvestLimitPerLap', 'f32'],
  ['ersDeployedThisLap', 'f32'],
  ['networkPaused', 'bool'],
];

export const CarDamage: Struct = [
  ['tyresWear', wheels('f32')],
  ['tyresDamage', wheels('u8')],
  ['brakesDamage', wheels('u8')],
  ['tyreBlisters', wheels('u8')],
  ['frontLeftWingDamage', 'u8'],
  ['frontRightWingDamage', 'u8'],
  ['rearWingDamage', 'u8'],
  ['floorDamage', 'u8'],
  ['diffuserDamage', 'u8'],
  ['sidepodDamage', 'u8'],
  ['drsFault', 'bool'],
  ['ersFault', 'bool'],
  ['gearBoxDamage', 'u8'],
  ['engineDamage', 'u8'],
  ['engineMGUHWear', 'u8'],
  ['engineESWear', 'u8'],
  ['engineCEWear', 'u8'],
  ['engineICEWear', 'u8'],
  ['engineMGUKWear', 'u8'],
  ['engineTCWear', 'u8'],
  ['engineBlown', 'bool'],
  ['engineSeized', 'bool'],
];

export const LapHistory: Struct = [
  ['lapTimeInMS', 'u32'],
  ['sector1TimeMSPart', 'u16'],
  ['sector1TimeMinutesPart', 'u8'],
  ['sector2TimeMSPart', 'u16'],
  ['sector2TimeMinutesPart', 'u8'],
  ['sector3TimeMSPart', 'u16'],
  ['sector3TimeMinutesPart', 'u8'],
  ['lapValidBitFlags', 'u8'], // 0x01 lap, 0x02 S1, 0x04 S2, 0x08 S3 valid
];

export const CarTelemetry2: Struct = [
  ['activeAeroMode', 'u8'], // 0 = corner mode, 1 = straight mode
  ['activeAeroAvailable', 'bool'],
  ['activeAeroActivationDistance', 'u16'],
  ['overtakeAvailable', 'bool'],
  ['overtakeActive', 'bool'],
  ['overtakeActivationDistance', 'u16'],
  ['regulations2026Applicable', 'bool'],
  ['drivingWrongWay', 'bool'],
];

// Body schemas (everything after the header), keyed by packet id.
export const Bodies: Partial<Record<number, Struct>> = {
  [PacketId.Motion]: [['carMotionData', cars(CarMotion)]],
  [PacketId.Session]: Session,
  [PacketId.LapData]: [
    ['lapData', cars(LapData)],
    ['timeTrialPBCarIdx', 'u8'],
    ['timeTrialRivalCarIdx', 'u8'],
  ],
  [PacketId.Event]: [['eventCode', { str: 4 }], ['details', arr('u8', 12)]],
  [PacketId.Participants]: [['numActiveCars', 'u8'], ['participants', cars(Participant)]],
  [PacketId.CarTelemetry]: [
    ['carTelemetryData', cars(CarTelemetry)],
    ['mfdPanelIndex', 'u8'],
    ['mfdPanelIndexSecondaryPlayer', 'u8'],
    ['suggestedGear', 'i8'],
  ],
  [PacketId.CarStatus]: [['carStatusData', cars(CarStatus)]],
  [PacketId.CarDamage]: [['carDamageData', cars(CarDamage)]],
  [PacketId.SessionHistory]: [
    ['carIdx', 'u8'],
    ['numLaps', 'u8'],
    ['numTyreStints', 'u8'],
    ['bestLapTimeLapNum', 'u8'],
    ['bestSector1LapNum', 'u8'],
    ['bestSector2LapNum', 'u8'],
    ['bestSector3LapNum', 'u8'],
    ['lapHistoryData', arr(st(LapHistory), 100)],
    ['tyreStintsHistoryData', arr(st([
      ['endLap', 'u8'], ['tyreActualCompound', 'u8'], ['tyreVisualCompound', 'u8'],
    ]), 8)],
  ],
  [PacketId.LapPositions]: [
    ['numLaps', 'u8'],
    ['lapStart', 'u8'],
    ['positionForVehicleIdx', arr(arr('u8', MAX_CARS), 50)],
  ],
  [PacketId.CarTelemetry2]: [['carTelemetry2Data', cars(CarTelemetry2)]],
};

// Total packet sizes as published for packetFormat 2026 — checked by the tests.
export const EXPECTED_SIZES: Partial<Record<number, number>> = {
  [PacketId.Motion]: 1325,
  [PacketId.Session]: 926,
  [PacketId.LapData]: 1399,
  [PacketId.Event]: 45,
  [PacketId.Participants]: 1470,
  [PacketId.CarTelemetry]: 1448,
  [PacketId.CarStatus]: 1445,
  [PacketId.CarDamage]: 1133,
  [PacketId.SessionHistory]: 1460,
  [PacketId.LapPositions]: 1231,
  [PacketId.CarTelemetry2]: 269,
};

export const HEADER_SIZE = sizeOf({ struct: Header });

// Event payloads, decoded from the 12-byte details union by event code.
export const EventDetails: Record<string, Struct> = {
  FTLP: [['vehicleIdx', 'u8'], ['lapTime', 'f32']],
  RTMT: [['vehicleIdx', 'u8'], ['reason', 'u8']],
  TMPT: [['vehicleIdx', 'u8']],
  RCWN: [['vehicleIdx', 'u8']],
  PENA: [
    ['penaltyType', 'u8'], ['infringementType', 'u8'], ['vehicleIdx', 'u8'],
    ['otherVehicleIdx', 'u8'], ['time', 'u8'], ['lapNum', 'u8'], ['placesGained', 'u8'],
  ],
  SPTP: [
    ['vehicleIdx', 'u8'], ['speed', 'f32'], ['isOverallFastestInSession', 'bool'],
    ['isDriverFastestInSession', 'bool'], ['fastestVehicleIdxInSession', 'u8'],
    ['fastestSpeedInSession', 'f32'],
  ],
  STLG: [['numLights', 'u8']],
  DTSV: [['vehicleIdx', 'u8']],
  SGSV: [['vehicleIdx', 'u8'], ['stopTime', 'f32']],
  FLBK: [['flashbackFrameIdentifier', 'u32'], ['flashbackSessionTime', 'f32']],
  BUTN: [['buttonStatus', 'u32']],
  OVTK: [['overtakingVehicleIdx', 'u8'], ['beingOvertakenVehicleIdx', 'u8']],
  SCAR: [['safetyCarType', 'u8'], ['eventType', 'u8']],
  COLL: [['vehicle1Idx', 'u8'], ['vehicle2Idx', 'u8'], ['severity', 'u8']],
  DRSD: [['reason', 'u8']],
};

export type DecodedPacket = { header: any; body: any } | { header: any; body: null; reason: string };

export function decodePacket(buf: Uint8Array): DecodedPacket | null {
  if (buf.byteLength < HEADER_SIZE) return null;
  const header = decode({ struct: Header }, buf);
  if (header.packetFormat !== PACKET_FORMAT) {
    return { header, body: null, reason: 'format' };
  }
  const schema = Bodies[header.packetId];
  if (!schema) return { header, body: null, reason: 'unhandled' };
  const expected = HEADER_SIZE + sizeOf({ struct: schema });
  if (buf.byteLength < expected) return { header, body: null, reason: 'short' };
  const body = decode({ struct: schema }, buf, HEADER_SIZE);
  if (header.packetId === PacketId.Event) {
    const detailSchema = EventDetails[body.eventCode];
    body.details = detailSchema ? decode({ struct: detailSchema }, Uint8Array.from(body.details)) : {};
  }
  return { header, body };
}
