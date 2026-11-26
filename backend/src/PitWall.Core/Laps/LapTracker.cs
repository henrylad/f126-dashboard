using PitWall.Core.Live;

namespace PitWall.Core.Laps;

/// <summary>Everything the lap tracker knows, sent to a dashboard when it connects or the session changes.</summary>
public sealed record LapHistory
{
    public required string SessionUid { get; init; }
    public required int PlayerIdx { get; init; }
    public required int? PlayerBestLapId { get; init; }
    /// <summary>Every player lap, oldest first.</summary>
    public required IReadOnlyList<Lap> Laps { get; init; }
    /// <summary>Other drivers' fastest laps.</summary>
    public required IReadOnlyList<Lap> DriverBests { get; init; }
    /// <summary>One point per outline bin, null where the circuit is not known yet.</summary>
    public required IReadOnlyList<OutlinePoint?> Outline { get; init; }
    public required IReadOnlyList<MiniSector?> Minis { get; init; }
    public required IReadOnlyList<MiniSector?> LastMinis { get; init; }
    /// <summary>The player's current lap so far.</summary>
    public required IReadOnlyList<Sample> Current { get; init; }
    /// <summary>Your fastest laps on this track from earlier sessions, fastest first.</summary>
    public IReadOnlyList<Lap> SavedLaps { get; init; } = [];
}

/// <summary>Samples of the player's current lap from index <see cref="From"/> on; replaces anything the client has past it.</summary>
public sealed record CurrentLapChange(int From, IReadOnlyList<Sample> Samples);

/// <summary>
/// What changed since the previous delta. Applying a delta is idempotent, so a
/// client that received a history slightly newer than a delta still ends up right.
/// </summary>
public sealed record LapDelta
{
    public required int PlayerIdx { get; init; }
    public required int? PlayerBestLapId { get; init; }
    public required IReadOnlyList<MiniSector?> Minis { get; init; }
    public required IReadOnlyList<MiniSector?> LastMinis { get; init; }
    public required CurrentLapChange Current { get; init; }
    public required IReadOnlyList<Lap> AddedLaps { get; init; }
    public required IReadOnlyList<int> RemovedLapIds { get; init; }
    /// <summary>Drivers whose fastest lap improved.</summary>
    public required IReadOnlyList<Lap> DriverBests { get; init; }
    public required IReadOnlyList<OutlinePatch> Outline { get; init; }
}

/// <summary>
/// Accumulates lap history from snapshots: the track outline (learned from car
/// positions), mini-sector times for every car, and archived laps with traces.
/// Not thread-safe: callers serialise access.
/// </summary>
public sealed class LapTracker
{
    public const int MiniSectors = MiniSectorTimer.Count;
    public const int OutlineBins = TrackOutline.Bins;

    private readonly TrackOutline _outline = new();
    private readonly MiniSectorTimer _minis = new();
    private readonly LapArchive _archive;
    private int _deltaPlayerIdx = -1;

    public LapTracker() => _archive = new LapArchive(_minis);

    public string SessionUid { get; private set; } = "";

    /// <summary>Increments whenever a new session resets the history.</summary>
    public int Generation { get; private set; }

    public int PlayerIdx { get; private set; } = -1;

    public IReadOnlyList<Lap> Laps => _archive.Laps;
    public Lap? PlayerBestLap => _archive.Best(PlayerIdx);
    public IReadOnlyList<Sample> Current => _archive.Current(PlayerIdx);
    public IReadOnlyList<MiniSector?> Minis => _minis.Current(PlayerIdx);
    public IReadOnlyList<MiniSector?> LastMinis => _minis.Last(PlayerIdx);
    public IReadOnlyList<OutlinePoint?> Outline => _outline.Points();
    public int OutlineFilled => _outline.Filled;

    /// <summary>Every other driver's fastest valid lap, fastest first.</summary>
    public IReadOnlyList<Lap> DriverBests() => _archive.Bests(exceptCarIdx: PlayerIdx);

    public void Update(Snapshot snapshot)
    {
        if (snapshot.Session is not { } session) return;
        if (session.Uid != SessionUid) Reset(session.Uid);

        double trackLength = session.TrackLength > 0 ? session.TrackLength : 1;
        foreach (var car in snapshot.Cars)
        {
            if (car.IsPlayer) PlayerIdx = car.Idx;
            // Order matters: archiving a lap reads the mini sectors the timer just closed.
            _minis.Update(car, trackLength);
            _outline.Learn(car, trackLength);
            _archive.Record(car, session);
        }
    }

    public LapHistory History() => new()
    {
        SessionUid = SessionUid,
        PlayerIdx = PlayerIdx,
        PlayerBestLapId = PlayerBestLap?.Id,
        Laps = [.. Laps],
        DriverBests = DriverBests(),
        Outline = Outline,
        Minis = [.. Minis],
        LastMinis = [.. LastMinis],
        Current = [.. Current],
    };

    /// <summary>Changes since the previous call.</summary>
    public LapDelta TakeDelta()
    {
        var (from, samples) = _archive.TakeCurrentChanges(PlayerIdx);
        if (PlayerIdx != _deltaPlayerIdx)
        {
            // A different car's lap: resend it from the start.
            (from, samples) = (0, [.. Current]);
            _deltaPlayerIdx = PlayerIdx;
        }
        var (added, removed, bests) = _archive.TakeArchiveChanges();

        return new LapDelta
        {
            PlayerIdx = PlayerIdx,
            PlayerBestLapId = PlayerBestLap?.Id,
            Minis = [.. Minis],
            LastMinis = [.. LastMinis],
            Current = new CurrentLapChange(from, samples),
            AddedLaps = added,
            RemovedLapIds = removed,
            DriverBests = [.. bests.Where(l => l.CarIdx != PlayerIdx)],
            Outline = _outline.TakePatches(),
        };
    }

    private void Reset(string uid)
    {
        SessionUid = uid;
        Generation++;
        PlayerIdx = -1;
        _outline.Clear();
        _minis.Clear();
        _archive.Clear();
    }
}
