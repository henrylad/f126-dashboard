using System.Text.Json.Serialization;

namespace PitWall.Core.Live;

// What the server broadcasts to the dashboard ~30 times a second. Property names
// are serialised camelCase and must match frontend/src/api/types.ts.

[JsonConverter(typeof(JsonStringEnumConverter<TelemetrySource>))]
public enum TelemetrySource
{
    [JsonStringEnumMemberName("udp")] Udp,
    [JsonStringEnumMemberName("sim")] Sim,
    [JsonStringEnumMemberName("replay")] Replay,
}

public sealed record Snapshot
{
    public TelemetrySource Source { get; init; }
    public long? LastPacketAgoMs { get; init; }
    public int PacketsPerSec { get; init; }
    /// <summary>The packet format the game is sending when it is not 2026.</summary>
    public int? WrongFormat { get; init; }
    public string GameVersion { get; init; } = "";
    public double SessionTime { get; init; }
    public SessionInfo? Session { get; init; }
    public IReadOnlyList<CarRow> Cars { get; init; } = [];
    public PlayerDetail? Player { get; init; }
    public IReadOnlyList<FeedEvent> Events { get; init; } = [];
}

/// <summary>Part of a lap, as fractions (0..1) of the lap.</summary>
public sealed record Zone(double Start, double End);

public sealed record MarshalZoneInfo(double Start, int Flag);

public sealed record ForecastInfo(int Offset, int Weather, int Rain, int TrackTemp);

public sealed record SessionInfo
{
    public string Uid { get; init; } = "";
    public int TrackId { get; init; }
    public int TrackLength { get; init; }
    public int TotalLaps { get; init; }
    public int SessionType { get; init; }
    public int TimeLeft { get; init; }
    public int Weather { get; init; }
    public int TrackTemp { get; init; }
    public int AirTemp { get; init; }
    public int SafetyCar { get; init; }
    public int PitSpeedLimit { get; init; }
    public IReadOnlyList<MarshalZoneInfo> MarshalZones { get; init; } = [];
    public IReadOnlyList<Zone> AeroZonesFull { get; init; } = [];
    public IReadOnlyList<Zone> AeroZonesPartial { get; init; } = [];
    public IReadOnlyList<Zone> DrsZones { get; init; } = [];
    public double Sector2Start { get; init; }
    public double Sector3Start { get; init; }
    public int PitWindowIdeal { get; init; }
    public int PitWindowLatest { get; init; }
    public int RejoinPosition { get; init; }
    public IReadOnlyList<ForecastInfo> Forecast { get; init; } = [];
}

/// <summary>One car in the timing tower, plus the telemetry used to record its laps.</summary>
public sealed record CarRow
{
    public int Idx { get; init; }
    public int Position { get; init; }
    public string Name { get; init; } = "";
    public int RaceNumber { get; init; }
    /// <summary>-1 when the participants packet has not arrived yet.</summary>
    public int TeamId { get; init; } = -1;
    public bool IsPlayer { get; init; }
    public int Lap { get; init; }
    public double LapDistance { get; init; }
    public int Sector { get; init; }
    public long LastLapMs { get; init; }
    public long BestLapMs { get; init; }
    public double CurrentLapMs { get; init; }
    public bool CurrentLapInvalid { get; init; }
    public int GapToLeaderMs { get; init; }
    public int IntervalMs { get; init; }
    public int PitStatus { get; init; }
    public int NumPitStops { get; init; }
    public int PenaltiesSec { get; init; }
    public int DriverStatus { get; init; }
    public int ResultStatus { get; init; }
    public int Compound { get; init; }
    public int TyreAge { get; init; }
    public double X { get; init; }
    public double Z { get; init; }
    public int AeroMode { get; init; }
    public bool OvertakeActive { get; init; }
    public double ErsPct { get; init; }
    // Zero for online players whose telemetry is restricted.
    public double Speed { get; init; }
    public double Throttle { get; init; }
    public double Brake { get; init; }
    public int Gear { get; init; }
    public double ErsStoreJ { get; init; }
    public int ErsDeployMode { get; init; }
    public double FuelKg { get; init; }
    public double TyreWearAvg { get; init; }
}

/// <summary>Wear and damage percentages of the player's car.</summary>
public sealed record DamageInfo
{
    public int FrontLeftWing { get; init; }
    public int FrontRightWing { get; init; }
    public int RearWing { get; init; }
    public int Floor { get; init; }
    public int Diffuser { get; init; }
    public int Sidepod { get; init; }
    public int Gearbox { get; init; }
    public int Engine { get; init; }
    public int Ice { get; init; }
    public int Mguk { get; init; }
    public int Mguh { get; init; }
    public int Es { get; init; }
    public int Ce { get; init; }
    public int Tc { get; init; }
}

/// <summary>Everything about the player's car. Per-wheel arrays are ordered RL, RR, FL, FR.</summary>
public sealed record PlayerDetail
{
    public int Idx { get; init; }
    public int Speed { get; init; }
    public double Throttle { get; init; }
    public double Brake { get; init; }
    public double Steer { get; init; }
    public int Clutch { get; init; }
    public int Gear { get; init; }
    public int SuggestedGear { get; init; }
    public int Rpm { get; init; }
    public int MaxRpm { get; init; }
    public int RevLightsPct { get; init; }
    public int EngineTemp { get; init; }
    public IReadOnlyList<int> BrakesTemp { get; init; } = [];
    public IReadOnlyList<int> TyresSurface { get; init; } = [];
    public IReadOnlyList<int> TyresInner { get; init; } = [];
    public IReadOnlyList<double> TyresPressure { get; init; } = [];
    public IReadOnlyList<double> TyresWear { get; init; } = [];
    public IReadOnlyList<int> TyresDamage { get; init; } = [];
    public IReadOnlyList<int> TyreBlisters { get; init; } = [];
    public IReadOnlyList<int> BrakesDamage { get; init; } = [];
    public DamageInfo Damage { get; init; } = new();
    public double FuelKg { get; init; }
    public double FuelLaps { get; init; }
    public int FuelMix { get; init; }
    public int BrakeBias { get; init; }
    public double ErsStoreJ { get; init; }
    public int ErsDeployMode { get; init; }
    public double ErsDeployedLapJ { get; init; }
    public double ErsHarvestedLapJ { get; init; }
    public double PowerIceW { get; init; }
    public double PowerMgukW { get; init; }
    public bool PitLimiter { get; init; }
    public int Compound { get; init; }
    public int VisualCompound { get; init; }
    public int TyreAge { get; init; }
    public int AeroMode { get; init; }
    public bool AeroAvailable { get; init; }
    public int AeroActivationDistance { get; init; }
    public bool OvertakeAvailable { get; init; }
    public bool OvertakeActive { get; init; }
    public int OvertakeActivationDistance { get; init; }
    public bool Regs2026 { get; init; }
    public double GLat { get; init; }
    public double GLon { get; init; }
    public double LapDistance { get; init; }
    public double CurrentLapMs { get; init; }
    public int Lap { get; init; }
    public int Sector1Ms { get; init; }
    public int Sector2Ms { get; init; }
    public double SpeedTrapKmh { get; init; }
}

/// <param name="T">Session time in seconds.</param>
public sealed record FeedEvent(double T, string Code, string Text);
