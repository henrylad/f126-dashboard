// Folds decoded packets into one live picture of the session.
import { G_FORCE_SCALE, MAX_CARS, PacketId, decodePacket } from './packets.ts';
import { team } from '../shared/meta.ts';
import { ERS_MAX_J, type CarRow, type FeedEvent, type PlayerDetail, type SessionInfo, type Snapshot, type Source, type Wheels } from '../shared/types.ts';

const MAX_EVENTS = 40;

const msOf = (minutes: number, ms: number) => minutes * 60_000 + ms;

export class TelemetryState {
  private uid = '';
  private header: any = null;
  private session: any = null;
  private participants: any = null;
  private motion: any = null;
  private lap: any = null;
  private telemetry: any = null;
  private status: any = null;
  private damage: any = null;
  private tel2: any = null;
  private bestLapMs = new Array<number>(MAX_CARS).fill(0);
  private events: FeedEvent[] = [];
  private lastPacketAt: number | null = null;
  private wrongFormat: number | null = null;
  private packetTimes: number[] = [];

  constructor(public source: Source) {}

  ingest(buf: Uint8Array, now = Date.now()): void {
    const pkt = decodePacket(buf);
    if (!pkt) return;
    this.lastPacketAt = now;
    this.packetTimes.push(now);
    if (pkt.body === null) {
      if ('reason' in pkt && pkt.reason === 'format') this.wrongFormat = pkt.header.packetFormat;
      return;
    }
    this.wrongFormat = null;
    const { header, body } = pkt;
    if (header.sessionUID !== this.uid) this.reset(header.sessionUID);
    this.header = header;

    switch (header.packetId) {
      case PacketId.Session: this.session = body; break;
      case PacketId.Participants: this.participants = body; break;
      case PacketId.Motion: this.motion = body.carMotionData; break;
      case PacketId.LapData: this.lap = body.lapData; break;
      case PacketId.CarTelemetry: this.telemetry = body; break;
      case PacketId.CarStatus: this.status = body.carStatusData; break;
      case PacketId.CarDamage: this.damage = body.carDamageData; break;
      case PacketId.CarTelemetry2: this.tel2 = body.carTelemetry2Data; break;
      case PacketId.SessionHistory: {
        const n = body.bestLapTimeLapNum;
        const best = n > 0 ? body.lapHistoryData[n - 1]?.lapTimeInMS ?? 0 : 0;
        if (body.carIdx < MAX_CARS) this.bestLapMs[body.carIdx] = best;
        break;
      }
      case PacketId.Event: this.onEvent(header.sessionTime, body); break;
    }
  }

  private reset(uid: string) {
    this.uid = uid;
    this.session = this.participants = this.motion = this.lap = null;
    this.telemetry = this.status = this.damage = this.tel2 = null;
    this.bestLapMs.fill(0);
    this.events = [];
  }

  private driverName(i: number): string {
    return this.participants?.participants[i]?.name || `Car ${i + 1}`;
  }

  private onEvent(t: number, body: { eventCode: string; details: any }) {
    const d = body.details;
    const n = (i: number) => this.driverName(i);
    const fmtLap = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
    let text: string | null = null;
    switch (body.eventCode) {
      case 'SSTA': text = 'Session started'; break;
      case 'SEND': text = 'Session ended'; break;
      case 'FTLP': text = `Fastest lap — ${n(d.vehicleIdx)} ${fmtLap(d.lapTime)}`; break;
      case 'RTMT': text = `${n(d.vehicleIdx)} retired`; break;
      case 'CHQF': text = 'Chequered flag'; break;
      case 'RCWN': text = `${n(d.vehicleIdx)} wins the race`; break;
      case 'PENA': text = `Penalty — ${n(d.vehicleIdx)}${d.time && d.time < 255 ? ` +${d.time}s` : ''}`; break;
      case 'SPTP': if (d.isOverallFastestInSession) text = `Speed trap — ${n(d.vehicleIdx)} ${d.speed.toFixed(1)} km/h`; break;
      case 'LGOT': text = 'Lights out'; break;
      case 'DTSV': text = `${n(d.vehicleIdx)} served drive-through`; break;
      case 'SGSV': text = `${n(d.vehicleIdx)} served stop-go`; break;
      case 'OVTK': text = `${n(d.overtakingVehicleIdx)} passes ${n(d.beingOvertakenVehicleIdx)}`; break;
      case 'SCAR': text = ['', 'Safety Car', 'Virtual Safety Car', 'Formation lap'][d.safetyCarType] + ' ' + ['deployed', 'returning', 'returned', 'resume race'][d.eventType]; break;
      case 'COLL': text = `Contact — ${n(d.vehicle1Idx)} / ${n(d.vehicle2Idx)}`; break;
      case 'RDFL': text = 'Red flag'; break;
      case 'TMPT': text = 'Teammate in the pits'; break;
      case 'FLBK': text = 'Flashback used'; break;
      case 'DRSE': text = 'DRS enabled'; break;
      case 'DRSD': text = 'DRS disabled'; break;
    }
    if (!text) return;
    this.events.unshift({ t, code: body.eventCode, text });
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
  }

  snapshot(now = Date.now()): Snapshot {
    this.packetTimes = this.packetTimes.filter((t) => now - t < 1000);
    const h = this.header;
    return {
      source: this.source,
      lastPacketAgoMs: this.lastPacketAt === null ? null : now - this.lastPacketAt,
      packetsPerSec: this.packetTimes.length,
      wrongFormat: this.wrongFormat,
      gameVersion: h ? `${h.gameMajorVersion}.${String(h.gameMinorVersion).padStart(2, '0')}` : '',
      sessionTime: h?.sessionTime ?? 0,
      session: this.sessionInfo(),
      cars: this.carRows(),
      player: this.playerDetail(),
      events: this.events,
    };
  }

  private sessionInfo(): SessionInfo | null {
    const s = this.session;
    if (!s) return null;
    const zones = (list: any[], count: number) =>
      list.slice(0, count).map((z) => ({ start: z.zoneStart, end: z.zoneEnd }));
    return {
      uid: this.uid,
      trackId: s.trackId,
      trackLength: s.trackLength,
      totalLaps: s.totalLaps,
      sessionType: s.sessionType,
      timeLeft: s.sessionTimeLeft,
      weather: s.weather,
      trackTemp: s.trackTemperature,
      airTemp: s.airTemperature,
      safetyCar: s.safetyCarStatus,
      pitSpeedLimit: s.pitSpeedLimit,
      marshalZones: s.marshalZones.slice(0, s.numMarshalZones).map((z: any) => ({ start: z.zoneStart, flag: z.zoneFlag })),
      aeroZonesFull: zones(s.activeAeroZonesFull, s.numActiveAeroZonesFull),
      aeroZonesPartial: zones(s.activeAeroZonesPartial, s.numActiveAeroZonesPartial),
      drsZones: zones(s.drsZones, s.numDrsZones),
      sector2Start: s.sector2LapDistanceStart,
      sector3Start: s.sector3LapDistanceStart,
      pitWindowIdeal: s.pitStopWindowIdealLap,
      pitWindowLatest: s.pitStopWindowLatestLap,
      rejoinPosition: s.pitStopRejoinPosition,
      forecast: s.weatherForecastSamples
        .slice(0, s.numWeatherForecastSamples)
        .filter((f: any) => f.sessionType === s.sessionType)
        .slice(0, 6)
        .map((f: any) => ({ offset: f.timeOffset, weather: f.weather, rain: f.rainPercentage, trackTemp: f.trackTemperature })),
    };
  }

  private carRows(): CarRow[] {
    if (!this.lap) return [];
    const player = this.header?.playerCarIndex ?? 0;
    const active = this.participants?.numActiveCars ?? MAX_CARS;
    const rows: CarRow[] = [];
    for (let i = 0; i < MAX_CARS; i++) {
      const l = this.lap[i];
      // resultStatus 0 = invalid, 1 = inactive
      if (!l || l.resultStatus < 2 || l.carPosition === 0) continue;
      if (!this.participants && i >= active) continue;
      const p = this.participants?.participants[i];
      const st = this.status?.[i];
      const m = this.motion?.[i];
      const t2 = this.tel2?.[i];
      const tel = this.telemetry?.carTelemetryData[i];
      const dmg = this.damage?.[i];
      rows.push({
        idx: i,
        position: l.carPosition,
        name: this.driverName(i),
        raceNumber: p?.raceNumber ?? 0,
        teamId: p?.teamId ?? -1,
        colour: team(p?.teamId ?? -1).colour,
        isPlayer: i === player,
        lap: l.currentLapNum,
        lapDistance: l.lapDistance,
        sector: l.sector,
        lastLapMs: l.lastLapTimeInMS,
        bestLapMs: this.bestLapMs[i],
        currentLapMs: l.currentLapTimeInMS,
        currentLapInvalid: l.currentLapInvalid,
        gapToLeaderMs: msOf(l.deltaToRaceLeaderMinutesPart, l.deltaToRaceLeaderMSPart),
        intervalMs: msOf(l.deltaToCarInFrontMinutesPart, l.deltaToCarInFrontMSPart),
        pitStatus: l.pitStatus,
        numPitStops: l.numPitStops,
        penaltiesSec: l.penalties,
        driverStatus: l.driverStatus,
        resultStatus: l.resultStatus,
        compound: st?.visualTyreCompound ?? 0,
        tyreAge: st?.tyresAgeLaps ?? 0,
        x: m?.worldPositionX ?? 0,
        z: m?.worldPositionZ ?? 0,
        aeroMode: t2?.activeAeroMode ?? 0,
        overtakeActive: t2?.overtakeActive ?? false,
        ersPct: st ? Math.min(100, (st.ersStoreEnergy / ERS_MAX_J) * 100) : 0,
        speed: tel?.speed ?? 0,
        throttle: tel?.throttle ?? 0,
        brake: tel?.brake ?? 0,
        gear: tel?.gear ?? 0,
        ersStoreJ: st?.ersStoreEnergy ?? 0,
        ersDeployMode: st?.ersDeployMode ?? 0,
        fuelKg: st?.fuelInTank ?? 0,
        tyreWearAvg: dmg ? dmg.tyresWear.reduce((a: number, b: number) => a + b, 0) / 4 : 0,
      });
    }
    return rows.sort((a, b) => a.position - b.position);
  }

  private playerDetail(): PlayerDetail | null {
    const i = this.header?.playerCarIndex;
    if (i === undefined || i >= MAX_CARS) return null;
    const tel = this.telemetry?.carTelemetryData[i];
    if (!tel) return null;
    const st = this.status?.[i] ?? {};
    const dmg = this.damage?.[i] ?? {};
    const t2 = this.tel2?.[i] ?? {};
    const m = this.motion?.[i];
    const l = this.lap?.[i] ?? {};
    const w = <T>(v: T[] | undefined, d: T) => (v ?? [d, d, d, d]) as Wheels<T>;
    return {
      idx: i,
      speed: tel.speed,
      throttle: tel.throttle,
      brake: tel.brake,
      steer: tel.steer,
      clutch: tel.clutch,
      gear: tel.gear,
      suggestedGear: this.telemetry.suggestedGear,
      rpm: tel.engineRPM,
      maxRpm: st.maxRPM || 13_000,
      revLightsPct: tel.revLightsPercent,
      engineTemp: tel.engineTemperature,
      brakesTemp: tel.brakesTemperature,
      tyresSurface: tel.tyresSurfaceTemperature,
      tyresInner: tel.tyresInnerTemperature,
      tyresPressure: tel.tyresPressure,
      tyresWear: w(dmg.tyresWear, 0),
      tyresDamage: w(dmg.tyresDamage, 0),
      tyreBlisters: w(dmg.tyreBlisters, 0),
      brakesDamage: w(dmg.brakesDamage, 0),
      damage: {
        frontLeftWing: dmg.frontLeftWingDamage ?? 0,
        frontRightWing: dmg.frontRightWingDamage ?? 0,
        rearWing: dmg.rearWingDamage ?? 0,
        floor: dmg.floorDamage ?? 0,
        diffuser: dmg.diffuserDamage ?? 0,
        sidepod: dmg.sidepodDamage ?? 0,
        gearbox: dmg.gearBoxDamage ?? 0,
        engine: dmg.engineDamage ?? 0,
        ice: dmg.engineICEWear ?? 0,
        mguk: dmg.engineMGUKWear ?? 0,
        mguh: dmg.engineMGUHWear ?? 0,
        es: dmg.engineESWear ?? 0,
        ce: dmg.engineCEWear ?? 0,
        tc: dmg.engineTCWear ?? 0,
      },
      fuelKg: st.fuelInTank ?? 0,
      fuelLaps: st.fuelRemainingLaps ?? 0,
      fuelMix: st.fuelMix ?? 1,
      brakeBias: st.frontBrakeBias ?? 0,
      ersStoreJ: st.ersStoreEnergy ?? 0,
      ersDeployMode: st.ersDeployMode ?? 0,
      ersDeployedLapJ: st.ersDeployedThisLap ?? 0,
      ersHarvestedLapJ: (st.ersHarvestedThisLapMGUK ?? 0) + (st.ersHarvestedThisLapMGUH ?? 0),
      powerIceW: st.enginePowerICE ?? 0,
      powerMgukW: st.enginePowerMGUK ?? 0,
      pitLimiter: st.pitLimiterStatus ?? false,
      compound: st.actualTyreCompound ?? 0,
      visualCompound: st.visualTyreCompound ?? 0,
      tyreAge: st.tyresAgeLaps ?? 0,
      aeroMode: t2.activeAeroMode ?? 0,
      aeroAvailable: t2.activeAeroAvailable ?? false,
      aeroActivationDistance: t2.activeAeroActivationDistance ?? 0,
      overtakeAvailable: t2.overtakeAvailable ?? false,
      overtakeActive: t2.overtakeActive ?? false,
      overtakeActivationDistance: t2.overtakeActivationDistance ?? 0,
      regs2026: t2.regulations2026Applicable ?? false,
      gLat: m ? m.gForceLateral / G_FORCE_SCALE : 0,
      gLon: m ? m.gForceLongitudinal / G_FORCE_SCALE : 0,
      lapDistance: l.lapDistance ?? 0,
      currentLapMs: l.currentLapTimeInMS ?? 0,
      lap: l.currentLapNum ?? 0,
      sector1Ms: msOf(l.sector1TimeMinutesPart ?? 0, l.sector1TimeMSPart ?? 0),
      sector2Ms: msOf(l.sector2TimeMinutesPart ?? 0, l.sector2TimeMSPart ?? 0),
      speedTrapKmh: l.speedTrapFastestSpeed ?? 0,
    };
  }
}
