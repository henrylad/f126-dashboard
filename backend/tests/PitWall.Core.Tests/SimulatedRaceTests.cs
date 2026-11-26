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
    public void Player_detail_carries_chassis_setup_and_lap_data()
    {
        var player = Run(seconds: 5).State.Snapshot().Player;

        Assert.NotNull(player);
        Assert.NotNull(player.Chassis);
        Assert.Equal(4, player.Chassis.WheelVertForce.Count);
        Assert.All(player.Chassis.WheelVertForce, f => Assert.True(f > 0));
        Assert.True(player.Chassis.FrontAeroHeight > 0);
        Assert.NotNull(player.Setup);
        Assert.Equal(55, player.Setup.BrakeBias);
        Assert.Equal(1, player.Race.Position);
        Assert.Equal(8_500_000, player.ErsHarvestLimitLapJ);
        Assert.Equal(110, player.FuelCapacityKg);
        Assert.NotNull(player.TyreSets);
        Assert.Equal(20, player.TyreSets.Sets.Count);
        Assert.Single(player.TyreSets.Sets, s => s.Fitted);
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

    [Fact]
    public void Lap_samples_carry_steering_revs_g_forces_and_the_players_slip()
    {
        var (_, laps) = Run(seconds: 200);
        var mine = laps.PlayerBestLap!.Samples;
        var theirs = laps.DriverBests()[0].Samples;

        Assert.Contains(mine, s => s.Rpm > 10_000);
        Assert.Contains(mine, s => Math.Abs(s.Steer) > 0.2);
        Assert.Contains(mine, s => Math.Abs(s.GLat) > 1);
        Assert.Contains(mine, s => s.GLon < -1);
        Assert.All(mine, s => Assert.NotNull(s.SlipRear));
        // Other cars send no extended motion.
        Assert.All(theirs, s => Assert.Null(s.SlipRear));
        Assert.Contains(theirs, s => s.Rpm > 10_000);
    }
}
