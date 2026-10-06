using System.Net.WebSockets;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace PitWall.Server.Tests;

/// <summary>Runs the real server with the simulator and reads the dashboard socket.</summary>
public sealed class DashboardSocketTests(DashboardSocketTests.SimServer server) : IClassFixture<DashboardSocketTests.SimServer>
{
    public sealed class SimServer : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder) =>
            builder.UseSetting("PitWall:Source", "Sim");
    }

    [Fact]
    public async Task Sends_the_history_then_live_ticks()
    {
        var ct = TestContext.Current.CancellationToken;
        using var socket = await server.Server.CreateWebSocketClient().ConnectAsync(new Uri(server.Server.BaseAddress, "/ws"), ct);

        using var history = await ReceiveAsync(socket, ct);
        Assert.Equal("history", history.RootElement.GetProperty("type").GetString());
        Assert.Equal(800, history.RootElement.GetProperty("laps").GetProperty("outline").GetArrayLength());

        // The simulator needs a few ticks before the session packet arrives; its
        // first appearance starts a new session, which resends the history.
        JsonDocument? tick = null;
        for (var i = 0; i < 60; i++)
        {
            tick?.Dispose();
            tick = await ReceiveAsync(socket, ct);
            if (tick.RootElement.TryGetProperty("snapshot", out var s) && s.GetProperty("session").ValueKind == JsonValueKind.Object) break;
        }
        using (tick)
        {
            var root = tick!.RootElement;
            Assert.Equal("tick", root.GetProperty("type").GetString());
            var snapshot = root.GetProperty("snapshot");
            Assert.Equal("sim", snapshot.GetProperty("source").GetString());
            Assert.Equal(22, snapshot.GetProperty("cars").GetArrayLength());
            Assert.Equal(JsonValueKind.Object, snapshot.GetProperty("player").ValueKind);
            var laps = root.GetProperty("laps");
            Assert.Equal(25, laps.GetProperty("minis").GetArrayLength());
            Assert.True(laps.GetProperty("current").TryGetProperty("from", out _));
        }
    }

    [Fact]
    public async Task Health_endpoint_reports_healthy()
    {
        using var client = server.CreateClient();
        var response = await client.GetStringAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);
        Assert.Equal("Healthy", response);
    }

    private static async Task<JsonDocument> ReceiveAsync(WebSocket socket, CancellationToken ct)
    {
        using var message = new MemoryStream();
        var buffer = new byte[64 * 1024];
        WebSocketReceiveResult result;
        do
        {
            result = await socket.ReceiveAsync(buffer, ct);
            message.Write(buffer, 0, result.Count);
        } while (!result.EndOfMessage);
        message.Position = 0;
        return await JsonDocument.ParseAsync(message, cancellationToken: ct);
    }
}
