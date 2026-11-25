using PitWall.Telemetry;
using PitWall.Telemetry.Packets;

namespace PitWall.Simulator;

/// <summary>
/// Synthetic 22-car race that emits genuine packetFormat 2026 packets, so the whole
/// pipeline (decoder → state → dashboard) runs without the game. Call
/// <see cref="Tick"/> <see cref="TickHz"/> times a second.
/// </summary>
public sealed class RaceSimulator
{
    public const int TickHz = 30;

    private const double Dt = 1.0 / TickHz;
    private const int TotalLaps = 30;
    private const sbyte TrackId = 42; // Madrid
    private const double ErsMaxJ = 4_000_000;

    private static readonly (string Name, ushort TeamId, byte Number)[] Grid =
    [
        ("VERSTAPPEN", 478, 1), ("HADJAR", 478, 6), ("NORRIS", 484, 4), ("PIASTRI", 484, 81),
        ("LECLERC", 477, 16), ("HAMILTON", 477, 44), ("RUSSELL", 476, 63), ("ANTONELLI", 476, 12),
        ("ALONSO", 480, 14), ("STROLL", 480, 18), ("ALBON", 479, 23), ("SAINZ", 479, 55),
        ("GASLY", 481, 10), ("COLAPINTO", 481, 43), ("LAWSON", 482, 30), ("LINDBLAD", 482, 41),
        ("OCON", 483, 31), ("BEARMAN", 483, 87), ("HULKENBERG", 485, 27), ("BORTOLETO", 485, 5),
        ("PEREZ", 486, 11), ("BOTTAS", 486, 77),
    ];

    private sealed class SimCar(string name, ushort teamId, byte number, double pace, double grid)
    {
        public readonly string Name = name;
        public readonly ushort TeamId = teamId;
        public readonly byte Number = number;
        public readonly double Pace = pace;
        /// <summary>Total distance; starts negative on the grid.</summary>
        public double Dist = grid;
        public double Speed, Accel;
        /// <summary>Acceleration smoothed like a real chassis would feel it; the speed profile steps every 5 m.</summary>
        public double FeltAccel;
        public double LapStartT;
        public readonly List<(int T, int S1, int S2)> LapTimes = [];
        public int S1, S2;
        /// <summary>Session time at each 10 m of total distance, for gaps.</summary>
        public readonly List<double> PassTimes = [];
        public double Ers = ErsMaxJ, ErsDeployedLap, ErsHarvestLap;
        public double Fuel = 100;
        public double[] Wear = [0, 0, 0, 0];
        public double[] BrakeTemp = [400, 400, 400, 400];
        public bool Overtake;
        public int LastPos;
        public double Throttle, Brake;
    }

    private readonly SimTrack _track = new();
    private readonly Random _random;
    private readonly SimCar[] _cars;
    private readonly ulong _uid;
    private readonly Dictionary<(int, int), double> _lastPass = [];
    private readonly List<byte[]> _out = [];
    private double _t;
    private uint _frame;
    private int _historyCursor;
    private double _overallBest = double.PositiveInfinity;
    // Player chassis state, for suspension velocity and angular acceleration.
    private readonly double[] _suspension = new double[4];
    private readonly double[] _suspensionVelocity = new double[4];
    private double _yawRate;

    private const int PlayerIdx = 0;
    private const double CarMassKg = 800;

    public RaceSimulator(Random? random = null)
    {
        _random = random ?? Random.Shared;
        _uid = (ulong)_random.NextInt64();
        _cars = [.. Grid.Select((g, i) => new SimCar(g.Name, g.TeamId, g.Number,
            pace: i == 0 ? 0.99 : 0.955 + _random.NextDouble() * 0.04,
            grid: -12 - i * 8) { LastPos = i + 1 })];
    }

    /// <summary>Packets announcing the session start.</summary>
    public IReadOnlyList<byte[]> Start()
    {
        _out.Clear();
        Event("SSTA");
        Event("LGOT");
        return [.. _out];
    }

    /// <summary>Advances the race by one tick and returns the packets the game would send.</summary>
    public IReadOnlyList<byte[]> Tick()
    {
        _out.Clear();
        _t += Dt;
        _frame++;

        var order = Enumerable.Range(0, _cars.Length).OrderByDescending(i => _cars[i].Dist).ToArray();
        var posOf = new int[_cars.Length];
        for (var p = 0; p < order.Length; p++) posOf[order[p]] = p + 1;

        for (var p = 0; p < order.Length; p++) Advance(order, p, posOf);

        var motion = new MotionPacket { Header = Header(PacketId.Motion) };
        var laps = new LapDataPacket { Header = Header(PacketId.LapData), TimeTrialPbCarIdx = 255, TimeTrialRivalCarIdx = 255 };
        var telemetry = new CarTelemetryPacket { Header = Header(PacketId.CarTelemetry), MfdPanelIndex = 255, MfdPanelIndexSecondaryPlayer = 255 };
        var status = new CarStatusPacket { Header = Header(PacketId.CarStatus) };
        var telemetry2 = new CarTelemetry2Packet { Header = Header(PacketId.CarTelemetry2) };
        for (var ci = 0; ci < _cars.Length; ci++)
        {
            motion.Cars[ci] = Motion(_cars[ci], ci);
            laps.Cars[ci] = LapData(_cars[ci], ci, order, posOf[ci]);
            telemetry.Cars[ci] = Telemetry(_cars[ci]);
            status.Cars[ci] = Status(_cars[ci]);
            telemetry2.Cars[ci] = Telemetry2(_cars[ci]);
        }
        Send(motion);
        Send(laps);
        Send(telemetry);
        Send(status);
        Send(telemetry2);
        Send(MotionEx(_cars[PlayerIdx]));
        if (_frame % 3 == 0) Send(Damage());
        if (_frame % 15 == 0) Send(Setups());
        if (_frame % 15 == 0) Send(Session());
        if (_frame % 30 == 0) Send(Participants());
        Send(History());
        return [.. _out];
    }

    private void Advance(int[] order, int p, int[] posOf)
    {
        var ci = order[p];
        var car = _cars[ci];
        var ahead = p > 0 ? _cars[order[p - 1]] : null;
        var i = _track.IndexAt(car.Dist);
        var inAero = _track.InAeroZone((double)i / _track.Count);
        car.Overtake = ahead is not null && car.Dist > SimTrack.Length && inAero && GapMs(car, ahead) < 1000 && car.Ers > 500_000;

        var boost = car.Overtake ? 1.025 : 1;
        var wobble = 1 + 0.0015 * Math.Sin(_t * 0.4 + ci);
        var factor = car.Pace * boost * wobble * (1 - car.Wear[0] / 1500);
        var target = _track.Speed[i] * factor;
        var prev = car.Speed;
        car.Speed = prev < target ? Math.Min(target, prev + 16 * Dt) : Math.Max(target, prev - SimTrack.Braking * 1.1 * Dt);
        car.Accel = (car.Speed - prev) / Dt;
        car.FeltAccel += (car.Accel - car.FeltAccel) * 0.15;
        car.Dist += car.Speed * Dt;
        var bin = (int)Math.Floor(car.Dist / 10);
        for (var b = car.PassTimes.Count; b <= bin; b++) car.PassTimes.Add(_t);

        // Pedals from track position (not instantaneous acceleration, which steps
        // with the 5 m speed profile): brake where the profile drops ahead, part
        // throttle at grip-limited corners, flat out everywhere else. Smoothed like a foot.
        var targetAhead = _track.Speed[(i + 3) % _track.Count] * factor;
        var braking = targetAhead < car.Speed - 0.3;
        var grip = _track.GripSpeed(i);
        var inCorner = grip < SimTrack.VMax && _track.Speed[i] >= grip * 0.97;
        var throttleTarget = braking ? 0 : inCorner ? 0.4 + 0.5 * (grip / SimTrack.VMax) : 1;
        var brakeTarget = braking ? Math.Min(1, 0.35 + (car.Speed - targetAhead) / 8) : 0;
        car.Throttle += (throttleTarget - car.Throttle) * 0.35;
        car.Brake += (brakeTarget - car.Brake) * 0.5;

        // Energy: deploy on full throttle, harvest under braking.
        var flatOut = car.Speed > SimTrack.VMax * car.Pace * 0.97;
        var deploy = car.Throttle > 0.95 && !flatOut ? (car.Overtake ? 300_000 : 110_000) * Dt : 0;
        var harvest = (car.Brake > 0.1 ? 350_000 : flatOut ? 90_000 : 0) * Dt;
        car.Ers = Math.Clamp(car.Ers - deploy + harvest, 0, ErsMaxJ);
        car.ErsDeployedLap += deploy;
        car.ErsHarvestLap += harvest;
        for (var w = 0; w < 4; w++)
            car.BrakeTemp[w] += (car.Brake * (w >= 2 ? 1400 : 1100) - (car.BrakeTemp[w] - 350) * 0.6) * Dt;

        UpdateLap(car, ci);

        var pos = posOf[ci];
        if (p + 1 < order.Length)
        {
            var passed = order[p + 1];
            if (pos < car.LastPos && car.Dist > 300 && _t - _lastPass.GetValueOrDefault((ci, passed), -99) > 15)
            {
                _lastPass[(ci, passed)] = _t;
                Event("OVTK", EventDetails.From(new EventData.Overtake { OvertakingVehicleIdx = (byte)ci, BeingOvertakenVehicleIdx = (byte)passed }));
            }
        }
        car.LastPos = pos;
    }

    /// <summary>Lap and sector bookkeeping.</summary>
    private void UpdateLap(SimCar car, int ci)
    {
        var lapDist = LapDistance(car);
        var lapNum = (int)Math.Floor(car.Dist / SimTrack.Length) + 1;
        var currentMs = (_t - car.LapStartT) * 1000;
        if (car.Dist > 0 && lapNum > car.LapTimes.Count + 1)
        {
            var ms = (int)Math.Round(currentMs);
            car.LapTimes.Add((ms, car.S1, car.S2));
            car.LapStartT = _t;
            car.S1 = car.S2 = 0;
            car.ErsDeployedLap = car.ErsHarvestLap = 0;
            car.Fuel = Math.Max(0, car.Fuel - 1.65);
            for (var k = 0; k < 4; k++) car.Wear[k] += (k < 2 ? 1.9 : 1.5) * (0.9 + _random.NextDouble() * 0.2);
            // The first lap starts from the grid, so it doesn't count as a fastest lap.
            if (car.LapTimes.Count > 1 && ms < _overallBest)
            {
                _overallBest = ms;
                Event("FTLP", EventDetails.From(new EventData.FastestLap { VehicleIdx = (byte)ci, LapTime = ms / 1000f }));
            }
        }
        if (car.Dist > 0 && car.S1 == 0 && lapDist > SimTrack.Length / 3) car.S1 = (int)Math.Round(currentMs);
        if (car.Dist > 0 && car.S2 == 0 && lapDist > 2 * SimTrack.Length / 3) car.S2 = (int)Math.Round(currentMs - car.S1);
    }

    private static double LapDistance(SimCar c) => c.Dist - Math.Floor(c.Dist / SimTrack.Length) * SimTrack.Length;

    private int GapMs(SimCar behind, SimCar ahead)
    {
        var bin = (int)Math.Floor(behind.Dist / 10);
        return bin >= 0 && bin < ahead.PassTimes.Count ? Math.Max(0, (int)Math.Round((_t - ahead.PassTimes[bin]) * 1000)) : 0;
    }

    private CarMotionData Motion(SimCar c, int ci)
    {
        var i = _track.IndexAt(c.Dist);
        var q = (i + 1) % _track.Count;
        var lane = (ci % 3 - 1) * 2; // spread cars across the track width
        var dx = _track.X[q] - _track.X[i];
        var dz = _track.Z[q] - _track.Z[i];
        var len = Math.Sqrt(dx * dx + dz * dz) is var l && l > 0 ? l : 1;
        double fx = dx / len, fz = dz / len;
        const double g = 9.81;
        return new CarMotionData
        {
            WorldPositionX = (float)(_track.X[i] - fz * lane),
            WorldPositionZ = (float)(_track.Z[i] + fx * lane),
            WorldVelocityX = (float)(fx * c.Speed),
            WorldVelocityZ = (float)(fz * c.Speed),
            WorldForwardDirX = Quantise(fx, PacketFormat.DirectionScale),
            WorldForwardDirZ = Quantise(fz, PacketFormat.DirectionScale),
            WorldRightDirX = Quantise(-fz, PacketFormat.DirectionScale),
            WorldRightDirZ = Quantise(fx, PacketFormat.DirectionScale),
            GForceLateral = Quantise(c.Speed * c.Speed * _track.Curvature[i] / g, PacketFormat.GForceScale),
            GForceLongitudinal = Quantise(c.FeltAccel / g, PacketFormat.GForceScale),
            GForceVertical = Quantise(1, PacketFormat.GForceScale),
            Yaw = (float)Math.Atan2(fx, fz),
            Pitch = (float)(-c.FeltAccel / g * 0.004),
            Roll = (float)(c.Speed * c.Speed * _track.Curvature[i] / g * 0.005),
        };
    }

    /// <summary>
    /// Extended motion for the player: loads from weight, downforce and load transfer;
    /// suspension follows the load; slip from throttle, braking and cornering.
    /// </summary>
    private MotionExPacket MotionEx(SimCar c)
    {
        const double g = 9.81, cogHeight = 0.28, track = 1.6, wheelbase = 3.6;
        var i = _track.IndexAt(c.Dist);
        var v = Math.Max(0, c.Speed);
        var latAcc = v * v * _track.Curvature[i];
        var latG = latAcc / g;
        var lonG = c.FeltAccel / g;
        var downforce = 2.4 * v * v;
        var latTransfer = CarMassKg * latAcc * cogHeight / track / 2;
        var lonTransfer = CarMassKg * c.FeltAccel * cogHeight / wheelbase / 2;

        var m = new MotionExPacket { Header = Header(PacketId.ExtendedMotion) };
        double totalLoad = 0;
        for (var w = 0; w < 4; w++)
        {
            var front = w >= 2;
            var right = w % 2 == 1;
            var load = (CarMassKg * g + downforce) * (front ? 0.45 : 0.55) / 2
                + (right ? latTransfer : -latTransfer)
                + (front ? -lonTransfer : lonTransfer);
            m.WheelVertForce[w] = (float)Math.Max(0, load);
            totalLoad += Math.Max(0, load);
        }
        for (var w = 0; w < 4; w++)
        {
            var front = w >= 2;
            var share = m.WheelVertForce[w] / Math.Max(1, totalLoad);
            var slip = c.Brake > 0.05 ? -(front ? 0.06 : 0.04) * c.Brake
                : !front ? 0.025 * c.Throttle * Math.Max(0, 1 - v / 60) + 0.004 * c.Throttle : 0.002;
            m.WheelSlipRatio[w] = (float)slip;
            m.WheelSpeed[w] = (float)(v * (1 + slip));
            m.WheelSlipAngle[w] = (float)(latG * (front ? 0.012 : 0.010));
            m.WheelLatForce[w] = (float)(CarMassKg * latAcc * share);
            m.WheelLongForce[w] = (float)(CarMassKg * c.FeltAccel * share);

            // Suspension travel in mm, compressed by load.
            var pos = m.WheelVertForce[w] / (front ? 220.0 : 260.0);
            var vel = (pos - _suspension[w]) / Dt;
            m.SuspensionPosition[w] = (float)pos;
            m.SuspensionVelocity[w] = (float)vel;
            m.SuspensionAcceleration[w] = (float)((vel - _suspensionVelocity[w]) / Dt);
            _suspension[w] = pos;
            _suspensionVelocity[w] = vel;

            m.WheelCamber[w] = (float)(front ? -0.056 : -0.031);
            m.WheelCamberGain[w] = (float)(latG * (w % 2 == 1 ? 0.002 : -0.002));
        }

        var yawRate = v * _track.Curvature[i];
        var q = (i + 1) % _track.Count;
        m.HeightOfCogAboveGround = (float)(cogHeight - 0.000002 * v * v);
        m.LocalVelocityX = (float)(v * m.WheelSlipAngle[0] * 0.3);
        m.LocalVelocityZ = (float)v;
        m.AngularVelocityY = (float)yawRate;
        m.AngularAccelerationY = (float)((yawRate - _yawRate) / Dt);
        _yawRate = yawRate;
        m.FrontWheelsAngle = (float)(Math.Clamp(_track.Curvature[i] * 60, -1, 1) * 0.3);
        m.FrontAeroHeight = (float)Math.Max(0.004, 0.035 - 0.0000022 * v * v + lonG * 0.002);
        m.RearAeroHeight = (float)Math.Max(0.01, 0.075 - 0.0000040 * v * v - lonG * 0.002);
        m.FrontRollAngle = (float)(latG * 0.004);
        m.RearRollAngle = (float)(latG * 0.005);
        m.ChassisYaw = (float)Math.Atan2(_track.X[q] - _track.X[i], _track.Z[q] - _track.Z[i]);
        m.ChassisPitch = (float)(-lonG * 0.004);
        return m;
    }

    private CarSetupsPacket Setups()
    {
        var packet = new CarSetupsPacket { Header = Header(PacketId.CarSetups), NextFrontWingValue = 28 };
        for (var ci = 0; ci < _cars.Length; ci++)
        {
            packet.Cars[ci] = new CarSetupData
            {
                FrontWing = 28, RearWing = 24, OnThrottle = 60, OffThrottle = 55,
                FrontCamber = -3.2f, RearCamber = -1.8f, FrontToe = 0.05f, RearToe = 0.2f,
                FrontSuspension = 32, RearSuspension = 14, FrontAntiRollBar = 18, RearAntiRollBar = 9,
                FrontSuspensionHeight = 24, RearSuspensionHeight = 58,
                BrakePressure = 100, BrakeBias = 55, EngineBraking = 60,
                Ballast = 6, FuelLoad = 100,
            };
            double[] psi = [21.2, 21.2, 23.1, 23.1];
            for (var w = 0; w < 4; w++) packet.Cars[ci].TyresPressure[w] = (float)psi[w];
        }
        return packet;
    }

    private static short Quantise(double value, float scale) => (short)Math.Clamp(Math.Round(value * scale), short.MinValue, short.MaxValue);

    private LapData LapData(SimCar c, int ci, int[] order, int pos)
    {
        var leader = _cars[order[0]];
        var ahead = pos > 1 ? _cars[order[pos - 2]] : null;
        var lapDist = LapDistance(c);
        var toLeader = ahead is null ? 0 : GapMs(c, leader);
        var toAhead = ahead is null ? 0 : GapMs(c, ahead);
        var last = c.LapTimes.Count > 0 ? c.LapTimes[^1].T : 0;
        return new LapData
        {
            LastLapTimeInMs = (uint)last,
            CurrentLapTimeInMs = (uint)Math.Max(0, Math.Round((_t - c.LapStartT) * 1000)),
            Sector1TimeMsPart = (ushort)(c.S1 % 60_000),
            Sector1TimeMinutesPart = (byte)(c.S1 / 60_000),
            Sector2TimeMsPart = (ushort)(c.S2 % 60_000),
            Sector2TimeMinutesPart = (byte)(c.S2 / 60_000),
            DeltaToCarInFrontMsPart = (ushort)(toAhead % 60_000),
            DeltaToCarInFrontMinutesPart = (byte)(toAhead / 60_000),
            DeltaToRaceLeaderMsPart = (ushort)(toLeader % 60_000),
            DeltaToRaceLeaderMinutesPart = (byte)(toLeader / 60_000),
            LapDistance = (float)(c.Dist < 0 ? c.Dist : lapDist),
            TotalDistance = (float)c.Dist,
            CarPosition = (byte)pos,
            CurrentLapNum = (byte)Math.Max(1, Math.Floor(c.Dist / SimTrack.Length) + 1),
            Sector = (byte)(lapDist < SimTrack.Length / 3 ? 0 : lapDist < 2 * SimTrack.Length / 3 ? 1 : 2),
            GridPosition = (byte)(ci + 1),
            DriverStatus = 4,
            ResultStatus = 2,
            SpeedTrapFastestLap = 255,
        };
    }

    private CarTelemetryData Telemetry(SimCar c)
    {
        var i = _track.IndexAt(c.Dist);
        var kmh = c.Speed * 3.6;
        var gear = Math.Clamp((int)Math.Ceiling(kmh / 42), 1, 8);
        var gearLow = (gear - 1) * 42;
        var rpm = Math.Min(12_500, 7_000 + (kmh - gearLow) / 42 * 5_200);
        var lat = Math.Abs(c.Speed * c.Speed * _track.Curvature[i]) / 9.81;

        var data = new CarTelemetryData
        {
            Speed = (ushort)Math.Round(kmh),
            Throttle = (float)c.Throttle,
            Brake = (float)c.Brake,
            Steer = (float)Math.Clamp(_track.Curvature[i] * 60, -1, 1),
            Gear = (sbyte)gear,
            EngineRpm = (ushort)Math.Round(rpm),
            RevLightsPercent = (byte)Math.Round(Math.Max(0, (rpm - 10_500) / 2_000) * 100),
            EngineTemperature = 108,
        };
        double[] basePressure = [21.2, 21.2, 23.1, 23.1];
        for (var k = 0; k < 4; k++)
        {
            var surface = (byte)Math.Round(88 + lat * 3 + (k >= 2 ? 4 : 0) + c.Wear[k] * 0.2 + Math.Sin(_t + k) * 2);
            data.BrakesTemperature[k] = (ushort)Math.Round(c.BrakeTemp[k]);
            data.TyresSurfaceTemperature[k] = surface;
            data.TyresInnerTemperature[k] = (byte)(surface + 6);
            data.TyresPressure[k] = (float)(basePressure[k] + lat * 0.05);
        }
        return data;
    }

    private static CarStatusData Status(SimCar c) => new()
    {
        FuelMix = 1,
        FrontBrakeBias = 55,
        FuelInTank = (float)c.Fuel,
        FuelCapacity = 110,
        FuelRemainingLaps = (float)(c.Fuel / 1.65 - (TotalLaps - c.LapTimes.Count)),
        MaxRpm = 12_500,
        IdleRpm = 4_000,
        MaxGears = 8,
        ActualTyreCompound = 17,
        VisualTyreCompound = 17,
        TyresAgeLaps = (byte)c.LapTimes.Count,
        VehicleFiaFlags = 1,
        EnginePowerIce = c.Throttle > 0.95 ? 400_000 : 90_000,
        EnginePowerMguk = c.Throttle > 0.95 ? (c.Overtake ? 350_000 : 150_000) : 0,
        ErsStoreEnergy = (float)c.Ers,
        ErsDeployMode = (byte)(c.Overtake ? 3 : 1),
        ErsHarvestedThisLapMguk = (float)c.ErsHarvestLap,
        ErsHarvestedThisLapMguh = 0, // no MGU-H under the 2026 rules
        ErsHarvestLimitPerLap = 8_500_000,
        ErsDeployedThisLap = (float)c.ErsDeployedLap,
    };

    private CarTelemetry2Data Telemetry2(SimCar c)
    {
        var frac = (double)_track.IndexAt(c.Dist) / _track.Count;
        var nextZone = (ushort)Math.Round(_track.AeroZones.Min(z => (z.ZoneStart - frac + 1) % 1 * SimTrack.Length));
        var inZone = _track.InAeroZone(frac);
        return new CarTelemetry2Data
        {
            ActiveAeroMode = (byte)(inZone ? 1 : 0),
            ActiveAeroAvailable = inZone,
            ActiveAeroActivationDistance = inZone ? (ushort)0 : nextZone,
            OvertakeAvailable = c.Overtake || (c.Dist > SimTrack.Length && c.Ers > 1_000_000),
            OvertakeActive = c.Overtake,
            OvertakeActivationDistance = inZone ? (ushort)0 : nextZone,
            Regulations2026Applicable = true,
        };
    }

    private CarDamagePacket Damage()
    {
        var packet = new CarDamagePacket { Header = Header(PacketId.CarDamage) };
        for (var ci = 0; ci < _cars.Length; ci++)
        {
            ref var d = ref packet.Cars[ci];
            for (var k = 0; k < 4; k++) d.TyresWear[k] = (float)_cars[ci].Wear[k];
            d.EngineIceWear = 8;
            d.EngineMgukWear = 11;
            d.EngineEsWear = 9;
            d.GearBoxDamage = 4;
        }
        return packet;
    }

    private SessionPacket Session()
    {
        var s = new SessionPacket
        {
            Header = Header(PacketId.Session),
            Weather = 1,
            TrackTemperature = 41,
            AirTemperature = 28,
            TotalLaps = TotalLaps,
            TrackLength = (ushort)SimTrack.Length,
            SessionType = 15,
            TrackId = TrackId,
            SessionTimeLeft = (ushort)Math.Max(0, 7200 - Math.Floor(_t)),
            SessionDuration = 7200,
            PitSpeedLimit = 80,
            NumMarshalZones = 3,
            NumWeatherForecastSamples = 5,
            PitStopWindowIdealLap = 14,
            PitStopWindowLatestLap = 18,
            PitStopRejoinPosition = 6,
            Sector2LapDistanceStart = (float)(SimTrack.Length / 3),
            Sector3LapDistanceStart = (float)(2 * SimTrack.Length / 3),
            NumActiveAeroZonesFull = (byte)_track.AeroZones.Count,
            TimeOfDay = (uint)(14 * 60 + Math.Floor(_t / 60)),
            NumSessionsInWeekend = 1,
        };
        // A yellow flag in the middle sector now and then.
        s.MarshalZones[0] = new MarshalZone { ZoneStart = 0.1f };
        s.MarshalZones[1] = new MarshalZone { ZoneStart = 0.45f, ZoneFlag = (sbyte)((int)(_t / 20) % 5 == 4 ? 3 : 0) };
        s.MarshalZones[2] = new MarshalZone { ZoneStart = 0.8f };
        byte[] offsets = [0, 5, 10, 15, 30];
        for (var k = 0; k < offsets.Length; k++)
        {
            s.WeatherForecastSamples[k] = new WeatherForecastSample
            {
                SessionType = 15,
                TimeOffset = offsets[k],
                Weather = (byte)(k < 3 ? 1 : 2),
                TrackTemperature = (sbyte)(41 - k),
                AirTemperature = 28,
                RainPercentage = (byte)(k * 6),
            };
        }
        for (var k = 0; k < _track.AeroZones.Count; k++) s.ActiveAeroZonesFull[k] = _track.AeroZones[k];
        s.WeekendStructure[0] = 15;
        return s;
    }

    private ParticipantsPacket Participants()
    {
        var packet = new ParticipantsPacket { Header = Header(PacketId.Participants), NumActiveCars = (byte)_cars.Length };
        for (var i = 0; i < _cars.Length; i++)
        {
            packet.Cars[i] = new ParticipantData
            {
                AiControlled = i != 0,
                DriverId = 255,
                NetworkId = 255,
                TeamId = _cars[i].TeamId,
                RaceNumber = _cars[i].Number,
                Name = Utf8String32.From(_cars[i].Name),
                YourTelemetry = true,
                ShowOnlineNames = true,
                Platform = 255,
            };
        }
        return packet;
    }

    /// <summary>Lap history of one car per tick, cycling through the grid like the game.</summary>
    private SessionHistoryPacket History()
    {
        var ci = _historyCursor++ % _cars.Length;
        var laps = _cars[ci].LapTimes.TakeLast(100).ToList();
        var best = 0; // 1-based; the first lap from the grid never counts
        for (var k = 1; k < laps.Count; k++)
            if (best == 0 || laps[k].T < laps[best - 1].T) best = k + 1;

        var packet = new SessionHistoryPacket
        {
            Header = Header(PacketId.SessionHistory),
            CarIdx = (byte)ci,
            NumLaps = (byte)(laps.Count + 1),
            NumTyreStints = 1,
            BestLapTimeLapNum = (byte)best,
        };
        for (var k = 0; k < laps.Count; k++)
        {
            var (t, s1, s2) = laps[k];
            packet.Laps[k] = new LapHistoryData
            {
                LapTimeInMs = (uint)t,
                Sector1TimeMsPart = (ushort)(s1 % 60_000),
                Sector2TimeMsPart = (ushort)(s2 % 60_000),
                Sector3TimeMsPart = (ushort)((t - s1 - s2) % 60_000),
                LapValidBitFlags = 0x0f,
            };
        }
        packet.TyreStints[0] = new TyreStintHistoryData { EndLap = 255, TyreActualCompound = 17, TyreVisualCompound = 17 };
        return packet;
    }

    private void Event(string code, EventDetails details = default) =>
        Send(new EventPacket { Header = Header(PacketId.Event), Code = EventCode.From(code), Details = details });

    private PacketHeader Header(PacketId id) => new()
    {
        PacketFormat = PacketFormat.Version,
        GameYear = 25,
        GameMajorVersion = 1,
        GameMinorVersion = 25,
        PacketVersion = 1,
        PacketId = id,
        SessionUid = _uid,
        SessionTime = (float)_t,
        FrameIdentifier = _frame,
        OverallFrameIdentifier = _frame,
        PlayerCarIndex = PlayerIdx,
        SecondaryPlayerCarIndex = 255,
    };

    private void Send<T>(in T packet) where T : unmanaged, IPacket => _out.Add(PacketCodec.Encode(packet));
}
