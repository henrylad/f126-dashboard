namespace PitWall.Core.Laps;

/// <summary>What is known about a finished lap besides its samples.</summary>
public sealed record LapContext
{
    public required int Id { get; init; }
    public required int CarIdx { get; init; }
    public required int Number { get; init; }
    public required LapKind Kind { get; init; }
    public required double TimeMs { get; init; }
    public required double TrackLength { get; init; }
    public required double Sector2Start { get; init; }
    public required double Sector3Start { get; init; }
    public required IReadOnlyList<MiniSector?> Minis { get; init; }
    public double? FuelStartKg { get; init; }
    public double FuelEndKg { get; init; }
    public double? WearStartPct { get; init; }
    public double WearEndPct { get; init; }
    public int Compound { get; init; }
    public int TyreAge { get; init; }
}

public static class LapSummary
{
    /// <summary>Archived traces keep a sample every few metres.</summary>
    private const double KeepEveryM = 4;

    /// <summary>Linear interpolation of a channel at lap distance <paramref name="d"/>; null outside the samples.</summary>
    public static double? Interpolate(IReadOnlyList<Sample> samples, double d, Func<Sample, double> channel)
    {
        if (samples.Count == 0 || d < samples[0].D || d > samples[^1].D) return null;
        int lo = 0, hi = samples.Count - 1;
        while (hi - lo > 1)
        {
            var mid = (lo + hi) >> 1;
            if (samples[mid].D <= d) lo = mid; else hi = mid;
        }
        Sample a = samples[lo], b = samples[hi];
        var f = b.D == a.D ? 0 : (d - a.D) / (b.D - a.D);
        return channel(a) + (channel(b) - channel(a)) * f;
    }

    public static Lap Summarise(IReadOnlyList<Sample> samples, LapContext ctx)
    {
        var complete = ctx.Kind is LapKind.Timed or LapKind.Invalid;
        var s1End = Interpolate(samples, ctx.Sector2Start, s => s.T);
        var s2End = Interpolate(samples, ctx.Sector3Start, s => s.T);
        var fromLine = samples.Count > 0 && samples[0].D < 50;
        double?[] sectors =
        [
            fromLine ? s1End : null,
            s2End - s1End,
            complete && ctx.TimeMs > s2End ? ctx.TimeMs - s2End : null,
        ];

        double dist = 0, fullThrottle = 0, braking = 0, boost = 0, deployed = 0, harvested = 0, top = 0;
        var gearChanges = 0;
        for (var i = 0; i < samples.Count; i++)
        {
            var s = samples[i];
            top = Math.Max(top, s.Speed);
            if (i == 0) continue;
            var p = samples[i - 1];
            var ds = s.D - p.D;
            dist += ds;
            if (s.Throttle >= 0.98) fullThrottle += ds;
            if (s.Brake > 0.05) braking += ds;
            if (s.Mode == 3) boost += ds;
            var dE = s.Ers - p.Ers;
            if (dE > 0) harvested += dE; else deployed -= dE;
            if (s.Gear != p.Gear) gearChanges++;
        }
        double Pct(double x) => dist > 0 ? x / dist * 100 : 0;

        return new Lap
        {
            Id = ctx.Id,
            CarIdx = ctx.CarIdx,
            Number = ctx.Number,
            Kind = ctx.Kind,
            TimeMs = ctx.TimeMs,
            Sectors = sectors,
            Samples = Trim(samples),
            Minis = ctx.Minis,
            Stats = new LapStats
            {
                TopSpeed = top,
                AvgSpeed = complete && ctx.TimeMs > 0 ? ctx.TrackLength / (ctx.TimeMs / 1000) * 3.6 : null,
                FullThrottlePct = Pct(fullThrottle),
                BrakingPct = Pct(braking),
                DeployedJ = deployed,
                HarvestedJ = harvested,
                BoostPct = Pct(boost),
                ErsStartJ = samples.Count > 0 ? samples[0].Ers : 0,
                ErsEndJ = samples.Count > 0 ? samples[^1].Ers : 0,
                FuelUsedKg = ctx.FuelStartKg - ctx.FuelEndKg,
                WearDeltaPct = ctx.WearEndPct - ctx.WearStartPct,
                Compound = ctx.Compound,
                TyreAge = ctx.TyreAge,
                GearChanges = gearChanges,
            },
        };
    }

    /// <summary>Keeps a sample every few metres (plus the last) with rounded values, to keep history small.</summary>
    private static List<Sample> Trim(IReadOnlyList<Sample> samples)
    {
        var result = new List<Sample>();
        for (var i = 0; i < samples.Count; i++)
        {
            var s = samples[i];
            if (result.Count > 0 && s.D - result[^1].D < KeepEveryM && i != samples.Count - 1) continue;
            result.Add(new Sample(
                D: Round(s.D, 1),
                T: Round(s.T),
                Speed: Round(s.Speed),
                Throttle: Round(s.Throttle, 2),
                Brake: Round(s.Brake, 2),
                Gear: s.Gear,
                Ers: Round(s.Ers),
                Mode: s.Mode,
                Steer: Round(s.Steer, 2),
                Rpm: s.Rpm,
                GLat: Round(s.GLat, 2),
                GLon: Round(s.GLon, 2),
                SlipFront: s.SlipFront is { } f ? Round(f, 1) : null,
                SlipRear: s.SlipRear is { } r ? Round(r, 1) : null));
        }
        return result;
    }

    private static double Round(double value, int digits = 0) => Math.Round(value, digits, MidpointRounding.AwayFromZero);
}
