using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

/// <summary>Lap and tyre-stint history of one car; the game cycles through the cars.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SessionHistoryPacket : IPacket
{
    public PacketHeader Header;
    public byte CarIdx;
    public byte NumLaps;
    public byte NumTyreStints;
    public byte BestLapTimeLapNum;
    public byte BestSector1LapNum;
    public byte BestSector2LapNum;
    public byte BestSector3LapNum;
    public FixedArray100<LapHistoryData> Laps;
    public FixedArray8<TyreStintHistoryData> TyreStints;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct LapHistoryData
{
    public uint LapTimeInMs;
    public ushort Sector1TimeMsPart;
    public byte Sector1TimeMinutesPart;
    public ushort Sector2TimeMsPart;
    public byte Sector2TimeMinutesPart;
    public ushort Sector3TimeMsPart;
    public byte Sector3TimeMinutesPart;
    /// <summary>0x01 lap, 0x02 S1, 0x04 S2, 0x08 S3 valid.</summary>
    public byte LapValidBitFlags;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct TyreStintHistoryData
{
    public byte EndLap;
    public byte TyreActualCompound;
    public byte TyreVisualCompound;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct LapPositionsPacket : IPacket
{
    public PacketHeader Header;
    public byte NumLaps;
    public byte LapStart;
    public FixedArray50<CarArray<byte>> PositionForVehicleIdx;

    readonly PacketHeader IPacket.Header => Header;
}
