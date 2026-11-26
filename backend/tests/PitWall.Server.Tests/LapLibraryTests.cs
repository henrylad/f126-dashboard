using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PitWall.Core.Laps;
using PitWall.Core.Live;
using PitWall.Server.Configuration;
using PitWall.Server.Storage;

namespace PitWall.Server.Tests;

public sealed class LapLibraryTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "pitwall-tests-" + Guid.NewGuid().ToString("N"));

    private LapLibrary Open(TelemetrySource source = TelemetrySource.Udp, bool? save = null) =>
        new(Options.Create(new PitWallOptions { Source = source, SaveLaps = save, DataPath = Path.Combine(_dir, "pitwall.db") }),
            TimeProvider.System, NullLogger<LapLibrary>.Instance);

    private static SessionInfo Session(string uid, int track = 42, int length = 5470) =>
        new() { Uid = uid, TrackId = track, TrackLength = length, SessionType = 15 };

    private static Lap Lap(int id, double ms, LapKind kind = LapKind.Timed) => new()
    {
        Id = id,
        CarIdx = 0,
        Number = id,
        Kind = kind,
        TimeMs = ms,
        Sectors = [ms / 3, ms / 3, ms / 3],
        Samples = [new Sample(0, 0, 280, 1, 0, 7, 3e6, 1), new Sample(100, 1200, 300, 1, 0, 8, 2.9e6, 1)],
        Minis = [],
        Stats = new LapStats { TopSpeed = 300 },
    };

    [Fact]
    public void Earlier_sessions_on_the_same_track_come_back_fastest_first()
    {
        using (var library = Open())
        {
            library.Save(Lap(1, 83_000), Session("a"));
            library.Save(Lap(2, 82_400), Session("a"));
            library.Save(Lap(2, 82_400), Session("a")); // replayed again
            library.Save(Lap(3, 81_000, LapKind.Invalid), Session("a"));
            library.Save(Lap(4, 70_000), Session("a", track: 7));
        }

        using var reopened = Open();
        var laps = reopened.Fastest(Session("b"));

        Assert.Equal([82_400, 83_000], laps.Select(l => l.TimeMs));
        Assert.All(laps, l => Assert.True(l.Id > LapLibrary.SavedIdBase));
        Assert.All(laps, l => Assert.Equal(-1, l.CarIdx));
        Assert.All(laps, l => Assert.Equal(15, l.Saved?.SessionType));
        Assert.Equal(2, laps[0].Samples.Count);
        Assert.Equal(300, laps[0].Samples[1].Speed);
    }

    [Fact]
    public void The_current_session_is_not_its_own_history()
    {
        using var library = Open();
        library.Save(Lap(1, 83_000), Session("a"));

        Assert.Empty(library.Fastest(Session("a")));
    }

    [Fact]
    public void The_simulator_keeps_nothing_unless_asked()
    {
        using var sim = Open(TelemetrySource.Sim);
        Assert.False(sim.Enabled);
        using var asked = Open(TelemetrySource.Sim, save: true);
        Assert.True(asked.Enabled);
    }

    public void Dispose()
    {
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
    }
}
