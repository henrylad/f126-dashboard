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
    public bool DrsFault { get; init; }
    public bool ErsFault { get; init; }
    public bool EngineBlown { get; init; }
    public bool EngineSeized { get; init; }
}

/// <summary>The player's lap-data row: position, timing, warnings, penalties and pits.</summary>
public sealed record LapInfo
{
    public int Position { get; init; }
    public int GridPosition { get; init; }
    public long LastLapMs { get; init; }
    /// <summary>0, 1 or 2.</summary>
    public int Sector { get; init; }
    public bool CurrentLapInvalid { get; init; }
    public double TotalDistance { get; init; }
    public int GapAheadMs { get; init; }
    public int GapLeaderMs { get; init; }
    public double SafetyCarDelta { get; init; }
    public int PenaltiesSec { get; init; }
    public int TotalWarnings { get; init; }
    public int CornerCuttingWarnings { get; init; }
    public int UnservedDriveThroughs { get; init; }
    public int UnservedStopGos { get; init; }
    /// <summary>0 none, 1 pitting, 2 in the pit area.</summary>
    public int PitStatus { get; init; }
    public int NumPitStops { get; init; }
    public bool PitLaneTimerActive { get; init; }
    public int PitLaneTimeMs { get; init; }
    public int PitStopTimerMs { get; init; }
    public bool ServePenaltyAtStop { get; init; }
    public int DriverStatus { get; init; }
    public int ResultStatus { get; init; }
    /// <summary>Lap of the fastest speed-trap pass; 255 when none yet.</summary>
    public int SpeedTrapLap { get; init; }
}

/// <summary>Extended motion of the player's car (packet 13). Per-wheel arrays are ordered RL, RR, FL, FR.</summary>
public sealed record ChassisInfo
{
    public IReadOnlyList<double> SuspensionPosition { get; init; } = [];
    public IReadOnlyList<double> SuspensionVelocity { get; init; } = [];
    public IReadOnlyList<double> SuspensionAcceleration { get; init; } = [];
    /// <summary>Metres per second.</summary>
    public IReadOnlyList<double> WheelSpeed { get; init; } = [];
    public IReadOnlyList<double> WheelSlipRatio { get; init; } = [];
    /// <summary>Radians.</summary>
    public IReadOnlyList<double> WheelSlipAngle { get; init; } = [];
    public IReadOnlyList<double> WheelLatForce { get; init; } = [];
    public IReadOnlyList<double> WheelLongForce { get; init; } = [];
    public IReadOnlyList<double> WheelVertForce { get; init; } = [];
    public IReadOnlyList<double> WheelCamber { get; init; } = [];
    public IReadOnlyList<double> WheelCamberGain { get; init; } = [];
    public double HeightOfCog { get; init; }
    /// <summary>Car frame: x right, y up, z forward; metres per second.</summary>
    public IReadOnlyList<double> LocalVelocity { get; init; } = [];
    public IReadOnlyList<double> AngularVelocity { get; init; } = [];
    public IReadOnlyList<double> AngularAcceleration { get; init; } = [];
    /// <summary>Radians.</summary>
    public double FrontWheelsAngle { get; init; }
    /// <summary>Metres.</summary>
    public double FrontAeroHeight { get; init; }
    public double RearAeroHeight { get; init; }
    public double FrontRollAngle { get; init; }
    public double RearRollAngle { get; init; }
    public double ChassisYaw { get; init; }
    public double ChassisPitch { get; init; }
}

/// <summary>The player's car setup (packet 5).</summary>
public sealed record SetupInfo
{
    public int FrontWing { get; init; }
    public int RearWing { get; init; }
    public int OnThrottle { get; init; }
    public int OffThrottle { get; init; }
    public double FrontCamber { get; init; }
    public double RearCamber { get; init; }
    public double FrontToe { get; init; }
    public double RearToe { get; init; }
    public int FrontSuspension { get; init; }
    public int RearSuspension { get; init; }
    public int FrontAntiRollBar { get; init; }
    public int RearAntiRollBar { get; init; }
    public int FrontRideHeight { get; init; }
    public int RearRideHeight { get; init; }
    public int BrakePressure { get; init; }
    public int BrakeBias { get; init; }
    public int EngineBraking { get; init; }
    /// <summary>PSI, ordered RL, RR, FL, FR.</summary>
    public IReadOnlyList<double> TyresPressure { get; init; } = [];
    public int Ballast { get; init; }
    public double FuelLoad { get; init; }
    public double NextFrontWing { get; init; }
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
    public int IdleRpm { get; init; }
    public int MaxGears { get; init; }
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
    /// <summary>Surface under each wheel (0 tarmac, 1 rumble strip, 7 grass, ...).</summary>
    public IReadOnlyList<int> SurfaceType { get; init; } = [];
    public DamageInfo Damage { get; init; } = new();
    public double FuelKg { get; init; }
    public double FuelCapacityKg { get; init; }
    public double FuelLaps { get; init; }
    public int FuelMix { get; init; }
    public int BrakeBias { get; init; }
    /// <summary>0 off, 1 medium, 2 full.</summary>
    public int TractionControl { get; init; }
    public bool Abs { get; init; }
    /// <summary>-1 invalid, 0 none, 1 green, 2 blue, 3 yellow.</summary>
    public int FiaFlag { get; init; }
    public bool Drs { get; init; }
    public bool DrsAllowed { get; init; }
    public int DrsActivationDistance { get; init; }
    public double ErsStoreJ { get; init; }
    public int ErsDeployMode { get; init; }
    public double ErsDeployedLapJ { get; init; }
    public double ErsHarvestedLapJ { get; init; }
    public double ErsHarvestedMgukLapJ { get; init; }
    public double ErsHarvestedMguhLapJ { get; init; }
    public double ErsHarvestLimitLapJ { get; init; }
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
    public bool WrongWay { get; init; }
    public double GLat { get; init; }
    public double GLon { get; init; }
    public double GVert { get; init; }
    /// <summary>Radians.</summary>
    public double Yaw { get; init; }
    public double Pitch { get; init; }
    public double Roll { get; init; }
    public double LapDistance { get; init; }
    public double CurrentLapMs { get; init; }
    public int Lap { get; init; }
    public int Sector1Ms { get; init; }
    public int Sector2Ms { get; init; }
    public double SpeedTrapKmh { get; init; }
    public LapInfo Race { get; init; } = new();
    /// <summary>Null until the game sends extended motion.</summary>
    public ChassisInfo? Chassis { get; init; }
    /// <summary>Null until the game sends car setups.</summary>
    public SetupInfo? Setup { get; init; }
    /// <summary>Null until the game sends the player's tyre sets.</summary>
    public TyreSetsInfo? TyreSets { get; init; }
}

/// <summary>The player's tyre sets for the weekend (packet 12).</summary>
public sealed record TyreSetsInfo(int FittedIdx, IReadOnlyList<TyreSetInfo> Sets);

/// <param name="LapDeltaMs">Lap time difference to the fitted set.</param>
/// <param name="LifeSpan">Laps left in the set.</param>
/// <param name="UsableLife">Recommended maximum laps for the compound.</param>
public sealed record TyreSetInfo(
    int ActualCompound, int VisualCompound, int Wear, bool Available, int RecommendedSession,
    int LifeSpan, int UsableLife, int LapDeltaMs, bool Fitted);

/// <param name="T">Session time in seconds.</param>
public sealed record FeedEvent(double T, string Code, string Text);
