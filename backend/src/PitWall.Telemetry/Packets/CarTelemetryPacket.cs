using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarTelemetryPacket : IPacket
{
    public PacketHeader Header;
    public CarArray<CarTelemetryData> Cars;
    public byte MfdPanelIndex;
    public byte MfdPanelIndexSecondaryPlayer;
    public sbyte SuggestedGear;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarTelemetryData
{
    /// <summary>km/h.</summary>
    public ushort Speed;
    public float Throttle;
    public float Steer;
    public float Brake;
    public byte Clutch;
    public sbyte Gear;
    public ushort EngineRpm;
    public bool Drs;
    public byte RevLightsPercent;
    public ushort RevLightsBitValue;
    public Wheels<ushort> BrakesTemperature;
    public Wheels<byte> TyresSurfaceTemperature;
    public Wheels<byte> TyresInnerTemperature;
    public byte EngineTemperature;
    public Wheels<float> TyresPressure;
    public Wheels<byte> SurfaceType;
}

/// <summary>New in the 2026 format: active aero and overtake mode.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarTelemetry2Packet : IPacket
{
    public PacketHeader Header;
    public CarArray<CarTelemetry2Data> Cars;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarTelemetry2Data
{
    /// <summary>0 = corner mode, 1 = straight mode.</summary>
    public byte ActiveAeroMode;
    public bool ActiveAeroAvailable;
    public ushort ActiveAeroActivationDistance;
    public bool OvertakeAvailable;
    public bool OvertakeActive;
    public ushort OvertakeActivationDistance;
    public bool Regulations2026Applicable;
    public bool DrivingWrongWay;
}
