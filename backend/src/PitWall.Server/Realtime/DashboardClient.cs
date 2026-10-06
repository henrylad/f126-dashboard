using System.Net.WebSockets;
using System.Threading.Channels;

namespace PitWall.Server.Realtime;

/// <summary>One connected dashboard: a bounded outbox drained into its WebSocket.</summary>
public sealed class DashboardClient
{
    /// <summary>About three seconds of ticks.</summary>
    private const int OutboxCapacity = 90;

    private readonly Channel<byte[]> _outbox = Channel.CreateBounded<byte[]>(
        new BoundedChannelOptions(OutboxCapacity) { SingleReader = true, FullMode = BoundedChannelFullMode.Wait });

    /// <summary>
    /// Queues a message without blocking. When the outbox is full the client is
    /// closed instead: dropping a delta would leave it with a wrong history.
    /// </summary>
    public bool TrySend(byte[] message)
    {
        if (_outbox.Writer.TryWrite(message)) return true;
        _outbox.Writer.TryComplete();
        return false;
    }

    /// <summary>Sends queued messages until the socket closes, the outbox is closed or <paramref name="ct"/> fires.</summary>
    public async Task RunAsync(WebSocket socket, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var receiving = DrainIncomingAsync(socket, cts);
        try
        {
            await foreach (var message in _outbox.Reader.ReadAllAsync(cts.Token))
                await socket.SendAsync(message, WebSocketMessageType.Text, endOfMessage: true, cts.Token);
        }
        catch (OperationCanceledException)
        {
            // Closed by the browser or the server shutting down.
        }
        catch (Exception e) when (e is WebSocketException or IOException)
        {
            // Connection dropped.
        }
        finally
        {
            await cts.CancelAsync();
            await receiving;
            _outbox.Writer.TryComplete();
        }

        try
        {
            if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        }
        catch (Exception e) when (e is WebSocketException or IOException or ObjectDisposedException)
        {
            // Already gone.
        }
    }

    /// <summary>Dashboards never send anything; reading only notices when they close.</summary>
    private static async Task DrainIncomingAsync(WebSocket socket, CancellationTokenSource cts)
    {
        var buffer = new byte[1024];
        try
        {
            while (!cts.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, cts.Token);
                if (result.MessageType == WebSocketMessageType.Close) break;
            }
        }
        catch (Exception e) when (e is OperationCanceledException or WebSocketException or IOException)
        {
            // Closed either way.
        }
        await cts.CancelAsync();
    }
}
