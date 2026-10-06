using Microsoft.Extensions.Options;
using PitWall.Server.Configuration;
using PitWall.Server.Realtime;
using PitWall.Server.Recording;

namespace PitWall.Server.Ingestion;

/// <summary>Feeds packets from the configured source into the hub, recording them if asked to.</summary>
public sealed class PacketIngestionService(
    IPacketSource source,
    TelemetryHub hub,
    IOptions<PitWallOptions> options,
    TimeProvider time,
    ILogger<PacketIngestionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var recorder = options.Value.RecordPath is { Length: > 0 } path ? new PacketRecorder(path, time) : null;
        if (recorder is not null) logger.Recording(recorder.Path);

        try
        {
            await foreach (var packet in source.ReadPacketsAsync(stoppingToken))
            {
                hub.Ingest(packet);
                recorder?.Write(packet);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down.
        }
    }
}
