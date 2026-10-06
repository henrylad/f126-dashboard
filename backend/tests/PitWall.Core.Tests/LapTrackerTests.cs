using PitWall.Core.Laps;
using PitWall.Core.Live;

namespace PitWall.Core.Tests;

public class LapTrackerTests
{
    private const double Len = 2500; // 25 mini sectors of 100 m
    private const double FrameMs = 1000.0 / 30;

    private static Snapshot Frame(string uid, IReadOnlyList<CarRow> cars, double sector2 = 0, double sector3 = 0) => new()
    {
        Session = new SessionInfo { Uid = uid, TrackLength = (int)Len, Sector2Start = sector2, Sector3Start = sector3 },
        Cars = cars,
    };

    /// <summary>Drives cars at constant speeds (m/s, per lap) and feeds 30 Hz snapshots.</summary>
    private static void Drive(LapTracker tracker, double[][] speeds, double seconds)
    {
        const double dt = 1.0 / 30;
        var dist = new double[speeds.Length];
        var lapStart = new double[speeds.Length];
        var lastLap = new long[speeds.Length];
        for (double t = 0; t <= seconds; t += dt)
        {
            var cars = speeds.Select((_, i) =>
            {
                var lap = (int)Math.Floor(dist[i] / Len) + 1;
                return new CarRow
                {
                    Idx = i, Lap = lap, LapDistance = dist[i] - (lap - 1) * Len, CurrentLapMs = (t - lapStart[i]) * 1000,
                    LastLapMs = lastLap[i], IsPlayer = i == 0, DriverStatus = 4,
                };
            }).ToList();
            tracker.Update(Frame("u", cars));

            for (var i = 0; i < speeds.Length; i++)
            {
                var before = (int)Math.Floor(dist[i] / Len);
                var speed = speeds[i][Math.Min(before, speeds[i].Length - 1)];
                dist[i] += speed * dt;
                if (Math.Floor(dist[i] / Len) > before)
                {
                    // Exact crossing time so lastLapMs is correct.
                    var over = (dist[i] - Math.Floor(dist[i] / Len) * Len) / speed;
                    var cross = t + dt - over;
                    lastLap[i] = (long)Math.Round((cross - lapStart[i]) * 1000);
                    lapStart[i] = cross;
                }
            }
        }
    }

    [Fact]
    public void Mini_sectors_are_timed_to_the_millisecond_and_coloured()
    {
        var tracker = new LapTracker();
        // Player: 50 m/s on lap 1, 55 m/s on lap 2. Rival: always 40 m/s.
        Drive(tracker, [[50, 55], [40]], 50 + 30);

        var lap1 = tracker.LastMinis;
        // Lap 1 mini sector 0 wasn't observed from its start; the rest are 100 m / 50 m/s.
        Assert.Null(lap1[0]);
        for (var k = 1; k < LapTracker.MiniSectors; k++)
        {
            Assert.InRange(lap1[k]!.Value.Ms, 1998, 2002);
            Assert.Equal(MiniColour.FastestOverall, lap1[k]!.Value.Colour);
        }
        // Lap 2 in progress at 55 m/s: faster than everything → purple, timed from the line.
        var done = tracker.Minis.Where(m => m is not null).ToList();
        Assert.True(done.Count > 5);
        // The test model drives the step that crosses the line at the old speed (≤3 ms off).
        Assert.InRange(tracker.Minis[0]!.Value.Ms, 100000 / 55.0 - 5, 100000 / 55.0 + 5);
        Assert.All(done, m => Assert.Equal(MiniColour.FastestOverall, m!.Value.Colour));
    }

    [Fact]
    public void Slower_lap_shows_yellow_and_a_pb_that_is_not_overall_shows_green()
    {
        var tracker = new LapTracker();
        // Rival sets 55 m/s from lap 1; player does 50 then 45 then 52.
        Drive(tracker, [[50, 45, 52], [55]], 50 + 2500 / 45.0 + 30);

        // Mini 0 had no lap-1 time (not seen from its start), so it is a first PB; skip it.
        var slow = tracker.LastMinis.Skip(1).Where(m => m is not null).ToList();
        Assert.True(slow.Count > 20);
        Assert.All(slow, m => Assert.Equal(MiniColour.SlowerThanBest, m!.Value.Colour));
        var pb = tracker.Minis.Where(m => m is not null).ToList();
        Assert.True(pb.Count > 5);
        Assert.All(pb, m => Assert.Equal(MiniColour.PersonalBest, m!.Value.Colour));
    }

    // --- pit lane / out-lap scenario -------------------------------------------

    /// <summary>Player-only session on a straight "track" along x, so position = lap distance.</summary>
    private sealed class PitDriver(LapTracker tracker)
    {
        private double _fuel = 50, _wear;

        public void Frame(int lap, double d, double t, int driverStatus = 1, int pitStatus = 0, long lastLapMs = 0, double offsetZ = 0)
        {
            var car = new CarRow
            {
                Idx = 0, IsPlayer = true, Lap = lap, LapDistance = d, CurrentLapMs = t,
                DriverStatus = driverStatus, PitStatus = pitStatus, LastLapMs = lastLapMs,
                X = d, Z = offsetZ,
                Speed = 180, Throttle = 1, Brake = 0, Gear = 7,
                // Battery drains 1 kJ per metre in the first half of each lap (Boost there), charges in the second half.
                ErsStoreJ = 3e6 - Math.Min(d, Len / 2) * 1000 + Math.Max(0, d - Len / 2) * 1000,
                ErsDeployMode = d < Len / 2 ? 3 : 1,
                FuelKg = _fuel, TyreWearAvg = _wear, Compound = 16, TyreAge = 3,
            };
            _fuel -= 0.001;
            _wear += 0.0005;
            tracker.Update(LapTrackerTests.Frame("pits", [car], sector2: 1000, sector3: 2000));
        }
    }

    /// <summary>Garage → pit lane → out-lap → line crossed with a timer reset (same lap number) → flying laps → in-lap.</summary>
    private static LapTracker PitScenario(int flyingLaps = 2)
    {
        var tracker = new LapTracker();
        var car = new PitDriver(tracker);
        double t = 0;
        // Garage: 3 s parked 60 m off the track.
        for (var i = 0; i < 90; i++) car.Frame(1, Len - 400, t += FrameMs, driverStatus: 0, pitStatus: 2, offsetZ: 60);
        // Pit lane (flagged) then the pit-exit road (not flagged), 30 m off the track.
        for (var d = Len - 400; d < Len - 100; d += 22.0 / 30) car.Frame(1, d, t += FrameMs, driverStatus: 3, pitStatus: 1, offsetZ: 30);
        for (var d = Len - 100; d < Len; d += 30.0 / 30) car.Frame(1, d, t += FrameMs, driverStatus: 3, offsetZ: 30 * (Len - d) / 100);

        // Cross the line: timer resets, lap number unchanged, status still "out lap" briefly.
        var lap = 1;
        long lastLapMs = 0;
        for (var n = 0; n < flyingLaps; n++)
        {
            // 50 m/s: frame f is at f × 1.667 m and f × 33.3 ms, so the lap takes exactly 50 s.
            for (var f = 0; f * 50.0 / 30 < Len; f++)
                car.Frame(lap, f * 50.0 / 30, f * FrameMs, driverStatus: f * FrameMs < 500 && n == 0 ? 3 : 1, lastLapMs: lastLapMs);
            lastLapMs = 50_000;
            lap++;
        }

        // In-lap into the pit entry road (not flagged yet), 25 m off the track.
        t = 0;
        for (double d = 0; d < Len - 300; d += 50.0 / 30) car.Frame(lap, d, t += FrameMs, driverStatus: 2, lastLapMs: lastLapMs);
        for (var d = Len - 300; d < Len - 50; d += 25.0 / 30) car.Frame(lap, d, t += FrameMs, driverStatus: 2, lastLapMs: lastLapMs, offsetZ: 25);
        return tracker;
    }

    [Fact]
    public void First_flying_lap_after_an_out_lap_is_fully_timed_even_when_the_lap_number_does_not_change_at_the_line()
    {
        var best = PitScenario().PlayerBestLap;

        Assert.NotNull(best);
        Assert.Equal(1, best.Number);
        Assert.InRange(best.TimeMs, 49_950, 50_050);
        Assert.Equal(LapTracker.MiniSectors, best.Minis.Count(m => m is not null));
        Assert.All(best.Minis, m =>
        {
            Assert.InRange(m!.Value.Ms, 1995, 2005);
            Assert.Equal(MiniColour.FastestOverall, m.Value.Colour);
        });
    }

    [Fact]
    public void Out_lap_and_in_lap_mini_sectors_are_not_counted()
    {
        var tracker = PitScenario();

        var inLap = tracker.Minis.Where(m => m is not null).ToList();
        Assert.True(inLap.Count > 5);
        Assert.All(inLap, m => Assert.Equal(MiniColour.NotCounted, m!.Value.Colour));
        // The out-lap's pit exit road must not have set a (slow) best: the flying lap was purple everywhere.
        Assert.All(tracker.PlayerBestLap!.Minis, m => Assert.Equal(MiniColour.FastestOverall, m!.Value.Colour));
    }

    [Theory]
    [InlineData(2)]
    [InlineData(1)] // only one flying lap before pitting: the pit entry road still cannot bend the map
    public void Track_map_survives_the_garage_pit_lane_and_pit_entry_road(int flyingLaps)
    {
        var tracker = PitScenario(flyingLaps);

        var offTrack = tracker.Outline.Count(p => p is not null && Math.Abs(p.Z) > 5);
        Assert.Equal(0, offTrack);
        if (flyingLaps == 2) Assert.True(tracker.OutlineFilled > LapTracker.OutlineBins * 0.95);
    }

    [Fact]
    public void Every_lap_is_archived_with_its_kind_sectors_and_stats()
    {
        var tracker = PitScenario();

        Assert.Equal([LapKind.Out, LapKind.Timed, LapKind.Timed], tracker.Laps.Select(l => l.Kind));
        var fly1 = tracker.Laps[1];
        var fly2 = tracker.Laps[2];
        Assert.NotEqual(fly1.Id, fly2.Id);
        // 50 m/s with sectors at 1000 m and 2000 m → 20 s, 20 s, 10 s.
        foreach (var lap in new[] { fly1, fly2 })
        {
            Assert.Equal(50_000, lap.TimeMs);
            Assert.InRange(lap.Sectors[0]!.Value, 19_960, 20_040);
            Assert.InRange(lap.Sectors[1]!.Value, 19_960, 20_040);
            Assert.InRange(lap.Sectors[2]!.Value, 9_960, 10_040);
            Assert.InRange(lap.Stats.BoostPct, 49, 51);
            Assert.InRange(lap.Stats.DeployedJ, 1.23e6, 1.27e6);
            Assert.InRange(lap.Stats.HarvestedJ, 1.23e6, 1.27e6);
            Assert.InRange(lap.Stats.AvgSpeed!.Value, 179.5, 180.5);
            Assert.InRange(lap.Stats.FuelUsedKg!.Value, 1, 2);
            Assert.True(lap.Samples.Count < 700, "trace is trimmed for history");
        }
    }

    [Fact]
    public void Other_drivers_fastest_laps_are_recorded_with_the_same_data()
    {
        var tracker = new LapTracker();
        // Player 50 m/s then 55 m/s; rival 52 m/s then 48 m/s.
        Drive(tracker, [[50, 55], [52, 48]], 50 + 2500 / 52.0 + 2500 / 48.0 + 5);

        var rival = Assert.Single(tracker.DriverBests());
        Assert.Equal(1, rival.CarIdx);
        Assert.Equal(2, rival.Number); // lap 1 started on the grid unseen; lap 2 is the first full timed lap
        Assert.InRange(rival.TimeMs, 2500 / 48.0 * 1000 - 40, 2500 / 48.0 * 1000 + 40);
        Assert.True(rival.Samples.Count > 100);
        Assert.Equal(LapTracker.MiniSectors, rival.Minis.Count(m => m is not null));
        Assert.All(tracker.Laps, l => Assert.Equal(0, l.CarIdx));
    }

    // --- history and deltas ------------------------------------------------------

    [Fact]
    public void Deltas_replay_into_the_same_state_as_the_history()
    {
        var tracker = new LapTracker();
        var client = new ClientModel();
        var car = new PitDriver(tracker);

        // Drive two laps, applying a delta after every frame like the broadcaster does.
        double t = 0;
        for (var lap = 1; lap <= 3; lap++)
        {
            t = 0;
            for (var f = 0; f * 50.0 / 30 < Len; f++)
            {
                car.Frame(lap, f * 50.0 / 30, t += FrameMs, lastLapMs: lap > 1 ? 50_000 : 0);
                client.Apply(tracker.TakeDelta());
            }
        }
        // A flashback trims the current lap; the delta must say so.
        car.Frame(3, 1000, 20_000);
        client.Apply(tracker.TakeDelta());

        var history = tracker.History();
        Assert.Equal(history.Current, client.Current);
        Assert.Equal(history.Laps.Select(l => l.Id), client.Laps.Select(l => l.Id));
        Assert.Equal(history.Outline.Count(p => p is not null), client.Outline.Count(p => p is not null));
        Assert.True(client.Laps.Count >= 2);
    }

    [Fact]
    public void A_new_session_starts_a_new_generation()
    {
        var tracker = new LapTracker();
        Drive(tracker, [[50]], 5);
        var first = tracker.Generation;

        tracker.Update(Frame("other", [new CarRow { Idx = 0, IsPlayer = true, Lap = 1, DriverStatus = 4 }]));

        Assert.Equal(first + 1, tracker.Generation);
        Assert.Empty(tracker.Laps);
        Assert.Equal("other", tracker.SessionUid);
    }

    /// <summary>What the dashboard does with deltas (mirrors frontend/src/laps/lapView.ts).</summary>
    private sealed class ClientModel
    {
        public List<Sample> Current { get; } = [];
        public List<Lap> Laps { get; } = [];
        public OutlinePoint?[] Outline { get; } = new OutlinePoint?[LapTracker.OutlineBins];

        public void Apply(LapDelta delta)
        {
            Assert.True(delta.Current.From <= Current.Count, "a delta never skips samples");
            Current.RemoveRange(delta.Current.From, Current.Count - delta.Current.From);
            Current.AddRange(delta.Current.Samples);
            Laps.RemoveAll(l => delta.RemovedLapIds.Contains(l.Id));
            Laps.AddRange(delta.AddedLaps.Where(a => Laps.All(l => l.Id != a.Id)));
            foreach (var p in delta.Outline) Outline[p.I] = new OutlinePoint(p.X, p.Z);
        }
    }
}
