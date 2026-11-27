import { describe, expect, it } from 'vitest';
import { crc32, zip } from './zip.ts';
import { unzip } from './testZip.ts';

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('zip', () => {
  it('stores every file so it reads back byte for byte', () => {
    const files = { 'a.csv': 'x,y\n1,2\n', 'README.txt': 'Grüße – UTF-8\n', 'empty.txt': '' };
    const bytes = zip(Object.entries(files).map(([name, text]) => ({ name, text })));
    expect(unzip(bytes)).toEqual(files);
  });
});

