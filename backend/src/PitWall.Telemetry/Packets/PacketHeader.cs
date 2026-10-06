using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

// Packet structs mirror the wire layout field for field: little-endian, packed with
// no padding. They are mutable on purpose so the simulator can fill them in.

/// <summary>Implemented by every packet; each starts with the 29-byte header.</summary>
public interface IPacket
{
    PacketHeader Header { get; }
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct PacketHeader
{
    public ushort PacketFormat;
    public byte GameYear;
    public byte GameMajorVersion;
    public byte GameMinorVersion;
    public byte PacketVersion;
    public PacketId PacketId;
    public ulong SessionUid;
    public float SessionTime;
    public uint FrameIdentifier;
    public uint OverallFrameIdentifier;
    public byte PlayerCarIndex;
    public byte SecondaryPlayerCarIndex;
}
