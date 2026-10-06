using PitWall.Telemetry.Packets;

namespace PitWall.Simulator;

/// <summary>
/// A made-up circuit sampled every <see cref="Step"/> metres, with a speed profile
/// from grip, braking and traction limits.
/// </summary>
internal sealed class SimTrack
{
    public const double Length = 5470;
    public const double Step = 5; // metres between samples
    public const double VMax = 93; // m/s (~335 km/h)
    public const double LateralGrip = 44; // m/s² cornering grip
    public const double Braking = 40; // m/s²

    // A closed polygon whose corners are filleted with a radius that shrinks as the
    // corner gets sharper (90° corner ~37 m, small kinks ~200 m).
    private static readonly (double X, double Z)[] Waypoints =
    [
        (0, 0), (1100, 0), (1150, 280), (820, 320), (800, 520), (1350, 520), // T1–T5, hairpin at T6
        (1060, 640), (500, 720), (250, 930), (-350, 930), (-480, 760),
        (-380, 560), (-450, 470), (-360, 380), (-420, 140), // chicane, final corner
    ];

    public double[] X { get; }
    public double[] Z { get; }
    public double[] Curvature { get; }
    /// <summary>Target speed at each sample, m/s.</summary>
    public double[] Speed { get; }
    public int Count { get; }
    /// <summary>Active aero "straight mode" zones: long full-speed stretches.</summary>
    public IReadOnlyList<TrackZone> AeroZones { get; }

    public SimTrack()
    {
        var outline = FilletedOutline();
        (X, Z) = Resample(outline);
        Count = X.Length;
        Curvature = ComputeCurvature();
        Speed = ComputeSpeedProfile();
        AeroZones = FindAeroZones();
    }

    /// <summary>Sample index for a (possibly negative) total distance.</summary>
    public int IndexAt(double distance) => (int)((Math.Floor(distance / Step) % Count + Count) % Count);

    public bool InAeroZone(double lapFraction) => AeroZones.Any(z => lapFraction >= z.ZoneStart && lapFraction <= z.ZoneEnd);

    private static List<(double X, double Z)> FilletedOutline()
    {
        var raw = new List<(double, double)>();
        var w = Waypoints.Length;
        for (var k = 0; k < w; k++)
        {
            var (a, b, c) = (Waypoints[(k - 1 + w) % w], Waypoints[k], Waypoints[(k + 1) % w]);
            var l1 = Hypot(b.X - a.X, b.Z - a.Z);
            var l2 = Hypot(c.X - b.X, c.Z - b.Z);
            var u1 = ((b.X - a.X) / l1, (b.Z - a.Z) / l1);
            var u2 = ((c.X - b.X) / l2, (c.Z - b.Z) / l2);
            var turn = Math.Atan2(u1.Item1 * u2.Item2 - u1.Item2 * u2.Item1, u1.Item1 * u2.Item1 + u1.Item2 * u2.Item2);
            var sharp = Math.Abs(turn) / Math.PI; // 0 (straight) .. 1 (U-turn)
            var halfTan = Math.Tan(Math.Abs(turn) / 2);
            var r = Math.Min(18 + 300 * Math.Pow(1 - sharp, 4), 0.45 * Math.Min(l1, l2) / (halfTan == 0 ? Math.Tan(1e-6) : halfTan));
            var d = r * halfTan;
            var t1 = (X: b.X - u1.Item1 * d, Z: b.Z - u1.Item2 * d);
            double side = Math.Sign(turn) is var s && s != 0 ? s : 1;
            var centre = (X: t1.X - u1.Item2 * r * side, Z: t1.Z + u1.Item1 * r * side);
            var start = Math.Atan2(t1.Z - centre.Z, t1.X - centre.X);

            var steps = Math.Max(2, (int)Math.Ceiling(Math.Abs(turn) * r / 2));
            for (var j = 0; j < steps; j++)
            {
                var angle = start + turn * ((double)j / steps);
                raw.Add((centre.X + Math.Cos(angle) * r, centre.Z + Math.Sin(angle) * r));
            }
            // The straight to the next fillet is implied by the arc-length resampling.
        }
        return raw;
    }

    /// <summary>Evenly spaced samples along the closed outline, scaled to <see cref="Length"/>.</summary>
    private static (double[] X, double[] Z) Resample(List<(double X, double Z)> raw)
    {
        var m = raw.Count;
        var cum = new double[m + 1];
        for (var i = 1; i <= m; i++)
        {
            var (a, b) = (raw[i - 1], raw[i % m]);
            cum[i] = cum[i - 1] + Hypot(b.X - a.X, b.Z - a.Z);
        }
        var scale = Length / cum[m];
        var n = (int)Math.Round(Length / Step);
        var x = new double[n];
        var z = new double[n];
        var j = 0;
        for (var i = 0; i < n; i++)
        {
            var target = (double)i / n * cum[m];
            while (cum[j + 1] < target) j++;
            var f = (target - cum[j]) / (cum[j + 1] - cum[j]);
            var (a, b) = (raw[j], raw[(j + 1) % m]);
            x[i] = (a.X + (b.X - a.X) * f) * scale;
            z[i] = (a.Z + (b.Z - a.Z) * f) * scale;
        }
        return (x, z);
    }

    private double[] ComputeCurvature()
    {
        var curvature = new double[Count];
        for (var i = 0; i < Count; i++)
        {
            int p = (i - 3 + Count) % Count, q = (i + 3) % Count;
            var h1 = Math.Atan2(Z[i] - Z[p], X[i] - X[p]);
            var h2 = Math.Atan2(Z[q] - Z[i], X[q] - X[i]);
            var d = h2 - h1;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            curvature[i] = d / (3 * Step);
        }
        return curvature;
    }

    /// <summary>Grip limit, then braking (backward) and traction (forward) passes.</summary>
    private double[] ComputeSpeedProfile()
    {
        var n = Count;
        var v = new double[n];
        for (var i = 0; i < n; i++) v[i] = Math.Min(VMax, GripSpeed(i));
        for (var pass = 0; pass < 3; pass++)
        {
            for (var i = n - 1; i >= 0; i--) v[i] = Math.Min(v[i], Math.Sqrt(v[(i + 1) % n] * v[(i + 1) % n] + 2 * Braking * Step));
            for (var i = 0; i < n; i++)
            {
                var prev = v[(i - 1 + n) % n];
                var accel = Math.Max(2, 16 * (1 - prev / (VMax * 1.05)));
                v[i] = Math.Min(v[i], Math.Sqrt(prev * prev + 2 * accel * Step));
            }
        }
        return v;
    }

    /// <summary>Highest speed the curvature allows at sample <paramref name="i"/>.</summary>
    public double GripSpeed(int i) => Math.Sqrt(LateralGrip / Math.Max(Math.Abs(Curvature[i]), 1e-6));

    private List<TrackZone> FindAeroZones()
    {
        var zones = new List<TrackZone>();
        var runStart = -1;
        for (var i = 0; i <= Count; i++)
        {
            var fast = i < Count && Speed[i] > VMax * 0.8 && Math.Abs(Curvature[i]) < 0.004;
            if (fast && runStart < 0) runStart = i;
            if (!fast && runStart >= 0)
            {
                if ((i - runStart) * Step > 350) zones.Add(new TrackZone { ZoneStart = (float)runStart / Count, ZoneEnd = (float)(i - 1) / Count });
                runStart = -1;
            }
        }
        return [.. zones.Take(8)];
    }

    private static double Hypot(double dx, double dz) => Math.Sqrt(dx * dx + dz * dz);
}
