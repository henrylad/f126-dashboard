using System.Text.Json.Serialization;

namespace PitWall.Core.Laps;

/// <summary>One telemetry point along a lap.</summary>
/// <param name="D">Lap distance, metres.</param>
/// <param name="T">Lap time, ms.</param>
/// <param name="Ers">ERS store, J.</param>
/// <param name="Mode">ERS deploy mode (3 = Boost).</param>
/// <param name="Steer">−1 full left … +1 full right.</param>
/// <param name="SlipFront">Mean wheel slip ratio of the front axle in %; only the player's car has it.</param>
/// <param name="SlipRear">Same for the rear axle.</param>
public readonly record struct Sample(
    double D, double T, double Speed, double Throttle, double Brake, int Gear, double Ers, int Mode,
    double Steer = 0, int Rpm = 0, double GLat = 0, double GLon = 0, double? SlipFront = null, double? SlipRear = null);

public enum MiniColour
{
    /// <summary>Out/in-lap, pits or invalid lap.</summary>
    NotCounted = 0,
    SlowerThanBest = 1,
    PersonalBest = 2,
    FastestOverall = 3,
}

public readonly record struct MiniSector(double Ms, MiniColour Colour);

/// <summary><see cref="Timed"/> = clean lap from line to line; the rest are shown but never used as a reference.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<LapKind>))]
public enum LapKind
{
    [JsonStringEnumMemberName("timed")] Timed,
    [JsonStringEnumMemberName("invalid")] Invalid,
    [JsonStringEnumMemberName("out")] Out,
    [JsonStringEnumMemberName("in")] In,
    [JsonStringEnumMemberName("pit")] Pit,
    [JsonStringEnumMemberName("partial")] Partial,
}

public sealed record LapStats
{
    public double TopSpeed { get; init; }
    public double? AvgSpeed { get; init; }
    public double FullThrottlePct { get; init; }
    public double BrakingPct { get; init; }
    public double DeployedJ { get; init; }
    public double HarvestedJ { get; init; }
    public double BoostPct { get; init; }
    public double ErsStartJ { get; init; }
    public double ErsEndJ { get; init; }
    public double? FuelUsedKg { get; init; }
    public double? WearDeltaPct { get; init; }
    public int Compound { get; init; }
    public int TyreAge { get; init; }
    public int GearChanges { get; init; }
}

/// <summary>A completed lap with its sectors, stats and a trimmed telemetry trace.</summary>
public sealed record Lap
{
    /// <summary>Unique in the session (lap numbers can repeat after the pits).</summary>
    public required int Id { get; init; }
    public required int CarIdx { get; init; }
    /// <summary>Lap number as the game counts it.</summary>
    [JsonPropertyName("lap")]
    public required int Number { get; init; }
    public required LapKind Kind { get; init; }
    public required double TimeMs { get; init; }
    /// <summary>Always three entries; null where the sector was not observed.</summary>
    public required IReadOnlyList<double?> Sectors { get; init; }
    public required IReadOnlyList<Sample> Samples { get; init; }
    public required IReadOnlyList<MiniSector?> Minis { get; init; }
    public required LapStats Stats { get; init; }
    /// <summary>Set on laps loaded from an earlier session; null for this session's laps.</summary>
    public SavedLapInfo? Saved { get; init; }
}

/// <summary>Where a lap from an earlier session came from.</summary>
public sealed record SavedLapInfo(DateTimeOffset SavedAt, int SessionType);
