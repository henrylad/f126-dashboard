using PitWall.Server.Recording;

namespace PitWall.Server.Tests;

public class RecordingFileTests
{
    [Fact]
    public async Task Reads_back_what_was_written_and_ignores_a_truncated_tail()
    {
        var path = Path.Combine(Path.GetTempPath(), $"pitwall-{Guid.NewGuid():N}.f1rec");
        try
        {
            using (var file = File.Create(path))
            {
                RecordingFile.WriteEntry(file, 0, [1, 2, 3]);
                RecordingFile.WriteEntry(file, 33.5, [4, 5]);
                file.Write([9, 9, 9, 9]); // a crash mid-entry
            }

            var packets = await RecordingFile.ReadAllAsync(path, TestContext.Current.CancellationToken);

            Assert.Equal(2, packets.Count);
            Assert.Equal([1, 2, 3], packets[0].Data);
            Assert.Equal(33.5, packets[1].AtMs);
            Assert.Equal([4, 5], packets[1].Data);
        }
        finally
        {
            File.Delete(path);
        }
    }
}
