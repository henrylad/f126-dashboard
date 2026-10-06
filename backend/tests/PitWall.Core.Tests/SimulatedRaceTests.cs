using PitWall.Core.Laps;
using PitWall.Core.Live;
using PitWall.Simulator;

namespace PitWall.Core.Tests;

/// <summary>End to end: simulator packets → decoder → aggregator → lap tracker.</summary>
public class SimulatedRaceTests
{
    private static (TelemetryAggregator State, LapTracker Laps) Run(int seconds)
    {
        var sim = new RaceSimulator(new Random(42));
        var state = new TelemetryAggregator(TelemetrySource.Sim, TimeProvider.System);
        var laps = new LapTracker();
        foreach (var packet in sim.Start()) state.Ingest(packet);
        for (var tick = 0; tick < seconds * RaceSimulator.TickHz; tick++)
        {
            foreach (var packet in sim.Tick()) state.Ingest(packet);
            laps.Update(state.Snapshot());
        }
        return (state, laps);
    }

    [Fact]
    public void Snapshot_shows_the_whole_grid_and_the_player()
    {
        var snapshot = Run(seconds: 5).State.Snapshot();

        Assert.Equal(22, snapshot.Cars.Count);
        Assert.Equal(Enumerable.Range(1, 22), snapshot.Cars.Select(c => c.Position));
        Assert.Contains(snapshot.Cars, c => c.IsPlayer && c.Name == "VERSTAPPEN" && c.TeamId == 478);
        Assert.NotNull(snapshot.Session);
        Assert.Equal(5470, snapshot.Session.TrackLength);
        Assert.NotEmpty(snapshot.Session.AeroZonesFull);
        Assert.NotNull(snapshot.Player);
        Assert.True(snapshot.Player.Speed > 100);
        Assert.Contains(snapshot.Events, e => e.Code == "LGOT");
        Assert.Null(snapshot.WrongFormat);
    }

    [Fact]
    public void Laps_are_recorded_for_the_player_and_the_field()
    {
        // Lap 1 starts on the grid, so it takes two more laps for a timed lap to exist.
        var (_, laps) = Run(seconds: 200);

        Assert.Contains(laps.Laps, l => l.Kind == LapKind.Timed);
        Assert.NotNull(laps.PlayerBestLap);
        Assert.InRange(laps.PlayerBestLap.TimeMs, 60_000, 90_000);
        Assert.NotEmpty(laps.DriverBests());
        Assert.True(laps.OutlineFilled > LapTracker.OutlineBins * 0.9);
    }
}
