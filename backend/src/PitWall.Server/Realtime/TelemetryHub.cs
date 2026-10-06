using Microsoft.Extensions.Options;
using PitWall.Core.Laps;
using PitWall.Core.Live;
using PitWall.Server.Configuration;

namespace PitWall.Server.Realtime;

/// <summary>
/// Owns the live session state and the connected dashboards. Packets arrive on the
/// ingestion thread and ticks on the broadcast timer, so every access goes through
/// one lock. Messages are queued to clients under the same lock, which keeps each
/// client's history and deltas in order.
/// </summary>
public sealed class TelemetryHub(IOptions<PitWallOptions> options, TimeProvider time, ILogger<TelemetryHub> logger)
{
    private readonly Lock _gate = new();
    private readonly TelemetryAggregator _aggregator = new(options.Value.Source, time);
    private readonly LapTracker _laps = new();
    private readonly List<DashboardClient> _clients = [];
    private int _sentGeneration;

    public void Ingest(ReadOnlySpan<byte> packet)
    {
        lock (_gate) _aggregator.Ingest(packet);
    }

    /// <summary>Takes a snapshot, updates the lap history and sends both to every dashboard.</summary>
    public void Tick()
    {
        lock (_gate)
        {
            var snapshot = _aggregator.Snapshot();
            _laps.Update(snapshot);
            if (_laps.Generation != _sentGeneration)
            {
                // New session: everyone starts over from a fresh history.
                _sentGeneration = _laps.Generation;
                if (_clients.Count > 0) Broadcast(new HistoryMessage(_laps.History()));
            }
            // Always taken, so pending changes don't pile up while nobody is watching.
            var delta = _laps.TakeDelta();
            if (_clients.Count > 0) Broadcast(new TickMessage(snapshot, delta));
        }
    }

    public DashboardClient Connect()
    {
        var client = new DashboardClient();
        int open;
        lock (_gate)
        {
            client.TrySend(ServerMessageJsonContext.Serialize(new HistoryMessage(_laps.History())));
            _clients.Add(client);
            open = _clients.Count;
        }
        logger.DashboardConnected(open);
        return client;
    }

    public void Disconnect(DashboardClient client)
    {
        int open;
        lock (_gate)
        {
            _clients.Remove(client);
            open = _clients.Count;
        }
        logger.DashboardDisconnected(open);
    }

    private void Broadcast(ServerMessage message)
    {
        var bytes = ServerMessageJsonContext.Serialize(message);
        foreach (var client in _clients)
        {
            // A client that can't keep up is closed; it reconnects and gets a fresh history.
            if (!client.TrySend(bytes)) logger.DashboardTooSlow();
        }
    }
}
