using PitWall.Core.Live;

namespace PitWall.Core.Laps;

/// <summary>Where a car was on its lap at the previous update.</summary>
internal readonly record struct LapPosition(int Lap, double D, double T);

internal static class LapRules
{
    /// <summary>Ignore pit/garage status for this long after a lap starts (status can lag the line).</summary>
    public const double LapStartGraceMs = 1500;

    /// <summary>On a timed lap on track — not in the garage, pit lane, an out-lap or an in-lap.</summary>
    public static bool OnTimedLap(CarRow c) => c.PitStatus == 0 && c.DriverStatus is 1 or 4;

    /// <summary>
    /// Whether the car started a new lap since the previous update. The lap number
    /// normally increments at the line, but after leaving the pits the game can
    /// restart the lap timer at the line without changing the lap number.
    /// </summary>
    public static bool LapStarted(LapPosition prev, CarRow c, double trackLength)
    {
        if (c.Lap != prev.Lap) return true;
        var timerReset = c.CurrentLapMs + 1000 < prev.T;
        var crossedLine = c.LapDistance < 300 && (prev.D < 0 || prev.D > trackLength - 300);
        return timerReset && crossedLine;
    }
}
