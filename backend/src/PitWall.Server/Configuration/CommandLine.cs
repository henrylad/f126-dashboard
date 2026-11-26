namespace PitWall.Server.Configuration;

/// <summary>
/// Short command-line flags, translated into regular configuration keys so they
/// can equally be set in appsettings.json or environment variables (PitWall__Source=Sim).
/// </summary>
/// <remarks>
/// <code>
///   --sim                 PitWall:Source=Sim
///   --replay &lt;file&gt;       PitWall:Source=Replay, PitWall:ReplayPath=&lt;file&gt;
///   --record &lt;file&gt;       PitWall:RecordPath=&lt;file&gt;
///   --udp-port &lt;n&gt;        PitWall:UdpPort=&lt;n&gt;
///   --port &lt;n&gt;            urls=http://0.0.0.0:&lt;n&gt;
///   --data &lt;file&gt;         PitWall:DataPath=&lt;file&gt;
///   --save-laps           PitWall:SaveLaps=true  (the simulator doesn't save by default)
///   --no-save-laps        PitWall:SaveLaps=false
/// </code>
/// </remarks>
public static class CommandLine
{
    public static string[] Expand(IReadOnlyList<string> args)
    {
        var result = new List<string>();
        for (var i = 0; i < args.Count; i++)
        {
            string? Value() => i + 1 < args.Count ? args[++i] : throw new ArgumentException($"{args[i]} needs a value.");

            switch (args[i])
            {
                case "--sim":
                    result.Add($"--{PitWallOptions.Section}:Source=Sim");
                    break;
                case "--replay":
                    result.Add($"--{PitWallOptions.Section}:Source=Replay");
                    result.Add($"--{PitWallOptions.Section}:ReplayPath={Value()}");
                    break;
                case "--record":
                    result.Add($"--{PitWallOptions.Section}:RecordPath={Value()}");
                    break;
                case "--udp-port":
                    result.Add($"--{PitWallOptions.Section}:UdpPort={Value()}");
                    break;
                case "--data":
                    result.Add($"--{PitWallOptions.Section}:DataPath={Value()}");
                    break;
                case "--save-laps":
                    result.Add($"--{PitWallOptions.Section}:SaveLaps=true");
                    break;
                case "--no-save-laps":
                    result.Add($"--{PitWallOptions.Section}:SaveLaps=false");
                    break;
                case "--port":
                    result.Add($"--urls=http://0.0.0.0:{Value()}");
                    break;
                default:
                    result.Add(args[i]);
                    break;
            }
        }
        return [.. result];
    }
}
