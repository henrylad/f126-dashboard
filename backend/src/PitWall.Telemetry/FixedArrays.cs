using System.Runtime.CompilerServices;

namespace PitWall.Telemetry;

// Fixed-size arrays embedded in packets. They are laid out inline, exactly as on
// the wire, so whole packets can be read and written as a single block of memory.

/// <summary>One entry per car slot.</summary>
[InlineArray(PacketFormat.MaxCars)]
public struct CarArray<T> where T : unmanaged
{
    private T _element;
}

/// <summary>Per-wheel values, always ordered rear-left, rear-right, front-left, front-right.</summary>
[InlineArray(4)]
public struct Wheels<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(4)]
public struct FixedArray4<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(8)]
public struct FixedArray8<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(12)]
public struct FixedArray12<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(21)]
public struct FixedArray21<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(50)]
public struct FixedArray50<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(64)]
public struct FixedArray64<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(100)]
public struct FixedArray100<T> where T : unmanaged
{
    private T _element;
}

[InlineArray(20)]
public struct FixedArray20<T> where T : unmanaged
{
    private T _element;
}
