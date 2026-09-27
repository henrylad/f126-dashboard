import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, sizeOf } from './codec.ts';
import { Bodies, EXPECTED_SIZES, Header, HEADER_SIZE, PACKET_FORMAT, PacketId, decodePacket } from './packets.ts';

test('header is 29 bytes', () => {
  assert.equal(HEADER_SIZE, 29);
});

for (const [id, size] of Object.entries(EXPECTED_SIZES)) {
  test(`packet ${id} matches the published size of ${size} bytes`, () => {
    assert.equal(HEADER_SIZE + sizeOf({ struct: Bodies[Number(id)]! }), size);
  });
}

function packet(packetId: number, body: unknown, packetFormat = PACKET_FORMAT) {
  const h = encode({ struct: Header }, { packetFormat, gameYear: 26, packetId, sessionUID: '12345678901234567890', playerCarIndex: 3 });
  const b = encode({ struct: Bodies[packetId]! }, body);
  const out = new Uint8Array(h.length + b.length);
  out.set(h);
  out.set(b, h.length);
  return out;
}

test('round-trips telemetry and 2026 active aero fields', () => {
  const tel = Array.from({ length: 24 }, (_, i) => ({ speed: 100 + i, throttle: 0.5, gear: -1, tyresSurfaceTemperature: [90, 91, 92, 93] }));
  const d = decodePacket(packet(PacketId.CarTelemetry, { carTelemetryData: tel, suggestedGear: 7 }));
  assert.ok(d?.body);
  assert.equal(d.header.sessionUID, '12345678901234567890');
  assert.equal(d.header.playerCarIndex, 3);
  assert.equal(d.body.carTelemetryData[23].speed, 123);
  assert.equal(d.body.carTelemetryData[0].gear, -1);
  assert.deepEqual(d.body.carTelemetryData[5].tyresSurfaceTemperature, [90, 91, 92, 93]);
  assert.equal(d.body.suggestedGear, 7);

  const t2 = decodePacket(packet(PacketId.CarTelemetry2, { carTelemetry2Data: [{ activeAeroMode: 1, overtakeActive: true, overtakeActivationDistance: 812 }] }));
  assert.equal(t2?.body.carTelemetry2Data[0].activeAeroMode, 1);
  assert.equal(t2?.body.carTelemetry2Data[0].overtakeActive, true);
  assert.equal(t2?.body.carTelemetry2Data[0].overtakeActivationDistance, 812);
});

test('decodes participant names and event payloads', () => {
  const p = decodePacket(packet(PacketId.Participants, { numActiveCars: 22, participants: [{ name: 'VERSTAPPEN', teamId: 478 }] }));
  assert.equal(p?.body.participants[0].name, 'VERSTAPPEN');
  assert.equal(p?.body.participants[0].teamId, 478);

  const raw = packet(PacketId.Event, { eventCode: 'FTLP' });
  new DataView(raw.buffer).setUint8(HEADER_SIZE + 4, 7);
  new DataView(raw.buffer).setFloat32(HEADER_SIZE + 5, 88.123, true);
  const e = decodePacket(raw);
  assert.equal(e?.body.eventCode, 'FTLP');
  assert.equal(e?.body.details.vehicleIdx, 7);
  assert.ok(Math.abs(e?.body.details.lapTime - 88.123) < 1e-3);
});

test('rejects non-2026 packet formats', () => {
  const d = decodePacket(packet(PacketId.CarStatus, {}, 2025));
  assert.equal(d?.body, null);
  assert.equal(d && 'reason' in d && d.reason, 'format');
});
