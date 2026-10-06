using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Unicode;

namespace PitWall.Telemetry;

/// <summary>Fixed 32-byte, null-terminated UTF-8 string (driver names).</summary>
[InlineArray(Length)]
public struct Utf8String32
{
    public const int Length = 32;

    private byte _element;

    public static Utf8String32 From(string value)
    {
        var result = default(Utf8String32);
        Span<byte> bytes = result;
        // Leave room for the terminator; longer names are truncated.
        Utf8.FromUtf16(value, bytes[..^1], out _, out _);
        return result;
    }

    public override readonly string ToString()
    {
        ReadOnlySpan<byte> bytes = this;
        var end = bytes.IndexOf((byte)0);
        return Encoding.UTF8.GetString(end < 0 ? bytes : bytes[..end]);
    }
}
