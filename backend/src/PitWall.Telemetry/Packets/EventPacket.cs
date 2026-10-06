using System.Buffers.Binary;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct EventPacket : IPacket
{
    public PacketHeader Header;
    public EventCode Code;
    public EventDetails Details;

    readonly PacketHeader IPacket.Header => Header;
}

/// <summary>Four ASCII characters identifying the event, e.g. <c>FTLP</c>.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public readonly record struct EventCode(uint Value)
{
    public static EventCode From(string code)
    {
        Span<byte> bytes = stackalloc byte[4];
        Encoding.ASCII.GetBytes(code.AsSpan(0, 4), bytes);
        return new EventCode(BinaryPrimitives.ReadUInt32LittleEndian(bytes));
    }

    public override string ToString()
    {
        Span<byte> bytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(bytes, Value);
        return Encoding.ASCII.GetString(bytes);
    }
}

/// <summary>12-byte union whose meaning depends on the <see cref="EventCode"/>.</summary>
[InlineArray(Size)]
public struct EventDetails
{
    public const int Size = 12;

    private byte _element;

    public readonly T As<T>() where T : unmanaged
    {
        ReadOnlySpan<byte> bytes = this;
        return MemoryMarshal.Read<T>(bytes);
    }

    public static EventDetails From<T>(T value) where T : unmanaged
    {
        var result = default(EventDetails);
        Span<byte> bytes = result;
        MemoryMarshal.Write(bytes, in value);
        return result;
    }
}

/// <summary>Event payloads, one per event code that carries data.</summary>
public static class EventData
{
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FastestLap { public byte VehicleIdx; public float LapTime; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Retirement { public byte VehicleIdx; public byte Reason; }

    /// <summary>Shared by TMPT, RCWN and DTSV, which only carry the car index.</summary>
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Vehicle { public byte VehicleIdx; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Penalty
    {
        public byte PenaltyType;
        public byte InfringementType;
        public byte VehicleIdx;
        public byte OtherVehicleIdx;
        /// <summary>Seconds; 255 when the penalty has no time.</summary>
        public byte Time;
        public byte LapNum;
        public byte PlacesGained;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct SpeedTrap
    {
        public byte VehicleIdx;
        public float Speed;
        public bool IsOverallFastestInSession;
        public bool IsDriverFastestInSession;
        public byte FastestVehicleIdxInSession;
        public float FastestSpeedInSession;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct StartLights { public byte NumLights; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct StopGoServed { public byte VehicleIdx; public float StopTime; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Flashback { public uint FlashbackFrameIdentifier; public float FlashbackSessionTime; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Buttons { public uint ButtonStatus; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Overtake { public byte OvertakingVehicleIdx; public byte BeingOvertakenVehicleIdx; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct SafetyCar
    {
        /// <summary>0 none, 1 safety car, 2 virtual safety car, 3 formation lap.</summary>
        public byte SafetyCarType;
        /// <summary>0 deployed, 1 returning, 2 returned, 3 resume race.</summary>
        public byte EventType;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct Collision { public byte Vehicle1Idx; public byte Vehicle2Idx; public byte Severity; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct DrsDisabled { public byte Reason; }
}
