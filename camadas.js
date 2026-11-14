// Camadas importadas pelo agente (KML, KMZ ou GeoJSON): áreas dizem se o ponto está dentro; linhas dão a distância em metros.
// Coordenadas guardadas como [lat, lon], igual ao resto do app. c.uc ('federal', 'estadual', 'municipal'): camada de UC.
(() => {

const LIMITE_M = 2000; // linhas mais longe que isso não aparecem

const anel = cs => cs.map(([lon, lat]) => [lat, lon]);
function deGeoJSON(g) {
  const fs = g.type === 'FeatureCollection' ? g.features : g.type === 'Feature' ? [g] : [{ geometry: g, properties: {} }];
  const out = [];
  fs.forEach((f, i) => {
    const geo = f.geometry || {}, p = f.properties || {}, nome = p.nome || p.name || p.NOME || p.Name || p.NM_UC || `Feição ${i + 1}`;
    const areas = geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : [];
    const linhas = geo.type === 'LineString' ? [geo.coordinates] : geo.type === 'MultiLineString' ? geo.coordinates : [];
    if (areas.length) out.push({ nome, tipo: 'area', partes: areas.map(an => an.map(anel)) });
    if (linhas.length) out.push({ nome, tipo: 'linha', partes: linhas.map(anel) });
  });
  return out;
}

const entidades = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const coordsKml = s => s.trim().split(/\s+/).map(t => t.split(',').map(Number)).filter(c => c.length >= 2 && c.every(Number.isFinite)).map(([lon, lat]) => [lat, lon]);
const todos = (s, re) => [...s.matchAll(re)].map(m => m[1]);
function deKml(t) {
  return [...t.matchAll(/<Placemark[\s>]([\s\S]*?)<\/Placemark>/g)].flatMap(([, pm], i) => {
    const nome = entidades((pm.match(/<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/) || [])[1]?.trim() || `Feição ${i + 1}`);
    const areas = todos(pm, /<Polygon[\s>]([\s\S]*?)<\/Polygon>/g).map(pg => [
      ...todos(pg, /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g),
      ...todos(pg, /<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map(coordsKml));
    const linhas = todos(pm, /<LineString[\s>][\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g).map(coordsKml);
    return [areas.length && { nome, tipo: 'area', partes: areas }, linhas.length && { nome, tipo: 'linha', partes: linhas }].filter(Boolean);
  });
}

// KMZ é um zip com o KML dentro. Lê o diretório central e descompacta o primeiro .kml (deflate ou sem compressão).
async function textoCamada(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf);
  if (u[0] !== 0x50 || u[1] !== 0x4b) return new TextDecoder().decode(u);
  let fim = u.length - 22; while (fim >= 0 && dv.getUint32(fim, true) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('KMZ corrompido.');
  for (let p = dv.getUint32(fim + 16, true), n = dv.getUint16(fim + 10, true); n--; ) {
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true);
    const nome = new TextDecoder().decode(u.subarray(p + 46, p + 46 + ln)), loc = dv.getUint32(p + 42, true);
    p += 46 + ln + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    if (!/\.kml$/i.test(nome)) continue;
    const ini = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true), dados = u.subarray(ini, ini + tam);
    if (metodo === 0) return new TextDecoder().decode(dados);
    return new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  throw new Error('O KMZ não tem arquivo KML.');
}

function lerCamada(texto, arquivo) {
  let feicoes, nome;
  const t = texto.trim();
  if (t.startsWith('{')) { const g = JSON.parse(t); feicoes = deGeoJSON(g); nome = g.name; }
  else if (/<kml[\s>]/.test(t)) { feicoes = deKml(t); nome = entidades((t.match(/<Document>[\s\S]*?<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/) || [])[1]?.trim() || ''); }
  else throw new Error('O arquivo precisa ser KML ou GeoJSON.');
  if (!feicoes.length) throw new Error('Nenhuma área ou linha encontrada no arquivo.');
  return { nome: nome || arquivo.replace(/\.[^.]+$/, ''), feicoes };
}

// Mesmo teste de polígono do corredor dos Lençóis, com furos.
const dentroAnel = (p, vs) => { let d = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
  const [yi, xi] = vs[i], [yj, xj] = vs[j]; if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) d = !d; } return d; };
const dentro = (p, partes) => partes.some(([ext, ...furos]) => dentroAnel(p, ext) && !furos.some(f => dentroAnel(p, f)));

// Distância ponto-segmento em projeção local (metros); erro desprezível na escala de poucos km.
function distLinha(p, partes) {
  const ky = 111320, kx = 111320 * Math.cos(p[0] * Math.PI / 180), xy = ([la, lo]) => [(lo - p[1]) * kx, (la - p[0]) * ky];
  let min = Infinity;
  for (const l of partes) for (let i = 1; i < l.length; i++) {
    const [ax, ay] = xy(l[i - 1]), [bx, by] = xy(l[i]), dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

function consultar(camadas, gps) {
  if (!gps) return [];
  const p = [gps.lat, gps.lon], out = [];
  for (const c of camadas) for (const f of c.feicoes) {
    if (f.tipo === 'area' && dentro(p, f.partes)) out.push({ camada: c.nome, feicao: f.nome, dentro: true, ...(c.uc && { uc: c.uc }) });
    if (f.tipo === 'linha') { const d = distLinha(p, f.partes); if (d <= LIMITE_M) out.push({ camada: c.nome, feicao: f.nome, distM: Math.round(d) }); }
  }
  return out;
}

globalThis.Camadas = { lerCamada, textoCamada, consultar };
})();
