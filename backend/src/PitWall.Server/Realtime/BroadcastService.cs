using Microsoft.Extensions.Options;
using PitWall.Server.Configuration;

namespace PitWall.Server.Realtime;

/// <summary>Ticks the hub at the broadcast rate.</summary>
public sealed class BroadcastService(
    TelemetryHub hub,
    IOptions<PitWallOptions> options,
    TimeProvider time,
    ILogger<BroadcastService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1.0 / options.Value.BroadcastHz), time);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    hub.Tick();
                }
#pragma warning disable CA1031 // One bad tick (e.g. odd packet data) must not stop the dashboard.
                catch (Exception e)
#pragma warning restore CA1031
                {
                    logger.TickFailed(e);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down.
        }
    }
}
