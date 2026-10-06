using System.Globalization;
using PitWall.Telemetry;
using PitWall.Telemetry.Packets;

namespace PitWall.Core.Live;

/// <summary>
/// Folds decoded packets into one live picture of the session. The game sends each
/// kind of packet independently, so this keeps the latest of each and combines them
/// on demand. Not thread-safe: callers serialise access.
/// </summary>
public sealed class TelemetryAggregator(TelemetrySource source, TimeProvider time)
{
    /// <summary>ERS store capacity used for percentages (4 MJ).</summary>
    public const double ErsMaxJ = 4_000_000;

    private const int DefaultMaxRpm = 13_000;

    private readonly EventFeed _feed = new();
    private readonly int[] _bestLapMs = new int[PacketFormat.MaxCars];
    private readonly Queue<long> _packetTimes = new();

    private ulong _sessionUid;
    private PacketHeader? _header;
    private SessionPacket? _session;
    private ParticipantsPacket? _participants;
    private MotionPacket? _motion;
    private LapDataPacket? _lap;
    private CarTelemetryPacket? _telemetry;
    private CarStatusPacket? _status;
    private CarDamagePacket? _damage;
    private CarTelemetry2Packet? _telemetry2;
    private long? _lastPacketAt;
    private int? _wrongFormat;

    public TelemetrySource Source => source;

    public void Ingest(ReadOnlySpan<byte> data)
    {
        if (data.Length < PacketCodec.HeaderSize) return;
        var result = PacketCodec.Decode(data);

        var now = NowMs();
        _lastPacketAt = now;
        _packetTimes.Enqueue(now);

        if (result.Status == DecodeStatus.WrongFormat) _wrongFormat = result.Header.PacketFormat;
        if (result.Packet is not { } packet) return;

        _wrongFormat = null;
        var header = result.Header;
        if (header.SessionUid != _sessionUid) Reset(header.SessionUid);
        _header = header;

        switch (packet)
        {
            case SessionPacket p: _session = p; break;
            case ParticipantsPacket p: _participants = p; break;
            case MotionPacket p: _motion = p; break;
            case LapDataPacket p: _lap = p; break;
            case CarTelemetryPacket p: _telemetry = p; break;
            case CarStatusPacket p: _status = p; break;
            case CarDamagePacket p: _damage = p; break;
            case CarTelemetry2Packet p: _telemetry2 = p; break;
            case SessionHistoryPacket p: OnSessionHistory(p); break;
            case EventPacket p: _feed.Add(header.SessionTime, p, DriverName); break;
        }
    }

    public Snapshot Snapshot()
    {
        var now = NowMs();
        while (_packetTimes.TryPeek(out var t) && now - t >= 1000) _packetTimes.Dequeue();

        return new Snapshot
        {
            Source = source,
            LastPacketAgoMs = now - _lastPacketAt,
            PacketsPerSec = _packetTimes.Count,
            WrongFormat = _wrongFormat,
            GameVersion = _header is { } h ? $"{h.GameMajorVersion}.{h.GameMinorVersion:00}" : "",
            SessionTime = _header?.SessionTime ?? 0,
            Session = BuildSessionInfo(),
            Cars = BuildCarRows(),
            Player = BuildPlayerDetail(),
            Events = [.. _feed.Events],
        };
    }

    private long NowMs() => time.GetUtcNow().ToUnixTimeMilliseconds();

    private void Reset(ulong uid)
    {
        _sessionUid = uid;
        _session = null;
        _participants = null;
        _motion = null;
        _lap = null;
        _telemetry = null;
        _status = null;
        _damage = null;
        _telemetry2 = null;
        Array.Clear(_bestLapMs);
        _feed.Clear();
    }

    private void OnSessionHistory(in SessionHistoryPacket p)
    {
        if (p.CarIdx >= PacketFormat.MaxCars) return;
        var bestLapNum = p.BestLapTimeLapNum;
        _bestLapMs[p.CarIdx] = bestLapNum is > 0 and <= 100 ? (int)p.Laps[bestLapNum - 1].LapTimeInMs : 0;
    }

    private string DriverName(int idx)
    {
        var name = idx < PacketFormat.MaxCars && _participants is { } p ? p.Cars[idx].Name.ToString() : "";
        return name.Length > 0 ? name : $"Car {idx + 1}";
    }

    private SessionInfo? BuildSessionInfo()
    {
        if (_session is not { } s) return null;

        return new SessionInfo
        {
            Uid = _sessionUid.ToString(CultureInfo.InvariantCulture),
            TrackId = s.TrackId,
            TrackLength = s.TrackLength,
            TotalLaps = s.TotalLaps,
            SessionType = s.SessionType,
            TimeLeft = s.SessionTimeLeft,
            Weather = s.Weather,
            TrackTemp = s.TrackTemperature,
            AirTemp = s.AirTemperature,
            SafetyCar = s.SafetyCarStatus,
            PitSpeedLimit = s.PitSpeedLimit,
            MarshalZones = Take<MarshalZone, MarshalZoneInfo>(s.MarshalZones, s.NumMarshalZones, z => new MarshalZoneInfo(z.ZoneStart, z.ZoneFlag)),
            AeroZonesFull = Take<TrackZone, Zone>(s.ActiveAeroZonesFull, s.NumActiveAeroZonesFull, ToZone),
            AeroZonesPartial = Take<TrackZone, Zone>(s.ActiveAeroZonesPartial, s.NumActiveAeroZonesPartial, ToZone),
            DrsZones = Take<TrackZone, Zone>(s.DrsZones, s.NumDrsZones, ToZone),
            Sector2Start = s.Sector2LapDistanceStart,
            Sector3Start = s.Sector3LapDistanceStart,
            PitWindowIdeal = s.PitStopWindowIdealLap,
            PitWindowLatest = s.PitStopWindowLatestLap,
            RejoinPosition = s.PitStopRejoinPosition,
            Forecast = [.. Take<WeatherForecastSample, WeatherForecastSample>(s.WeatherForecastSamples, s.NumWeatherForecastSamples, f => f)
                .Where(f => f.SessionType == s.SessionType)
                .Take(6)
                .Select(f => new ForecastInfo(f.TimeOffset, f.Weather, f.RainPercentage, f.TrackTemperature))],
        };

        static Zone ToZone(TrackZone z) => new(z.ZoneStart, z.ZoneEnd);
    }

    /// <summary>The first <paramref name="count"/> entries of a fixed array, mapped.</summary>
    private static List<TOut> Take<TIn, TOut>(ReadOnlySpan<TIn> items, int count, Func<TIn, TOut> map)
    {
        var result = new List<TOut>(Math.Min(count, items.Length));
        foreach (var item in items[..Math.Min(count, items.Length)]) result.Add(map(item));
        return result;
    }

    private List<CarRow> BuildCarRows()
    {
        if (_lap is not { } laps) return [];
        var playerIdx = _header?.PlayerCarIndex ?? 0;
        var rows = new List<CarRow>(PacketFormat.MaxCars);

        for (var i = 0; i < PacketFormat.MaxCars; i++)
        {
            ref readonly var l = ref laps.Cars[i];
            // resultStatus 0 = invalid, 1 = inactive
            if (l.ResultStatus < 2 || l.CarPosition == 0) continue;

            var participant = _participants?.Cars[i];
            var status = _status?.Cars[i];
            var motion = _motion?.Cars[i];
            var tel2 = _telemetry2?.Cars[i];
            var tel = _telemetry?.Cars[i];
            var damage = _damage?.Cars[i];

            rows.Add(new CarRow
            {
                Idx = i,
                Position = l.CarPosition,
                Name = DriverName(i),
                RaceNumber = participant?.RaceNumber ?? 0,
                TeamId = participant?.TeamId ?? -1,
                IsPlayer = i == playerIdx,
                Lap = l.CurrentLapNum,
                LapDistance = l.LapDistance,
                Sector = l.Sector,
                LastLapMs = l.LastLapTimeInMs,
                BestLapMs = _bestLapMs[i],
                CurrentLapMs = l.CurrentLapTimeInMs,
                CurrentLapInvalid = l.CurrentLapInvalid,
                GapToLeaderMs = l.DeltaToRaceLeaderMs,
                IntervalMs = l.DeltaToCarInFrontMs,
                PitStatus = l.PitStatus,
                NumPitStops = l.NumPitStops,
                PenaltiesSec = l.Penalties,
                DriverStatus = l.DriverStatus,
                ResultStatus = l.ResultStatus,
                Compound = status?.VisualTyreCompound ?? 0,
                TyreAge = status?.TyresAgeLaps ?? 0,
                X = motion?.WorldPositionX ?? 0,
                Z = motion?.WorldPositionZ ?? 0,
                AeroMode = tel2?.ActiveAeroMode ?? 0,
                OvertakeActive = tel2?.OvertakeActive ?? false,
                ErsPct = status is { } st ? Math.Min(100, st.ErsStoreEnergy / ErsMaxJ * 100) : 0,
                Speed = tel?.Speed ?? 0,
                Throttle = tel?.Throttle ?? 0,
                Brake = tel?.Brake ?? 0,
                Gear = tel?.Gear ?? 0,
                ErsStoreJ = status?.ErsStoreEnergy ?? 0,
                ErsDeployMode = status?.ErsDeployMode ?? 0,
                FuelKg = status?.FuelInTank ?? 0,
                TyreWearAvg = damage is { } d ? Average(d.TyresWear) : 0,
            });
        }
        return [.. rows.OrderBy(r => r.Position)];
    }

    private static double Average(ReadOnlySpan<float> values)
    {
        double sum = 0;
        foreach (var v in values) sum += v;
        return sum / values.Length;
    }

    private PlayerDetail? BuildPlayerDetail()
    {
        if (_header is not { } header || header.PlayerCarIndex >= PacketFormat.MaxCars) return null;
        if (_telemetry is not { } telemetry) return null;

        var i = header.PlayerCarIndex;
        ref readonly var tel = ref telemetry.Cars[i];
        var st = _status?.Cars[i] ?? default;
        var dmg = _damage?.Cars[i] ?? default;
        var t2 = _telemetry2?.Cars[i] ?? default;
        var motion = _motion?.Cars[i];
        var l = _lap?.Cars[i] ?? default;

        return new PlayerDetail
        {
            Idx = i,
            Speed = tel.Speed,
            Throttle = tel.Throttle,
            Brake = tel.Brake,
            Steer = tel.Steer,
            Clutch = tel.Clutch,
            Gear = tel.Gear,
            SuggestedGear = telemetry.SuggestedGear,
            Rpm = tel.EngineRpm,
            MaxRpm = st.MaxRpm > 0 ? st.MaxRpm : DefaultMaxRpm,
            RevLightsPct = tel.RevLightsPercent,
            EngineTemp = tel.EngineTemperature,
            BrakesTemp = ToInts(tel.BrakesTemperature),
            TyresSurface = ToInts(tel.TyresSurfaceTemperature),
            TyresInner = ToInts(tel.TyresInnerTemperature),
            TyresPressure = ToDoubles(tel.TyresPressure),
            TyresWear = ToDoubles(dmg.TyresWear),
            TyresDamage = ToInts(dmg.TyresDamage),
            TyreBlisters = ToInts(dmg.TyreBlisters),
            BrakesDamage = ToInts(dmg.BrakesDamage),
            Damage = new DamageInfo
            {
                FrontLeftWing = dmg.FrontLeftWingDamage,
                FrontRightWing = dmg.FrontRightWingDamage,
                RearWing = dmg.RearWingDamage,
                Floor = dmg.FloorDamage,
                Diffuser = dmg.DiffuserDamage,
                Sidepod = dmg.SidepodDamage,
                Gearbox = dmg.GearBoxDamage,
                Engine = dmg.EngineDamage,
                Ice = dmg.EngineIceWear,
                Mguk = dmg.EngineMgukWear,
                Mguh = dmg.EngineMguhWear,
                Es = dmg.EngineEsWear,
                Ce = dmg.EngineCeWear,
                Tc = dmg.EngineTcWear,
            },
            FuelKg = st.FuelInTank,
            FuelLaps = st.FuelRemainingLaps,
            // Standard mix until the status packet says otherwise.
            FuelMix = _status is null ? 1 : st.FuelMix,
            BrakeBias = st.FrontBrakeBias,
            ErsStoreJ = st.ErsStoreEnergy,
            ErsDeployMode = st.ErsDeployMode,
            ErsDeployedLapJ = st.ErsDeployedThisLap,
            ErsHarvestedLapJ = st.ErsHarvestedThisLapMguk + st.ErsHarvestedThisLapMguh,
            PowerIceW = st.EnginePowerIce,
            PowerMgukW = st.EnginePowerMguk,
            PitLimiter = st.PitLimiterStatus,
            Compound = st.ActualTyreCompound,
            VisualCompound = st.VisualTyreCompound,
            TyreAge = st.TyresAgeLaps,
            AeroMode = t2.ActiveAeroMode,
            AeroAvailable = t2.ActiveAeroAvailable,
            AeroActivationDistance = t2.ActiveAeroActivationDistance,
            OvertakeAvailable = t2.OvertakeAvailable,
            OvertakeActive = t2.OvertakeActive,
            OvertakeActivationDistance = t2.OvertakeActivationDistance,
            Regs2026 = t2.Regulations2026Applicable,
            GLat = motion is { } m ? m.GForceLateral / PacketFormat.GForceScale : 0,
            GLon = motion is { } m2 ? m2.GForceLongitudinal / PacketFormat.GForceScale : 0,
            LapDistance = l.LapDistance,
            CurrentLapMs = l.CurrentLapTimeInMs,
            Lap = l.CurrentLapNum,
            Sector1Ms = l.Sector1TimeMs,
            Sector2Ms = l.Sector2TimeMs,
            SpeedTrapKmh = l.SpeedTrapFastestSpeed,
        };
    }

    private static int[] ToInts(ReadOnlySpan<byte> values)
    {
        var result = new int[values.Length];
        for (var i = 0; i < values.Length; i++) result[i] = values[i];
        return result;
    }

    private static int[] ToInts(ReadOnlySpan<ushort> values)
    {
        var result = new int[values.Length];
        for (var i = 0; i < values.Length; i++) result[i] = values[i];
        return result;
    }

    private static double[] ToDoubles(ReadOnlySpan<float> values)
    {
        var result = new double[values.Length];
        for (var i = 0; i < values.Length; i++) result[i] = values[i];
        return result;
    }
}
