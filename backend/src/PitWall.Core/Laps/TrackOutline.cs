using PitWall.Core.Live;

namespace PitWall.Core.Laps;

public sealed record OutlinePoint(double X, double Z);

/// <summary>A changed outline bin.</summary>
public sealed record OutlinePatch(int I, double X, double Z);

/// <summary>
/// Learns the circuit from car positions, as one point per bin of lap distance.
/// Points from timed laps are trusted: out/in-lap data (pit entry and exit roads)
/// can only fill empty bins, never change a timed-lap point, and timed-lap data
/// always replaces it. Timed points keep a confidence count so a single stray pass
/// can't bend the track either.
/// </summary>
internal sealed class TrackOutline
{
    public const int Bins = 800;

    /// <summary>A new position this close to a bin's point confirms it; further away counts against it.</summary>
    private const double MatchM = 20;
    private const int MaxConfidence = 30;

    private sealed class Bin(double x, double z, bool timed)
    {
        public double X = x, Z = z;
        public int N = 1;
        public readonly bool Timed = timed;
    }

    private readonly Bin?[] _bins = new Bin?[Bins];
    private readonly HashSet<int> _changed = [];

    public int Filled { get; private set; }

    public void Clear()
    {
        Array.Clear(_bins);
        _changed.Clear();
        Filled = 0;
    }

    public void Learn(CarRow car, double trackLength)
    {
        if (car.PitStatus != 0 || car.DriverStatus == 0 || car.LapDistance < 0 || (car.X == 0 && car.Z == 0)) return;
        var bin = (int)Math.Floor(car.LapDistance / trackLength * Bins);
        if (bin is < 0 or >= Bins) return;

        var timed = LapRules.OnTimedLap(car);
        var cur = _bins[bin];
        if (cur is null)
        {
            _bins[bin] = new Bin(car.X, car.Z, timed);
            Filled++;
        }
        else if (timed && !cur.Timed)
        {
            _bins[bin] = new Bin(car.X, car.Z, timed);
        }
        else if (timed != cur.Timed)
        {
            return; // untimed data never touches a timed point
        }
        else if (Distance(car.X - cur.X, car.Z - cur.Z) <= MatchM)
        {
            cur.N = Math.Min(cur.N + 1, MaxConfidence);
            cur.X += (car.X - cur.X) / cur.N;
            cur.Z += (car.Z - cur.Z) / cur.N;
        }
        else if (timed && --cur.N <= 0)
        {
            _bins[bin] = new Bin(car.X, car.Z, timed);
        }
        else
        {
            return;
        }
        _changed.Add(bin);
    }

    public OutlinePoint?[] Points() => [.. _bins.Select(b => b is null ? null : new OutlinePoint(Round(b.X), Round(b.Z)))];

    /// <summary>Bins changed since the last call.</summary>
    public List<OutlinePatch> TakePatches()
    {
        var patches = _changed.Order().Select(i => new OutlinePatch(i, Round(_bins[i]!.X), Round(_bins[i]!.Z))).ToList();
        _changed.Clear();
        return patches;
    }

    private static double Distance(double dx, double dz) => Math.Sqrt(dx * dx + dz * dz);

    /// <summary>Decimetres are plenty for drawing the map.</summary>
    private static double Round(double metres) => Math.Round(metres, 1);
}
