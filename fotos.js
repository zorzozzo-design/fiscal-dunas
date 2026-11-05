// Lê do EXIF de um JPEG a data e hora da foto (DateTimeOriginal) e o GPS, sem bibliotecas.
// Retorna { data: 'AAAA-MM-DDTHH:MM', lat, lon } com o que houver; {} se não houver EXIF.
(() => {

const TAM = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function lerExif(buf) {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return {};
    for (let o = 2; o + 4 <= v.byteLength;) {
      if (v.getUint8(o) !== 0xff) return {};
      const m = v.getUint8(o + 1);
      if (m === 0xda || m === 0xd9) return {};
      if (m === 0xe1 && v.getUint32(o + 4) === 0x45786966) return tiff(v, o + 10);
      o += 2 + v.getUint16(o + 2);
    }
  } catch { /* arquivo truncado ou EXIF inválido */ }
  return {};
}

function tiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = p => v.getUint16(t + p, le), u32 = p => v.getUint32(t + p, le);
  const ifd = p => { const out = {}; for (let i = 0, n = u16(p); i < n; i++) { const e = p + 2 + i * 12; out[u16(e)] = { tipo: u16(e + 2), n: u32(e + 4), p: e + 8 }; } return out; };
  const pos = e => e.n * (TAM[e.tipo] || 1) > 4 ? u32(e.p) : e.p;
  const ascii = e => { let s = ''; for (let i = 0, p = pos(e); i < e.n; i++) { const c = v.getUint8(t + p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
  const graus = e => { const p = pos(e), r = i => u32(p + i * 8) / u32(p + i * 8 + 4); return r(0) + r(1) / 60 + r(2) / 3600; };
  const out = {}, ifd0 = ifd(u32(4));
  const quando = ifd0[0x8769] && ifd(u32(ifd0[0x8769].p))[0x9003] || ifd0[0x0132];
  const m = quando && ascii(quando).match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/);
  if (m) out.data = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  if (ifd0[0x8825]) {
    const g = ifd(u32(ifd0[0x8825].p));
    if (g[2] && g[4]) {
      const lat = graus(g[2]) * (g[1] && ascii(g[1]) === 'S' ? -1 : 1), lon = graus(g[4]) * (g[3] && ascii(g[3]) === 'W' ? -1 : 1);
      if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) Object.assign(out, { lat, lon });
    }
  }
  return out;
}

globalThis.Fotos = { lerExif };
})();
