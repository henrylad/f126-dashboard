// Minimal schema-driven binary codec for the F1 UDP format.
// All data is little-endian and tightly packed (no alignment padding).

export type Prim = 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'i32' | 'u64' | 'f32' | 'f64' | 'bool';
export type FieldType =
  | Prim
  | { arr: FieldType; n: number }
  | { struct: Struct }
  | { str: number }; // fixed-size, null-terminated UTF-8
export type Struct = readonly (readonly [string, FieldType])[];

const PRIM_SIZE: Record<Prim, number> = {
  u8: 1, i8: 1, bool: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, u64: 8, f64: 8,
};

const sizeCache = new WeakMap<object, number>();

export function sizeOf(t: FieldType): number {
  if (typeof t === 'string') return PRIM_SIZE[t];
  const cached = sizeCache.get(t);
  if (cached !== undefined) return cached;
  let size: number;
  if ('arr' in t) size = sizeOf(t.arr) * t.n;
  else if ('str' in t) size = t.str;
  else size = t.struct.reduce((sum, [, ft]) => sum + sizeOf(ft), 0);
  sizeCache.set(t, size);
  return size;
}

const utf8 = new TextDecoder('utf-8');
const utf8enc = new TextEncoder();

export class Reader {
  constructor(readonly view: DataView, public off = 0) {}

  read(t: FieldType): any {
    const v = this.view;
    if (typeof t === 'string') {
      const o = this.off;
      this.off += PRIM_SIZE[t];
      switch (t) {
        case 'u8': return v.getUint8(o);
        case 'i8': return v.getInt8(o);
        case 'bool': return v.getUint8(o) !== 0;
        case 'u16': return v.getUint16(o, true);
        case 'i16': return v.getInt16(o, true);
        case 'u32': return v.getUint32(o, true);
        case 'i32': return v.getInt32(o, true);
        case 'f32': return v.getFloat32(o, true);
        case 'f64': return v.getFloat64(o, true);
        case 'u64': return v.getBigUint64(o, true).toString(); // JSON-safe
      }
    }
    if ('arr' in t) {
      const out = new Array(t.n);
      for (let i = 0; i < t.n; i++) out[i] = this.read(t.arr);
      return out;
    }
    if ('str' in t) {
      const bytes = new Uint8Array(v.buffer, v.byteOffset + this.off, t.str);
      this.off += t.str;
      const end = bytes.indexOf(0);
      return utf8.decode(end === -1 ? bytes : bytes.subarray(0, end));
    }
    const obj: Record<string, unknown> = {};
    for (const [name, ft] of t.struct) obj[name] = this.read(ft);
    return obj;
  }
}

export class Writer {
  readonly view: DataView;
  off = 0;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  write(t: FieldType, value: any): void {
    const v = this.view;
    if (typeof t === 'string') {
      const o = this.off;
      this.off += PRIM_SIZE[t];
      const n = value ?? 0;
      switch (t) {
        case 'u8': v.setUint8(o, n); return;
        case 'i8': v.setInt8(o, n); return;
        case 'bool': v.setUint8(o, n ? 1 : 0); return;
        case 'u16': v.setUint16(o, n, true); return;
        case 'i16': v.setInt16(o, n, true); return;
        case 'u32': v.setUint32(o, n, true); return;
        case 'i32': v.setInt32(o, n, true); return;
        case 'f32': v.setFloat32(o, n, true); return;
        case 'f64': v.setFloat64(o, n, true); return;
        case 'u64': v.setBigUint64(o, BigInt(n), true); return;
      }
    }
    if ('arr' in t) {
      for (let i = 0; i < t.n; i++) this.write(t.arr, value?.[i]);
      return;
    }
    if ('str' in t) {
      const enc = utf8enc.encode(String(value ?? '')).subarray(0, t.str);
      this.bytes.set(enc, this.off);
      this.off += t.str;
      return;
    }
    for (const [name, ft] of t.struct) this.write(ft, value?.[name]);
  }
}

export function encode(t: FieldType, value: unknown): Uint8Array {
  const bytes = new Uint8Array(sizeOf(t));
  new Writer(bytes).write(t, value);
  return bytes;
}

export function decode(t: FieldType, bytes: Uint8Array, off = 0): any {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return new Reader(view, off).read(t);
}
