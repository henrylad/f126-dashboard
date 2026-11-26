using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

/// <summary>
/// Every tyre set one car has for the weekend (packet 12). The game cycles through
/// the cars, so each packet covers the car in <see cref="CarIdx"/>.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct TyreSetsPacket : IPacket
{
    public const int MaxSets = 20;

    public PacketHeader Header;
    public byte CarIdx;
    /// <summary>13 dry sets, then 7 wet.</summary>
    public FixedArray20<TyreSetData> Sets;
    public byte FittedIdx;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct TyreSetData
{
    public byte ActualTyreCompound;
    public byte VisualTyreCompound;
    /// <summary>Percent.</summary>
    public byte Wear;
    public bool Available;
    /// <summary>Session type the game recommends this set for.</summary>
    public byte RecommendedSession;
    /// <summary>Laps left in this set.</summary>
    public byte LifeSpan;
    /// <summary>Recommended maximum laps for this compound.</summary>
    public byte UsableLife;
    /// <summary>Lap time difference to the fitted set, ms.</summary>
    public short LapDeltaTime;
    public bool Fitted;
}
