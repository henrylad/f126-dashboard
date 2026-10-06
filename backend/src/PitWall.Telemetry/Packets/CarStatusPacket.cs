using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarStatusPacket : IPacket
{
    public PacketHeader Header;
    public CarArray<CarStatusData> Cars;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarStatusData
{
    public byte TractionControl;
    public byte AntiLockBrakes;
    public byte FuelMix;
    public byte FrontBrakeBias;
    public bool PitLimiterStatus;
    public float FuelInTank;
    public float FuelCapacity;
    public float FuelRemainingLaps;
    public ushort MaxRpm;
    public ushort IdleRpm;
    public byte MaxGears;
    public bool DrsAllowed;
    public ushort DrsActivationDistance;
    public byte ActualTyreCompound;
    public byte VisualTyreCompound;
    public byte TyresAgeLaps;
    public sbyte VehicleFiaFlags;
    public float EnginePowerIce;
    public float EnginePowerMguk;
    /// <summary>Joules.</summary>
    public float ErsStoreEnergy;
    /// <summary>0 none, 1 medium, 2 hotlap, 3 overtake/boost.</summary>
    public byte ErsDeployMode;
    public float ErsHarvestedThisLapMguk;
    public float ErsHarvestedThisLapMguh;
    public float ErsHarvestLimitPerLap;
    public float ErsDeployedThisLap;
    public bool NetworkPaused;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarDamagePacket : IPacket
{
    public PacketHeader Header;
    public CarArray<CarDamageData> Cars;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct CarDamageData
{
    public Wheels<float> TyresWear;
    public Wheels<byte> TyresDamage;
    public Wheels<byte> BrakesDamage;
    public Wheels<byte> TyreBlisters;
    public byte FrontLeftWingDamage;
    public byte FrontRightWingDamage;
    public byte RearWingDamage;
    public byte FloorDamage;
    public byte DiffuserDamage;
    public byte SidepodDamage;
    public bool DrsFault;
    public bool ErsFault;
    public byte GearBoxDamage;
    public byte EngineDamage;
    public byte EngineMguhWear;
    public byte EngineEsWear;
    public byte EngineCeWear;
    public byte EngineIceWear;
    public byte EngineMgukWear;
    public byte EngineTcWear;
    public bool EngineBlown;
    public bool EngineSeized;
}
