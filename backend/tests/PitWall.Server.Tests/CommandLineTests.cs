using PitWall.Server.Configuration;

namespace PitWall.Server.Tests;

public class CommandLineTests
{
    [Fact]
    public void Expands_short_flags_into_configuration_keys()
    {
        var args = CommandLine.Expand(["--sim", "--record", "recordings/race.f1rec", "--udp-port", "20778", "--port", "8080"]);

        Assert.Equal(
            ["--PitWall:Source=Sim", "--PitWall:RecordPath=recordings/race.f1rec", "--PitWall:UdpPort=20778", "--urls=http://0.0.0.0:8080"],
            args);
    }

    [Fact]
    public void Replay_selects_the_replay_source()
    {
        Assert.Equal(["--PitWall:Source=Replay", "--PitWall:ReplayPath=s.f1rec"], CommandLine.Expand(["--replay", "s.f1rec"]));
    }

    [Fact]
    public void Passes_other_arguments_through() =>
        Assert.Equal(["--environment", "Production"], CommandLine.Expand(["--environment", "Production"]));

    [Fact]
    public void Rejects_a_flag_without_its_value() =>
        Assert.Throws<ArgumentException>(() => CommandLine.Expand(["--record"]));
}
