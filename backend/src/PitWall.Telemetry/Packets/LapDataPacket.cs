using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct LapDataPacket : IPacket
{
    public PacketHeader Header;
    public CarArray<LapData> Cars;
    public byte TimeTrialPbCarIdx;
    public byte TimeTrialRivalCarIdx;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct LapData
{
    public uint LastLapTimeInMs;
    public uint CurrentLapTimeInMs;
    public ushort Sector1TimeMsPart;
    public byte Sector1TimeMinutesPart;
    public ushort Sector2TimeMsPart;
    public byte Sector2TimeMinutesPart;
    public ushort DeltaToCarInFrontMsPart;
    public byte DeltaToCarInFrontMinutesPart;
    public ushort DeltaToRaceLeaderMsPart;
    public byte DeltaToRaceLeaderMinutesPart;
    public float LapDistance;
    public float TotalDistance;
    public float SafetyCarDelta;
    public byte CarPosition;
    public byte CurrentLapNum;
    /// <summary>0 none, 1 pitting, 2 in the pit area.</summary>
    public byte PitStatus;
    public byte NumPitStops;
    public byte Sector;
    public bool CurrentLapInvalid;
    public byte Penalties;
    public byte TotalWarnings;
    public byte CornerCuttingWarnings;
    public byte NumUnservedDriveThroughPens;
    public byte NumUnservedStopGoPens;
    public byte GridPosition;
    /// <summary>0 garage, 1 flying lap, 2 in lap, 3 out lap, 4 on track.</summary>
    public byte DriverStatus;
    /// <summary>0 invalid, 1 inactive, 2 active, 3 finished, 4 DNF, 5 DSQ, 6 not classified, 7 retired.</summary>
    public byte ResultStatus;
    public bool PitLaneTimerActive;
    public ushort PitLaneTimeInLaneInMs;
    public ushort PitStopTimerInMs;
    public bool PitStopShouldServePen;
    public float SpeedTrapFastestSpeed;
    public byte SpeedTrapFastestLap;

    public readonly int Sector1TimeMs => Sector1TimeMinutesPart * 60_000 + Sector1TimeMsPart;
    public readonly int Sector2TimeMs => Sector2TimeMinutesPart * 60_000 + Sector2TimeMsPart;
    public readonly int DeltaToCarInFrontMs => DeltaToCarInFrontMinutesPart * 60_000 + DeltaToCarInFrontMsPart;
    public readonly int DeltaToRaceLeaderMs => DeltaToRaceLeaderMinutesPart * 60_000 + DeltaToRaceLeaderMsPart;
}
