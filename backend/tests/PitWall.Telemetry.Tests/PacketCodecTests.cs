using System.Runtime.InteropServices;
using PitWall.Telemetry.Packets;

namespace PitWall.Telemetry.Tests;

public class PacketCodecTests
{
    [Fact]
    public void Header_is_29_bytes() => Assert.Equal(29, PacketCodec.HeaderSize);

    // Total packet sizes as published for packetFormat 2026.
    public static TheoryData<string, int, int> PublishedSizes => new()
    {
        { nameof(MotionPacket), PacketCodec.SizeOf<MotionPacket>(), 1325 },
        { nameof(SessionPacket), PacketCodec.SizeOf<SessionPacket>(), 926 },
        { nameof(LapDataPacket), PacketCodec.SizeOf<LapDataPacket>(), 1399 },
        { nameof(EventPacket), PacketCodec.SizeOf<EventPacket>(), 45 },
        { nameof(ParticipantsPacket), PacketCodec.SizeOf<ParticipantsPacket>(), 1470 },
        { nameof(CarTelemetryPacket), PacketCodec.SizeOf<CarTelemetryPacket>(), 1448 },
        { nameof(CarStatusPacket), PacketCodec.SizeOf<CarStatusPacket>(), 1445 },
        { nameof(CarDamagePacket), PacketCodec.SizeOf<CarDamagePacket>(), 1133 },
        { nameof(SessionHistoryPacket), PacketCodec.SizeOf<SessionHistoryPacket>(), 1460 },
        { nameof(LapPositionsPacket), PacketCodec.SizeOf<LapPositionsPacket>(), 1231 },
        { nameof(CarTelemetry2Packet), PacketCodec.SizeOf<CarTelemetry2Packet>(), 269 },
        { nameof(MotionExPacket), PacketCodec.SizeOf<MotionExPacket>(), 273 },
        { nameof(CarSetupsPacket), PacketCodec.SizeOf<CarSetupsPacket>(), 1233 },
    };

    [Theory]
    [MemberData(nameof(PublishedSizes))]
    public void Packet_matches_the_published_size(string packet, int actual, int expected) =>
        Assert.True(actual == expected, $"{packet} is {actual} bytes, spec says {expected}");

    private static PacketHeader Header(PacketId id, ushort format = PacketFormat.Version) => new()
    {
        PacketFormat = format,
        GameYear = 26,
        PacketId = id,
        SessionUid = 12345678901234567890UL,
        PlayerCarIndex = 3,
    };

    [Fact]
    public void Round_trips_telemetry_fields()
    {
        var sent = new CarTelemetryPacket { Header = Header(PacketId.CarTelemetry), SuggestedGear = 7 };
        for (var i = 0; i < PacketFormat.MaxCars; i++)
        {
            sent.Cars[i].Speed = (ushort)(100 + i);
            sent.Cars[i].Throttle = 0.5f;
        }
        sent.Cars[0].Gear = -1;
        sent.Cars[5].TyresSurfaceTemperature[3] = 93;

        var result = PacketCodec.Decode(PacketCodec.Encode(sent));

        Assert.Equal(DecodeStatus.Ok, result.Status);
        Assert.Equal(12345678901234567890UL, result.Header.SessionUid);
        Assert.Equal(3, result.Header.PlayerCarIndex);
        var got = Assert.IsType<CarTelemetryPacket>(result.Packet);
        Assert.Equal(123, got.Cars[23].Speed);
        Assert.Equal(-1, got.Cars[0].Gear);
        Assert.Equal(93, got.Cars[5].TyresSurfaceTemperature[3]);
        Assert.Equal(7, got.SuggestedGear);
    }

    [Fact]
    public void Round_trips_2026_active_aero_fields()
    {
        var sent = new CarTelemetry2Packet { Header = Header(PacketId.CarTelemetry2) };
        sent.Cars[0] = new CarTelemetry2Data { ActiveAeroMode = 1, OvertakeActive = true, OvertakeActivationDistance = 812 };

        var got = Assert.IsType<CarTelemetry2Packet>(PacketCodec.Decode(PacketCodec.Encode(sent)).Packet);

        Assert.Equal(1, got.Cars[0].ActiveAeroMode);
        Assert.True(got.Cars[0].OvertakeActive);
        Assert.Equal(812, got.Cars[0].OvertakeActivationDistance);
    }

    [Fact]
    public void Reads_extended_motion_at_the_published_offsets()
    {
        var bytes = PacketCodec.Encode(new MotionExPacket { Header = Header(PacketId.ExtendedMotion) });
        // Written by hand: wheel slip ratio FR is float 19, front aero height float 47.
        BitConverter.TryWriteBytes(bytes.AsSpan(PacketCodec.HeaderSize + 19 * 4), 0.08f);
        BitConverter.TryWriteBytes(bytes.AsSpan(PacketCodec.HeaderSize + 47 * 4), 0.031f);
        BitConverter.TryWriteBytes(bytes.AsSpan(bytes.Length - 4), -1.5f);

        var got = Assert.IsType<MotionExPacket>(PacketCodec.Decode(bytes).Packet);

        Assert.Equal(0.08f, got.WheelSlipRatio[3]);
        Assert.Equal(0.031f, got.FrontAeroHeight);
        Assert.Equal(-1.5f, got.WheelCamberGain[3]);
    }

    [Fact]
    public void Round_trips_car_setups()
    {
        var sent = new CarSetupsPacket { Header = Header(PacketId.CarSetups), NextFrontWingValue = 31 };
        sent.Cars[3] = new CarSetupData { FrontWing = 30, OnThrottle = 70, FrontCamber = -3.2f, BrakeBias = 56, FuelLoad = 24.5f };
        sent.Cars[3].TyresPressure[2] = 25.1f;

        var got = Assert.IsType<CarSetupsPacket>(PacketCodec.Decode(PacketCodec.Encode(sent)).Packet);

        Assert.Equal(70, got.Cars[3].OnThrottle);
        Assert.Equal(-3.2f, got.Cars[3].FrontCamber);
        Assert.Equal(56, got.Cars[3].BrakeBias);
        Assert.Equal(25.1f, got.Cars[3].TyresPressure[2]);
        Assert.Equal(24.5f, got.Cars[3].FuelLoad);
        Assert.Equal(31f, got.NextFrontWingValue);
    }

    [Fact]
    public void Decodes_participant_names()
    {
        var sent = new ParticipantsPacket { Header = Header(PacketId.Participants), NumActiveCars = 22 };
        sent.Cars[0].Name = Utf8String32.From("VERSTAPPEN");
        sent.Cars[0].TeamId = 478;

        var got = Assert.IsType<ParticipantsPacket>(PacketCodec.Decode(PacketCodec.Encode(sent)).Packet);

        Assert.Equal("VERSTAPPEN", got.Cars[0].Name.ToString());
        Assert.Equal(478, got.Cars[0].TeamId);
    }

    [Fact]
    public void Truncates_names_longer_than_the_field()
    {
        var name = Utf8String32.From(new string('A', 40));
        Assert.Equal(new string('A', Utf8String32.Length - 1), name.ToString());
    }

    [Fact]
    public void Decodes_event_payloads_by_code()
    {
        var bytes = PacketCodec.Encode(new EventPacket { Header = Header(PacketId.Event), Code = EventCode.From("FTLP") });
        // Written by hand to check the payload offsets, not just the round trip.
        bytes[PacketCodec.HeaderSize + 4] = 7;
        BitConverter.TryWriteBytes(bytes.AsSpan(PacketCodec.HeaderSize + 5), 88.123f);

        var got = Assert.IsType<EventPacket>(PacketCodec.Decode(bytes).Packet);
        var lap = got.Details.As<EventData.FastestLap>();

        Assert.Equal("FTLP", got.Code.ToString());
        Assert.Equal(7, lap.VehicleIdx);
        Assert.Equal(88.123f, lap.LapTime, 3);
    }

    [Fact]
    public void Rejects_other_packet_formats()
    {
        var result = PacketCodec.Decode(PacketCodec.Encode(new CarStatusPacket { Header = Header(PacketId.CarStatus, format: 2025) }));

        Assert.Equal(DecodeStatus.WrongFormat, result.Status);
        Assert.Equal(2025, result.Header.PacketFormat);
        Assert.Null(result.Packet);
    }

    [Fact]
    public void Rejects_truncated_packets()
    {
        var bytes = PacketCodec.Encode(new MotionPacket { Header = Header(PacketId.Motion) });

        Assert.Equal(DecodeStatus.TooShort, PacketCodec.Decode(bytes.AsSpan(0, 100)).Status);
        Assert.Equal(DecodeStatus.TooShort, PacketCodec.Decode(bytes.AsSpan(0, 10)).Status);
    }

    [Fact]
    public void Reports_packets_without_a_layout_as_unhandled()
    {
        var header = Header(PacketId.TyreSets);
        var bytes = MemoryMarshal.AsBytes(new ReadOnlySpan<PacketHeader>(in header)).ToArray();

        Assert.Equal(DecodeStatus.Unhandled, PacketCodec.Decode(bytes).Status);
    }
}
