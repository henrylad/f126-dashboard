using System.Text.Json;
using System.Text.Json.Serialization;
using PitWall.Core.Laps;
using PitWall.Core.Live;

namespace PitWall.Server.Realtime;

// Messages sent over the dashboard WebSocket; mirrored in frontend/src/api/types.ts.

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(HistoryMessage), "history")]
[JsonDerivedType(typeof(TickMessage), "tick")]
public abstract record ServerMessage;

/// <summary>Full lap history: sent on connect and whenever a new session starts.</summary>
public sealed record HistoryMessage(LapHistory Laps) : ServerMessage;

/// <summary>The live snapshot plus what changed in the lap history, ~30 times a second.</summary>
public sealed record TickMessage(Snapshot Snapshot, LapDelta Laps) : ServerMessage;

[JsonSourceGenerationOptions(JsonSerializerDefaults.Web, NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals)]
[JsonSerializable(typeof(ServerMessage))]
internal sealed partial class ServerMessageJsonContext : JsonSerializerContext
{
    public static byte[] Serialize(ServerMessage message) => JsonSerializer.SerializeToUtf8Bytes(message, Default.ServerMessage);
}
