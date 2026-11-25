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

/// <summary>
/// Extended motion data, for the player's car only (packet id 13). Per-wheel arrays
/// are ordered RL, RR, FL, FR.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct MotionExPacket : IPacket
{
    public PacketHeader Header;
    public Wheels<float> SuspensionPosition;
    public Wheels<float> SuspensionVelocity;
    public Wheels<float> SuspensionAcceleration;
    /// <summary>Metres per second.</summary>
    public Wheels<float> WheelSpeed;
    public Wheels<float> WheelSlipRatio;
    /// <summary>Radians.</summary>
    public Wheels<float> WheelSlipAngle;
    public Wheels<float> WheelLatForce;
    public Wheels<float> WheelLongForce;
    public float HeightOfCogAboveGround;
    /// <summary>Velocity in the car's own frame, metres per second.</summary>
    public float LocalVelocityX;
    public float LocalVelocityY;
    public float LocalVelocityZ;
    public float AngularVelocityX;
    public float AngularVelocityY;
    public float AngularVelocityZ;
    public float AngularAccelerationX;
    public float AngularAccelerationY;
    public float AngularAccelerationZ;
    /// <summary>Radians.</summary>
    public float FrontWheelsAngle;
    public Wheels<float> WheelVertForce;
    /// <summary>Front plank edge height above the road, metres.</summary>
    public float FrontAeroHeight;
    public float RearAeroHeight;
    public float FrontRollAngle;
    public float RearRollAngle;
    public float ChassisYaw;
    public float ChassisPitch;
    public Wheels<float> WheelCamber;
    public Wheels<float> WheelCamberGain;

    readonly PacketHeader IPacket.Header => Header;
}
