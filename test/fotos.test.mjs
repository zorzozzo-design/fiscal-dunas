import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../fotos.js';
const { lerExif } = globalThis.Fotos;

// Monta um JPEG mínimo com APP1/EXIF: DateTimeOriginal e GPS (graus, minutos, segundos).
function jpegExif({ le = false, data = '2026:11:08 16:20:05', lat = [30, 7, 12], latRef = 'S', lon = [50, 12, 0], lonRef = 'W' } = {}) {
  const t = new DataView(new ArrayBuffer(256));
  const u16 = (p, x) => t.setUint16(p, x, le), u32 = (p, x) => t.setUint32(p, x, le);
  const ent = (p, tag, tipo, n, val) => { u16(p, tag); u16(p + 2, tipo); u32(p + 4, n); u32(p + 8, val); };
  t.setUint16(0, le ? 0x4949 : 0x4d4d); u16(2, 42); u32(4, 8);
  // IFD0 em 8: ponteiros para o Exif IFD (38) e o GPS IFD (56)
  u16(8, 2); ent(10, 0x8769, 4, 1, 38); ent(22, 0x8825, 4, 1, 56); u32(34, 0);
  // Exif IFD em 38: DateTimeOriginal (ASCII, 20 bytes em 120)
  u16(38, 1); ent(40, 0x9003, 2, 20, 120); u32(52, 0);
  // GPS IFD em 56: refs inline e racionais em 160 e 184
  u16(56, 4);
  ent(58, 1, 2, 2, 0); t.setUint8(66, latRef.charCodeAt(0));
  ent(70, 2, 5, 3, 160); ent(82, 3, 2, 2, 0); t.setUint8(90, lonRef.charCodeAt(0)); ent(94, 4, 5, 3, 184); u32(106, 0);
  [...data].forEach((c, i) => t.setUint8(120 + i, c.charCodeAt(0)));
  [lat, lon].forEach((g, k) => g.forEach((x, i) => { u32(160 + k * 24 + i * 8, x); u32(164 + k * 24 + i * 8, 1); }));
  const tiff = new Uint8Array(t.buffer);
  const app1 = [0xff, 0xe1, (tiff.length + 8) >> 8, (tiff.length + 8) & 255, 0x45, 0x78, 0x69, 0x66, 0, 0];
  return new Uint8Array([0xff, 0xd8, ...app1, ...tiff, 0xff, 0xd9]).buffer;
}

test('EXIF big-endian: data e GPS no hemisfério sul/oeste', () => {
  const e = lerExif(jpegExif());
  assert.equal(e.data, '2026-11-08T16:20');
  assert.ok(Math.abs(e.lat - -30.12) < 1e-9);
  assert.ok(Math.abs(e.lon - -50.2) < 1e-9);
});

test('EXIF little-endian', () => {
  const e = lerExif(jpegExif({ le: true }));
  assert.equal(e.data, '2026-11-08T16:20');
  assert.ok(e.lat < 0 && e.lon < 0);
});

test('sem EXIF ou arquivo que não é JPEG: vazio', () => {
  assert.deepEqual(lerExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer), {});
  assert.deepEqual(lerExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), {});
  assert.deepEqual(lerExif(new ArrayBuffer(0)), {});
});

test('GPS zerado (aparelho sem sinal) é descartado', () => {
  const e = lerExif(jpegExif({ lat: [0, 0, 0], lon: [0, 0, 0] }));
  assert.equal(e.lat, undefined);
  assert.equal(e.data, '2026-11-08T16:20');
});
