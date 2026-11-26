using System.ComponentModel.DataAnnotations;
using PitWall.Core.Live;
using PitWall.Telemetry;

namespace PitWall.Server.Configuration;

public sealed class PitWallOptions : IValidatableObject
{
    public const string Section = "PitWall";

    /// <summary>Where packets come from: the game over UDP, the simulator, or a recording.</summary>
    public TelemetrySource Source { get; set; } = TelemetrySource.Udp;

    public string UdpHost { get; set; } = "0.0.0.0";

    [Range(1, 65535)]
    public int UdpPort { get; set; } = PacketFormat.DefaultPort;

    /// <summary>Recording to play back when <see cref="Source"/> is Replay.</summary>
    public string? ReplayPath { get; set; }

    /// <summary>When set, every received packet is also saved here.</summary>
    public string? RecordPath { get; set; }

    /// <summary>SQLite file that keeps your timed laps across sessions.</summary>
    public string DataPath { get; set; } = "data/pitwall.db";

    /// <summary>
    /// Whether to keep your timed laps. Defaults to on for the game and replays, and
    /// off for the simulator so its laps never mix with real ones.
    /// </summary>
    public bool? SaveLaps { get; set; }

    public bool SavesLaps => SaveLaps ?? Source != TelemetrySource.Sim;

    /// <summary>How often dashboards get a snapshot.</summary>
    [Range(1, 120)]
    public int BroadcastHz { get; set; } = 30;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Source == TelemetrySource.Replay && string.IsNullOrWhiteSpace(ReplayPath))
            yield return new ValidationResult("Replay needs a recording: pass --replay <file>.", [nameof(ReplayPath)]);
        if (Source == TelemetrySource.Replay && !string.IsNullOrWhiteSpace(ReplayPath) && !File.Exists(ReplayPath))
            yield return new ValidationResult($"Recording not found: {ReplayPath}", [nameof(ReplayPath)]);
    }
}
