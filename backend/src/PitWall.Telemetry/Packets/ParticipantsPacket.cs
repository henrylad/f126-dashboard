using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct ParticipantsPacket : IPacket
{
    public PacketHeader Header;
    public byte NumActiveCars;
    public CarArray<ParticipantData> Cars;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct ParticipantData
{
    public bool AiControlled;
    public ushort DriverId;
    public ushort NetworkId;
    public ushort TeamId;
    public bool MyTeam;
    public byte RaceNumber;
    public byte Nationality;
    public Utf8String32 Name;
    public bool YourTelemetry;
    public bool ShowOnlineNames;
    public ushort TechLevel;
    public byte Platform;
    public byte NumColours;
    public FixedArray4<LiveryColour> LiveryColours;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct LiveryColour
{
    public byte Red;
    public byte Green;
    public byte Blue;
}
