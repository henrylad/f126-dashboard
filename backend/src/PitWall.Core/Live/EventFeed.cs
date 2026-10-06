using System.Globalization;
using PitWall.Telemetry.Packets;
using static PitWall.Telemetry.Packets.EventData;

namespace PitWall.Core.Live;

/// <summary>Race-control style feed of session events, newest first.</summary>
public sealed class EventFeed
{
    private const int MaxEvents = 40;

    private static readonly string[] SafetyCarTypes = ["", "Safety Car", "Virtual Safety Car", "Formation lap"];
    private static readonly string[] SafetyCarPhases = ["deployed", "returning", "returned", "resume race"];

    private readonly List<FeedEvent> _events = [];

    public IReadOnlyList<FeedEvent> Events => _events;

    public void Clear() => _events.Clear();

    public void Add(double sessionTime, in EventPacket packet, Func<int, string> driverName)
    {
        var code = packet.Code.ToString();
        var text = Describe(code, packet.Details, driverName);
        if (text is null) return;
        _events.Insert(0, new FeedEvent(sessionTime, code, text));
        if (_events.Count > MaxEvents) _events.RemoveRange(MaxEvents, _events.Count - MaxEvents);
    }

    /// <summary>A line of text for the event, or null for events the feed does not show.</summary>
    internal static string? Describe(string code, in EventDetails d, Func<int, string> name) => code switch
    {
        "SSTA" => "Session started",
        "SEND" => "Session ended",
        "FTLP" => $"Fastest lap — {name(d.As<FastestLap>().VehicleIdx)} {FormatLap(d.As<FastestLap>().LapTime)}",
        "RTMT" => $"{name(d.As<Retirement>().VehicleIdx)} retired",
        "CHQF" => "Chequered flag",
        "RCWN" => $"{name(d.As<Vehicle>().VehicleIdx)} wins the race",
        "PENA" => DescribePenalty(d.As<Penalty>(), name),
        "SPTP" => d.As<SpeedTrap>() is { IsOverallFastestInSession: true } trap
            ? string.Create(CultureInfo.InvariantCulture, $"Speed trap — {name(trap.VehicleIdx)} {trap.Speed:0.0} km/h")
            : null,
        "LGOT" => "Lights out",
        "DTSV" => $"{name(d.As<Vehicle>().VehicleIdx)} served drive-through",
        "SGSV" => $"{name(d.As<StopGoServed>().VehicleIdx)} served stop-go",
        "OVTK" => $"{name(d.As<Overtake>().OvertakingVehicleIdx)} passes {name(d.As<Overtake>().BeingOvertakenVehicleIdx)}",
        "SCAR" => DescribeSafetyCar(d.As<SafetyCar>()),
        "COLL" => $"Contact — {name(d.As<Collision>().Vehicle1Idx)} / {name(d.As<Collision>().Vehicle2Idx)}",
        "RDFL" => "Red flag",
        "TMPT" => "Teammate in the pits",
        "FLBK" => "Flashback used",
        "DRSE" => "DRS enabled",
        "DRSD" => "DRS disabled",
        _ => null,
    };

    private static string DescribePenalty(Penalty p, Func<int, string> name) =>
        p.Time is > 0 and < 255 ? $"Penalty — {name(p.VehicleIdx)} +{p.Time}s" : $"Penalty — {name(p.VehicleIdx)}";

    private static string? DescribeSafetyCar(SafetyCar sc) =>
        sc.SafetyCarType < SafetyCarTypes.Length && sc.EventType < SafetyCarPhases.Length
            ? $"{SafetyCarTypes[sc.SafetyCarType]} {SafetyCarPhases[sc.EventType]}"
            : null;

    /// <summary>Seconds as m:ss.fff.</summary>
    internal static string FormatLap(double seconds)
    {
        var minutes = (int)Math.Floor(seconds / 60);
        return string.Create(CultureInfo.InvariantCulture, $"{minutes}:{seconds - minutes * 60:00.000}");
    }
}
