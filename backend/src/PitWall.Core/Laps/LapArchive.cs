using PitWall.Core.Live;

namespace PitWall.Core.Laps;

/// <summary>
/// Records every car's telemetry along its lap and archives the lap when it ends.
/// The player keeps every lap; other drivers only keep their fastest.
/// </summary>
internal sealed class LapArchive(MiniSectorTimer minis)
{
    /// <summary>Oldest laps are dropped beyond this (the best lap is always kept).</summary>
    private const int MaxLaps = 150;

    /// <summary>What happened during a car's current lap, to classify it when it ends.</summary>
    private sealed class LapFlags(bool fromLine)
    {
        public readonly bool FromLine = fromLine;
        public bool Out, In, Pit, Invalid, Flashback;
    }

    private sealed class CarRecorder
    {
        public LapPosition? Prev;
        public List<Sample> Current = [];
        /// <summary>Lowest index of <see cref="Current"/> changed since the last delta.</summary>
        public int CurrentChangedFrom;
        public LapFlags Flags = new(fromLine: false);
        public double? FuelStartKg;
        public double? WearStartPct;
        public Lap? Best;
    }

    private static readonly List<Sample> NoSamples = [];

    private readonly Dictionary<int, CarRecorder> _recorders = [];
    private readonly List<Lap> _laps = [];
    private int _lapSeq;

    private readonly List<Lap> _addedLaps = [];
    private readonly List<int> _removedLapIds = [];
    private readonly Dictionary<int, Lap> _changedBests = [];

    /// <summary>Every completed player lap this session, oldest first.</summary>
    public IReadOnlyList<Lap> Laps => _laps;

    public IReadOnlyList<Sample> Current(int carIdx) => _recorders.TryGetValue(carIdx, out var r) ? r.Current : NoSamples;

    public Lap? Best(int carIdx) => _recorders.TryGetValue(carIdx, out var r) ? r.Best : null;

    /// <summary>Every car's fastest valid lap except <paramref name="exceptCarIdx"/>'s, fastest first.</summary>
    public List<Lap> Bests(int exceptCarIdx) =>
        [.. _recorders.Where(kv => kv.Key != exceptCarIdx && kv.Value.Best is not null)
            .Select(kv => kv.Value.Best!)
            .OrderBy(l => l.TimeMs)];

    public void Clear()
    {
        _recorders.Clear();
        _laps.Clear();
        _lapSeq = 0;
        _addedLaps.Clear();
        _removedLapIds.Clear();
        _changedBests.Clear();
    }

    public void Record(CarRow car, SessionInfo session)
    {
        if (!_recorders.TryGetValue(car.Idx, out var r)) _recorders[car.Idx] = r = new CarRecorder();

        var prev = r.Prev;
        r.Prev = new LapPosition(car.Lap, car.LapDistance, car.CurrentLapMs);
        if (prev is not { } p || LapRules.LapStarted(p, car, session.TrackLength > 0 ? session.TrackLength : 1))
        {
            if (prev is { } last && r.Current.Count > 20) Archive(r, last, car, session);
            r.Current = [];
            r.CurrentChangedFrom = 0;
            // A lap only counts if we saw it start at the line.
            r.Flags = new LapFlags(fromLine: prev is not null);
            r.FuelStartKg = prev is null ? null : car.FuelKg;
            r.WearStartPct = prev is null ? null : car.TyreWearAvg;
        }

        if (car.CurrentLapMs > LapRules.LapStartGraceMs)
        {
            var f = r.Flags;
            if (car.PitStatus != 0 || car.DriverStatus == 0) f.Pit = true;
            if (car.DriverStatus == 3) f.Out = true;
            if (car.DriverStatus == 2) f.In = true;
            if (car.CurrentLapInvalid) f.Invalid = true;
        }

        if (car.LapDistance < 0) return;
        Sample? lastSample = r.Current.Count > 0 ? r.Current[^1] : null;
        if (lastSample is { } ls && car.LapDistance < ls.D - 50)
        {
            // Flashback / rewind: drop samples past the new position.
            var keep = r.Current.FindLastIndex(s => s.D <= car.LapDistance) + 1;
            r.Current.RemoveRange(keep, r.Current.Count - keep);
            r.CurrentChangedFrom = Math.Min(r.CurrentChangedFrom, keep);
            r.Flags.Flashback = true;
            lastSample = keep > 0 ? r.Current[^1] : null;
        }
        if (lastSample is null || car.LapDistance > lastSample.Value.D)
        {
            r.Current.Add(new Sample(car.LapDistance, car.CurrentLapMs, car.Speed, car.Throttle, car.Brake, car.Gear, car.ErsStoreJ, car.ErsDeployMode));
        }
    }

    private void Archive(CarRecorder r, LapPosition prev, CarRow car, SessionInfo session)
    {
        var f = r.Flags;
        // Crossing the line normally increments the lap; a timer reset without it follows the pits.
        var finished = car.Lap == prev.Lap + 1;
        var kind = f.Out ? LapKind.Out
            : f.In ? LapKind.In
            : f.Pit ? LapKind.Pit
            : !f.FromLine ? LapKind.Partial
            : f.Invalid || f.Flashback || !finished || r.Current[0].D >= 200 ? LapKind.Invalid
            : LapKind.Timed;

        var lap = LapSummary.Summarise(r.Current, new LapContext
        {
            Id = ++_lapSeq,
            CarIdx = car.Idx,
            Number = prev.Lap,
            Kind = kind,
            TimeMs = finished ? car.LastLapMs : Math.Round(prev.T),
            TrackLength = session.TrackLength,
            Sector2Start = session.Sector2Start,
            Sector3Start = session.Sector3Start,
            // The mini-sector timer has already moved this lap's times to "last".
            Minis = [.. minis.Last(car.Idx)],
            FuelStartKg = r.FuelStartKg,
            FuelEndKg = car.FuelKg,
            WearStartPct = r.WearStartPct,
            WearEndPct = car.TyreWearAvg,
            Compound = car.Compound,
            TyreAge = car.TyreAge,
        });

        if (kind == LapKind.Timed && lap.TimeMs > 0 && (r.Best is null || lap.TimeMs < r.Best.TimeMs))
        {
            r.Best = lap;
            if (!car.IsPlayer) _changedBests[car.Idx] = lap;
        }
        if (!car.IsPlayer) return;

        _laps.Add(lap);
        _addedLaps.Add(lap);
        if (_laps.Count > MaxLaps)
        {
            var drop = _laps.FindIndex(l => l.Id != r.Best?.Id);
            _removedLapIds.Add(_laps[drop].Id);
            _laps.RemoveAt(drop);
        }
    }

    /// <summary>Samples of the car's current lap changed since the last call, as (first changed index, samples from there).</summary>
    public (int From, List<Sample> Samples) TakeCurrentChanges(int carIdx)
    {
        if (!_recorders.TryGetValue(carIdx, out var r)) return (0, []);
        var from = Math.Min(r.CurrentChangedFrom, r.Current.Count);
        r.CurrentChangedFrom = r.Current.Count;
        return (from, r.Current[from..]);
    }

    public (List<Lap> Added, List<int> RemovedIds, List<Lap> ChangedBests) TakeArchiveChanges()
    {
        var result = (_addedLaps.ToList(), _removedLapIds.ToList(), _changedBests.Values.ToList());
        _addedLaps.Clear();
        _removedLapIds.Clear();
        _changedBests.Clear();
        return result;
    }
}
