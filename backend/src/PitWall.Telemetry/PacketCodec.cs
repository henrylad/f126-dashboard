using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using PitWall.Telemetry.Packets;

namespace PitWall.Telemetry;

public enum DecodeStatus
{
    Ok,
    /// <summary>Shorter than its header or than the layout for its packet id.</summary>
    TooShort,
    /// <summary>Not <see cref="PacketFormat.Version"/>, e.g. the game is set to the 2025 format.</summary>
    WrongFormat,
    /// <summary>A valid packet this library has no layout for (setups, lobby, ...).</summary>
    Unhandled,
}

/// <param name="Packet">The decoded packet when <paramref name="Status"/> is <see cref="DecodeStatus.Ok"/>.</param>
public readonly record struct DecodeResult(DecodeStatus Status, PacketHeader Header, IPacket? Packet);

/// <summary>
/// Reads and writes whole packets. The packet structs match the wire layout byte
/// for byte, so a packet is a single little-endian memory copy either way.
/// </summary>
public static class PacketCodec
{
    public static readonly int HeaderSize = Unsafe.SizeOf<PacketHeader>();

    static PacketCodec()
    {
        if (!BitConverter.IsLittleEndian)
            throw new PlatformNotSupportedException("The F1 telemetry format is little-endian; big-endian hosts are not supported.");
    }

    public static DecodeResult Decode(ReadOnlySpan<byte> data)
    {
        if (data.Length < HeaderSize) return new(DecodeStatus.TooShort, default, null);

        var header = MemoryMarshal.Read<PacketHeader>(data);
        if (header.PacketFormat != PacketFormat.Version) return new(DecodeStatus.WrongFormat, header, null);

        return header.PacketId switch
        {
            PacketId.Motion => Read<MotionPacket>(data, header),
            PacketId.Session => Read<SessionPacket>(data, header),
            PacketId.LapData => Read<LapDataPacket>(data, header),
            PacketId.Event => Read<EventPacket>(data, header),
            PacketId.Participants => Read<ParticipantsPacket>(data, header),
            PacketId.CarTelemetry => Read<CarTelemetryPacket>(data, header),
            PacketId.CarStatus => Read<CarStatusPacket>(data, header),
            PacketId.CarDamage => Read<CarDamagePacket>(data, header),
            PacketId.SessionHistory => Read<SessionHistoryPacket>(data, header),
            PacketId.LapPositions => Read<LapPositionsPacket>(data, header),
            PacketId.CarTelemetry2 => Read<CarTelemetry2Packet>(data, header),
            _ => new(DecodeStatus.Unhandled, header, null),
        };
    }

    public static byte[] Encode<T>(in T packet) where T : unmanaged, IPacket =>
        MemoryMarshal.AsBytes(new ReadOnlySpan<T>(in packet)).ToArray();

    public static int SizeOf<T>() where T : unmanaged, IPacket => Unsafe.SizeOf<T>();

    private static DecodeResult Read<T>(ReadOnlySpan<byte> data, PacketHeader header) where T : unmanaged, IPacket =>
        data.Length < Unsafe.SizeOf<T>()
            ? new(DecodeStatus.TooShort, header, null)
            : new(DecodeStatus.Ok, header, MemoryMarshal.Read<T>(data));
}
