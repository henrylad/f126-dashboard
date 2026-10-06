using System.Runtime.InteropServices;

namespace PitWall.Telemetry.Packets;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SessionPacket : IPacket
{
    public PacketHeader Header;
    public byte Weather;
    public sbyte TrackTemperature;
    public sbyte AirTemperature;
    public byte TotalLaps;
    public ushort TrackLength;
    public byte SessionType;
    public sbyte TrackId;
    public byte Formula;
    public ushort SessionTimeLeft;
    public ushort SessionDuration;
    public byte PitSpeedLimit;
    public bool GamePaused;
    public bool IsSpectating;
    public byte SpectatorCarIndex;
    public bool SliProNativeSupport;
    public byte NumMarshalZones;
    public FixedArray21<MarshalZone> MarshalZones;
    public byte SafetyCarStatus;
    public bool NetworkGame;
    public byte NumWeatherForecastSamples;
    public FixedArray64<WeatherForecastSample> WeatherForecastSamples;
    public byte ForecastAccuracy;
    public byte AiDifficulty;
    public uint SeasonLinkIdentifier;
    public uint WeekendLinkIdentifier;
    public uint SessionLinkIdentifier;
    public byte PitStopWindowIdealLap;
    public byte PitStopWindowLatestLap;
    public byte PitStopRejoinPosition;
    public byte SteeringAssist;
    public byte BrakingAssist;
    public byte GearboxAssist;
    public byte PitAssist;
    public byte PitReleaseAssist;
    public byte ErsAssist;
    public byte DrsAssist;
    public byte DynamicRacingLine;
    public byte DynamicRacingLineType;
    public byte GameMode;
    public byte RuleSet;
    public uint TimeOfDay;
    public byte SessionLength;
    public byte SpeedUnitsLeadPlayer;
    public byte TemperatureUnitsLeadPlayer;
    public byte SpeedUnitsSecondaryPlayer;
    public byte TemperatureUnitsSecondaryPlayer;
    public byte NumSafetyCarPeriods;
    public byte NumVirtualSafetyCarPeriods;
    public byte NumRedFlagPeriods;
    public byte EqualCarPerformance;
    public byte RecoveryMode;
    public byte FlashbackLimit;
    public byte SurfaceType;
    public byte LowFuelMode;
    public byte RaceStarts;
    public byte TyreTemperature;
    public byte PitLaneTyreSim;
    public byte CarDamage;
    public byte CarDamageRate;
    public byte Collisions;
    public byte CollisionsOffForFirstLapOnly;
    public byte MpUnsafePitRelease;
    public byte MpOffForGriefing;
    public byte CornerCuttingStringency;
    public byte ParcFermeRules;
    public byte PitStopExperience;
    public byte SafetyCar;
    public byte SafetyCarExperience;
    public byte FormationLap;
    public byte FormationLapExperience;
    public byte RedFlags;
    public byte AffectsLicenceLevelSolo;
    public byte AffectsLicenceLevelMp;
    public byte NumSessionsInWeekend;
    public FixedArray12<byte> WeekendStructure;
    public float Sector2LapDistanceStart;
    public float Sector3LapDistanceStart;
    /// <summary>0 = full, 1 = partial.</summary>
    public byte ActiveAeroTrackStatus;
    public byte NumActiveAeroZonesFull;
    public FixedArray8<TrackZone> ActiveAeroZonesFull;
    public byte NumActiveAeroZonesPartial;
    public FixedArray8<TrackZone> ActiveAeroZonesPartial;
    public byte NumDrsZones;
    public FixedArray4<TrackZone> DrsZones;
    public float StartReactionTime;
    public byte AntiLockBrakesAssist;
    public byte TractionControlAssist;
    public byte DynamicRacingLineHiVis;
    public byte DynamicRacingLineColourBlind;
    public byte RecurringRewindPrompt;

    readonly PacketHeader IPacket.Header => Header;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct MarshalZone
{
    /// <summary>Fraction (0..1) of the way through the lap.</summary>
    public float ZoneStart;
    /// <summary>-1 invalid, 0 none, 1 green, 2 blue, 3 yellow.</summary>
    public sbyte ZoneFlag;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct WeatherForecastSample
{
    public byte SessionType;
    public byte TimeOffset;
    public byte Weather;
    public sbyte TrackTemperature;
    public sbyte TrackTemperatureChange;
    public sbyte AirTemperature;
    public sbyte AirTemperatureChange;
    public byte RainPercentage;
}

/// <summary>Active aero or DRS zone, as lap fractions (0..1).</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct TrackZone
{
    public float ZoneStart;
    public float ZoneEnd;
}
