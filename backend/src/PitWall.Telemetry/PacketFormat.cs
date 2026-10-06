namespace PitWall.Telemetry;

/// <summary>Constants of the F1 25 "2026 Season Pack" UDP format.</summary>
public static class PacketFormat
{
    /// <summary>The <c>packetFormat</c> header value this library understands.</summary>
    public const ushort Version = 2026;

    public const int MaxCars = 24;

    /// <summary>Default UDP port the game sends to.</summary>
    public const int DefaultPort = 20777;

    /// <summary>
    /// The 2026 format sends G-forces as int16 instead of float. The official scale
    /// factor could not be verified; adjust here if the G meter reads wrong in-game.
    /// </summary>
    public const float GForceScale = 1000f;

    /// <summary>Direction vectors are normalised int16 (documented).</summary>
    public const float DirectionScale = 32767f;
}
