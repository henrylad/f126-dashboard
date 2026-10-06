using System.Buffers.Binary;

namespace PitWall.Server.Recording;

/// <summary>A packet and when it arrived, in ms since the recording started.</summary>
public readonly record struct RecordedPacket(double AtMs, byte[] Data);

/// <summary>
/// Raw packet recordings (*.f1rec). Each packet is stored as
/// [f64 ms since start][u32 length][bytes], little-endian.
/// </summary>
public static class RecordingFile
{
    private const int EntryHeaderSize = 12;

    public static async Task<List<RecordedPacket>> ReadAllAsync(string path, CancellationToken ct)
    {
        var data = await File.ReadAllBytesAsync(path, ct);
        var packets = new List<RecordedPacket>();
        for (var offset = 0; offset + EntryHeaderSize <= data.Length;)
        {
            var at = BinaryPrimitives.ReadDoubleLittleEndian(data.AsSpan(offset));
            var length = (int)BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(offset + 8));
            offset += EntryHeaderSize;
            if (length < 0 || offset + length > data.Length) break; // truncated last entry
            packets.Add(new RecordedPacket(at, data.AsSpan(offset, length).ToArray()));
            offset += length;
        }
        return packets;
    }

    public static void WriteEntry(Stream stream, double atMs, ReadOnlySpan<byte> packet)
    {
        Span<byte> header = stackalloc byte[EntryHeaderSize];
        BinaryPrimitives.WriteDoubleLittleEndian(header, atMs);
        BinaryPrimitives.WriteUInt32LittleEndian(header[8..], (uint)packet.Length);
        stream.Write(header);
        stream.Write(packet);
    }
}

/// <summary>Appends every packet it is given to a recording file.</summary>
public sealed class PacketRecorder(string path, TimeProvider time) : IDisposable
{
    private readonly FileStream _file = new(path, FileMode.Create, FileAccess.Write, FileShare.Read);
    private readonly long _start = time.GetTimestamp();

    public string Path => path;

    public void Write(ReadOnlySpan<byte> packet) =>
        RecordingFile.WriteEntry(_file, time.GetElapsedTime(_start).TotalMilliseconds, packet);

    public void Dispose() => _file.Dispose();
}
