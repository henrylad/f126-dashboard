using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct MotionPacket : IPacket
{
    public PacketHeader Header;
    public CarArray<CarMotionData> Cars;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarMotionData
{
    public float WorldPositionX;
    public float WorldPositionY;
    public float WorldPositionZ;
    public float WorldVelocityX;
    public float WorldVelocityY;
    public float WorldVelocityZ;
    /// <summary>Normalised: divide by <see cref="PacketFormat.DirectionScale"/>.</summary>
    public short WorldForwardDirX;
    public short WorldForwardDirY;
    public short WorldForwardDirZ;
    public short WorldRightDirX;
    public short WorldRightDirY;
    public short WorldRightDirZ;
    /// <summary>Quantised: divide by <see cref="PacketFormat.GForceScale"/>.</summary>
    public short GForceLateral;
    public short GForceLongitudinal;
    public short GForceVertical;
    public float Yaw;
    public float Pitch;
    public float Roll;
}
