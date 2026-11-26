using System.Net;

namespace PitWall.Server;

/// <summary>Source-generated log messages.</summary>
internal static partial class Log
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Listening for F1 telemetry on UDP {Endpoint}")]
    public static partial void ListeningForTelemetry(this ILogger logger, IPEndPoint endpoint);

    [LoggerMessage(Level = LogLevel.Information, Message = "Simulator running (packetFormat 2026)")]
    public static partial void SimulatorRunning(this ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Replaying {Count} packets from {Path}")]
    public static partial void Replaying(this ILogger logger, int count, string path);

    [LoggerMessage(Level = LogLevel.Information, Message = "Recording raw packets to {Path}")]
    public static partial void Recording(this ILogger logger, string path);

    [LoggerMessage(Level = LogLevel.Information, Message = "Dashboard connected ({Count} open)")]
    public static partial void DashboardConnected(this ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Information, Message = "Dashboard disconnected ({Count} open)")]
    public static partial void DashboardDisconnected(this ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Dashboard too slow to keep up, closing its connection")]
    public static partial void DashboardTooSlow(this ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Keeping your timed laps in {Path}")]
    public static partial void LapLibraryOpen(this ILogger logger, string path);

    [LoggerMessage(Level = LogLevel.Information, Message = "Loaded {Count} laps from earlier sessions on track {TrackId}")]
    public static partial void SavedLapsLoaded(this ILogger logger, int count, int trackId);

    [LoggerMessage(Level = LogLevel.Error, Message = "Lap library failed; laps from this session won't be kept")]
    public static partial void LapLibraryFailed(this ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Error, Message = "Broadcast tick failed")]
    public static partial void TickFailed(this ILogger logger, Exception exception);
}
