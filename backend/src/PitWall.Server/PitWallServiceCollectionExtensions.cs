using Microsoft.Extensions.Options;
using PitWall.Core.Live;
using PitWall.Server.Configuration;
using PitWall.Server.Ingestion;
using PitWall.Server.Realtime;
using PitWall.Server.Storage;

namespace PitWall.Server;

public static class PitWallServiceCollectionExtensions
{
    public static IServiceCollection AddPitWall(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<PitWallOptions>()
            .Bind(configuration.GetSection(PitWallOptions.Section))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<LapLibrary>();
        services.AddSingleton<TelemetryHub>();
        services.AddSingleton<IPacketSource>(sp => sp.GetRequiredService<IOptions<PitWallOptions>>().Value.Source switch
        {
            TelemetrySource.Sim => ActivatorUtilities.CreateInstance<SimulatorPacketSource>(sp),
            TelemetrySource.Replay => ActivatorUtilities.CreateInstance<ReplayPacketSource>(sp),
            _ => ActivatorUtilities.CreateInstance<UdpPacketSource>(sp),
        });
        services.AddHostedService<PacketIngestionService>();
        services.AddHostedService<BroadcastService>();
        services.AddHealthChecks();
        return services;
    }

    /// <summary>The dashboard WebSocket: a history message, then a tick message per broadcast.</summary>
    public static IEndpointConventionBuilder MapDashboardSocket(this IEndpointRouteBuilder endpoints, string pattern) =>
        endpoints.Map(pattern, async (HttpContext context, TelemetryHub hub, IHostApplicationLifetime lifetime) =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            var client = hub.Connect();
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted, lifetime.ApplicationStopping);
                await client.RunAsync(socket, cts.Token);
            }
            finally
            {
                hub.Disconnect(client);
            }
        });
}
