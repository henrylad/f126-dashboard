using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;
using PitWall.Core.Laps;
using PitWall.Core.Live;
using PitWall.Server.Configuration;
using PitWall.Server.Realtime;

namespace PitWall.Server.Storage;

/// <summary>
/// Keeps your timed laps in a SQLite file so later sessions on the same track can
/// compare against them. A failure here disables the library and is logged; it
/// never stops the live dashboard.
/// </summary>
public sealed class LapLibrary : IDisposable
{
    /// <summary>Laps loaded from earlier sessions get ids above this, clear of a session's own ids.</summary>
    public const int SavedIdBase = 1_000_000;

    private readonly SqliteConnection? _db;
    private readonly ILogger<LapLibrary> _logger;
    private readonly TimeProvider _time;

    public LapLibrary(IOptions<PitWallOptions> options, TimeProvider time, ILogger<LapLibrary> logger)
    {
        _logger = logger;
        _time = time;
        var o = options.Value;
        if (!o.SavesLaps || string.IsNullOrWhiteSpace(o.DataPath)) return;
        try
        {
            var full = Path.GetFullPath(o.DataPath);
            var dir = Path.GetDirectoryName(full);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            _db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = o.DataPath, Pooling = false }.ToString());
            _db.Open();
            Exec("""
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS laps (
                    id            INTEGER PRIMARY KEY,
                    track_id      INTEGER NOT NULL,
                    track_length  INTEGER NOT NULL,
                    session_uid   TEXT    NOT NULL,
                    session_type  INTEGER NOT NULL,
                    lap_number    INTEGER NOT NULL,
                    time_ms       REAL    NOT NULL,
                    saved_at      TEXT    NOT NULL,
                    lap_json      TEXT    NOT NULL,
                    UNIQUE (session_uid, lap_number, time_ms)
                );
                CREATE INDEX IF NOT EXISTS laps_by_track ON laps (track_id, time_ms);
                """);
            logger.LapLibraryOpen(full);
        }
        catch (Exception e) when (e is SqliteException or IOException or UnauthorizedAccessException)
        {
            logger.LapLibraryFailed(e);
            _db?.Dispose();
            _db = null;
        }
    }

    public bool Enabled => _db is not null;

    /// <summary>Keeps a timed lap. Replaying the same recording again adds nothing.</summary>
    public void Save(Lap lap, SessionInfo session)
    {
        if (_db is null || lap.Kind != LapKind.Timed || lap.TimeMs <= 0) return;
        try
        {
            using var cmd = _db.CreateCommand();
            cmd.CommandText = """
                INSERT OR IGNORE INTO laps (track_id, track_length, session_uid, session_type, lap_number, time_ms, saved_at, lap_json)
                VALUES ($track, $length, $session, $type, $lap, $time, $at, $json)
                """;
            cmd.Parameters.AddWithValue("$track", session.TrackId);
            cmd.Parameters.AddWithValue("$length", session.TrackLength);
            cmd.Parameters.AddWithValue("$session", session.Uid);
            cmd.Parameters.AddWithValue("$type", session.SessionType);
            cmd.Parameters.AddWithValue("$lap", lap.Number);
            cmd.Parameters.AddWithValue("$time", lap.TimeMs);
            cmd.Parameters.AddWithValue("$at", _time.GetUtcNow().ToString("O"));
            cmd.Parameters.AddWithValue("$json", JsonSerializer.Serialize(lap, ServerMessageJsonContext.Default.Lap));
            cmd.ExecuteNonQuery();
        }
        catch (SqliteException e)
        {
            _logger.LapLibraryFailed(e);
        }
    }

    /// <summary>Your fastest laps on this track from other sessions, fastest first.</summary>
    public IReadOnlyList<Lap> Fastest(SessionInfo session, int count = 5)
    {
        if (_db is null) return [];
        try
        {
            using var cmd = _db.CreateCommand();
            cmd.CommandText = """
                SELECT id, session_type, saved_at, lap_json FROM laps
                WHERE track_id = $track AND track_length = $length AND session_uid <> $session
                ORDER BY time_ms LIMIT $count
                """;
            cmd.Parameters.AddWithValue("$track", session.TrackId);
            cmd.Parameters.AddWithValue("$length", session.TrackLength);
            cmd.Parameters.AddWithValue("$session", session.Uid);
            cmd.Parameters.AddWithValue("$count", count);
            using var reader = cmd.ExecuteReader();
            var laps = new List<Lap>();
            while (reader.Read())
            {
                var lap = JsonSerializer.Deserialize(reader.GetString(3), ServerMessageJsonContext.Default.Lap);
                if (lap is null) continue;
                laps.Add(lap with
                {
                    Id = SavedIdBase + reader.GetInt32(0),
                    CarIdx = -1,
                    Saved = new SavedLapInfo(DateTimeOffset.Parse(reader.GetString(2), System.Globalization.CultureInfo.InvariantCulture), reader.GetInt32(1)),
                });
            }
            return laps;
        }
        catch (Exception e) when (e is SqliteException or JsonException or FormatException)
        {
            _logger.LapLibraryFailed(e);
            return [];
        }
    }

    private void Exec(string sql)
    {
        using var cmd = _db!.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    public void Dispose() => _db?.Dispose();
}
