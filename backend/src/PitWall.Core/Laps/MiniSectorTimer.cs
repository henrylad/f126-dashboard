using PitWall.Core.Live;

namespace PitWall.Core.Laps;

/// <summary>
/// Times every car through 25 equal mini sectors per lap and colours each time
/// against the car's personal best and the session best.
/// </summary>
internal sealed class MiniSectorTimer
{
    public const int Count = 25;

    private static readonly MiniSector?[] None = new MiniSector?[Count];

    /// <summary>Per-car timing state. Best times use 0 for "none yet".</summary>
    private sealed class CarMinis(CarRow car)
    {
        public int Lap = car.Lap;
        public double LastD = car.LapDistance;
        public double LastT = car.CurrentLapMs;
        /// <summary>Lap time when each mini sector was entered.</summary>
        public double?[] StartT = new double?[Count];
        public bool Invalid;
        public readonly double[] PersonalBest = new double[Count];
        public MiniSector?[] Current = new MiniSector?[Count];
        public MiniSector?[] Last = new MiniSector?[Count];
    }

    private readonly Dictionary<int, CarMinis> _cars = [];
    private readonly double[] _overallBest = new double[Count];

    public IReadOnlyList<MiniSector?> Current(int carIdx) => _cars.TryGetValue(carIdx, out var m) ? m.Current : None;

    public IReadOnlyList<MiniSector?> Last(int carIdx) => _cars.TryGetValue(carIdx, out var m) ? m.Last : None;

    public void Clear()
    {
        _cars.Clear();
        Array.Clear(_overallBest);
    }

    /// <summary>
    /// Detects mini-sector boundary crossings between two updates, interpolating
    /// the crossing time from lap distance so 30 Hz updates still give ms accuracy.
    /// </summary>
    public void Update(CarRow car, double trackLength)
    {
        var seg = trackLength / Count;
        if (!_cars.TryGetValue(car.Idx, out var m))
        {
            _cars[car.Idx] = new CarMinis(car);
            return;
        }

        if (LapRules.LapStarted(new LapPosition(m.Lap, m.LastD, m.LastT), car, trackLength))
        {
            var nextLap = car.Lap == m.Lap + 1;
            var atLine = nextLap || car.Lap == m.Lap; // same lap number = timer reset at the line
            if (nextLap && m.StartT[Count - 1] is { } lastStart && car.LastLapMs > 0)
                Complete(m, Count - 1, car.LastLapMs - lastStart);
            m.Last = m.Current;
            m.Current = new MiniSector?[Count];
            m.Lap = car.Lap;
            m.Invalid = false;
            m.StartT = new double?[Count];
            if (atLine) m.StartT[0] = 0;
            // Treat the line itself as the previous sample for the crossing scan below.
            m.LastD = 0;
            m.LastT = 0;
        }
        else if (car.LapDistance < m.LastD - 30)
        {
            // Flashback: times before this point no longer match — skip the rest of the lap.
            Array.Clear(m.StartT);
            m.Invalid = true;
            m.LastD = car.LapDistance;
            m.LastT = car.CurrentLapMs;
            return;
        }

        // Out-laps, in-laps and pit/garage time don't count towards mini-sector bests.
        if (car.CurrentLapInvalid || (car.CurrentLapMs > LapRules.LapStartGraceMs && !LapRules.OnTimedLap(car))) m.Invalid = true;

        double d = car.LapDistance, t = car.CurrentLapMs;
        if (d > m.LastD)
        {
            for (var k = Math.Max(1, (int)Math.Floor(m.LastD / seg) + 1); k < Count && k * seg <= d; k++)
            {
                var boundary = k * seg;
                var tb = m.LastT + (boundary - m.LastD) / (d - m.LastD) * (t - m.LastT);
                if (m.StartT[k - 1] is { } start) Complete(m, k - 1, tb - start);
                m.StartT[k] = tb;
            }
        }
        m.LastD = d;
        m.LastT = t;
    }

    private void Complete(CarMinis m, int k, double ms)
    {
        if (!(ms > 0)) return;
        var colour = MiniColour.NotCounted;
        if (!m.Invalid)
        {
            if (_overallBest[k] == 0 || ms < _overallBest[k])
            {
                _overallBest[k] = ms;
                colour = MiniColour.FastestOverall;
            }
            else
            {
                colour = m.PersonalBest[k] == 0 || ms < m.PersonalBest[k] ? MiniColour.PersonalBest : MiniColour.SlowerThanBest;
            }
            if (m.PersonalBest[k] == 0 || ms < m.PersonalBest[k]) m.PersonalBest[k] = ms;
        }
        m.Current[k] = new MiniSector(ms, colour);
    }
}
