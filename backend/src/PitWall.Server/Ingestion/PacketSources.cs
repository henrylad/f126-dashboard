using System.Net;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using Microsoft.Extensions.Options;
using PitWall.Server.Configuration;
using PitWall.Server.Recording;
using PitWall.Simulator;

namespace PitWall.Server.Ingestion;

/// <summary>A stream of raw telemetry packets.</summary>
public interface IPacketSource
{
    IAsyncEnumerable<byte[]> ReadPacketsAsync(CancellationToken ct);
}

/// <summary>Live packets from the game.</summary>
public sealed class UdpPacketSource(IOptions<PitWallOptions> options, ILogger<UdpPacketSource> logger) : IPacketSource
{
    /// <summary>Headroom for bursts (a 60 Hz game sends ~1 MB/s).</summary>
    private const int ReceiveBufferBytes = 4 * 1024 * 1024;

    public async IAsyncEnumerable<byte[]> ReadPacketsAsync([EnumeratorCancellation] CancellationToken ct)
    {
        var endpoint = new IPEndPoint(IPAddress.Parse(options.Value.UdpHost), options.Value.UdpPort);
        using var udp = new UdpClient(AddressFamily.InterNetwork);
        udp.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        udp.Client.ReceiveBufferSize = ReceiveBufferBytes;
        udp.Client.Bind(endpoint);
        logger.ListeningForTelemetry(endpoint);

        while (!ct.IsCancellationRequested)
        {
            var result = await udp.ReceiveAsync(ct);
            yield return result.Buffer;
        }
    }
}

/// <summary>Packets from the built-in race simulator, in real time.</summary>
public sealed class SimulatorPacketSource(TimeProvider time, ILogger<SimulatorPacketSource> logger) : IPacketSource
{
    public async IAsyncEnumerable<byte[]> ReadPacketsAsync([EnumeratorCancellation] CancellationToken ct)
    {
        var sim = new RaceSimulator();
        logger.SimulatorRunning();
        foreach (var packet in sim.Start()) yield return packet;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1.0 / RaceSimulator.TickHz), time);
        while (await timer.WaitForNextTickAsync(ct))
        {
            foreach (var packet in sim.Tick()) yield return packet;
        }
    }
}

/// <summary>Packets from a recording, at their original pace, looping forever.</summary>
public sealed class ReplayPacketSource(IOptions<PitWallOptions> options, TimeProvider time, ILogger<ReplayPacketSource> logger) : IPacketSource
{
    public async IAsyncEnumerable<byte[]> ReadPacketsAsync([EnumeratorCancellation] CancellationToken ct)
    {
        var path = options.Value.ReplayPath!;
        var packets = await RecordingFile.ReadAllAsync(path, ct);
        if (packets.Count == 0) throw new InvalidDataException($"No packets in {path}");
        logger.Replaying(packets.Count, path);

        while (!ct.IsCancellationRequested)
        {
            var start = time.GetTimestamp();
            foreach (var packet in packets)
            {
                var wait = TimeSpan.FromMilliseconds(packet.AtMs) - time.GetElapsedTime(start);
                if (wait > TimeSpan.Zero) await Task.Delay(wait, time, ct);
                yield return packet.Data;
            }
        }
    }
}
