using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarSetupsPacket : IPacket
{
    public PacketHeader Header;
    public CarArray<CarSetupData> Cars;
    /// <summary>Front wing value after the next pit stop (player only).</summary>
    public float NextFrontWingValue;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarSetupData
{
    public byte FrontWing;
    public byte RearWing;
    /// <summary>Differential adjustment on throttle, percent.</summary>
    public byte OnThrottle;
    public byte OffThrottle;
    public float FrontCamber;
    public float RearCamber;
    public float FrontToe;
    public float RearToe;
    public byte FrontSuspension;
    public byte RearSuspension;
    public byte FrontAntiRollBar;
    public byte RearAntiRollBar;
    public byte FrontSuspensionHeight;
    public byte RearSuspensionHeight;
    /// <summary>Percent.</summary>
    public byte BrakePressure;
    /// <summary>Front brake bias, percent.</summary>
    public byte BrakeBias;
    /// <summary>Percent.</summary>
    public byte EngineBraking;
    /// <summary>PSI, ordered RL, RR, FL, FR.</summary>
    public Wheels<float> TyresPressure;
    public byte Ballast;
    /// <summary>Kilograms.</summary>
    public float FuelLoad;
}
