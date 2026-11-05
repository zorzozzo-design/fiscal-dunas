import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../camadas.js';
const { lerCamada, consultar } = globalThis.Camadas;

// Quadrado de ~1,1 km com um furo no meio, e uma linha leste-oeste em -30.1.
const geo = JSON.stringify({ type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { nome: 'Parque X' }, geometry: { type: 'Polygon', coordinates: [
    [[-50.20, -30.20], [-50.19, -30.20], [-50.19, -30.19], [-50.20, -30.19], [-50.20, -30.20]],
    [[-50.197, -30.197], [-50.193, -30.197], [-50.193, -30.193], [-50.197, -30.193], [-50.197, -30.197]]] } },
  { type: 'Feature', properties: { name: 'Preamar' }, geometry: { type: 'LineString', coordinates: [[-50.30, -30.10], [-50.10, -30.10]] } },
  { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[[[-50.0, -30.0], [-49.99, -30.0], [-49.99, -29.99], [-50.0, -30.0]]]] } },
  { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-50, -30] } },
] });

test('GeoJSON: áreas, furo, linha e nome', () => {
  const c = lerCamada(geo, 'ucs.geojson');
  assert.equal(c.nome, 'ucs');
  assert.equal(c.feicoes.length, 3, 'ponto é ignorado');
  assert.deepEqual(consultar([c], { lat: -30.199, lon: -50.199 }).filter(r => r.dentro).map(r => r.feicao), ['Parque X']);
  assert.equal(consultar([c], { lat: -30.195, lon: -50.195 }).filter(r => r.dentro).length, 0, 'no furo não está dentro');
  assert.equal(consultar([c], { lat: -29.999, lon: -49.995 }).filter(r => r.dentro)[0].feicao, 'Feição 3');
});

test('distância à linha em metros', () => {
  const c = lerCamada(geo, 'ucs.geojson');
  const r = consultar([c], { lat: -30.101, lon: -50.2 }).find(x => x.feicao === 'Preamar');
  assert.ok(Math.abs(r.distM - 111) <= 2, `distância ${r.distM}`);
  assert.equal(consultar([c], { lat: -30.3, lon: -50.2 }).find(x => x.feicao === 'Preamar'), undefined, 'linha a mais de 2 km não aparece');
});

test('KML: polígono e linha', () => {
  const kml = `<?xml version="1.0"?><kml><Document><name>Camada KML</name>
    <Placemark><name>Dunas &amp; restinga</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
      -50.20,-30.20,0 -50.19,-30.20,0 -50.19,-30.19,0 -50.20,-30.19,0 -50.20,-30.20,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
    <Placemark><name>Margem</name><LineString><coordinates>-50.30,-30.10 -50.10,-30.10</coordinates></LineString></Placemark>
  </Document></kml>`;
  const c = lerCamada(kml, 'x.kml');
  assert.equal(c.nome, 'Camada KML');
  const r = consultar([c], { lat: -30.195, lon: -50.195 });
  assert.equal(r.find(x => x.dentro).feicao, 'Dunas & restinga');
  assert.equal(r.find(x => x.feicao === 'Margem'), undefined);
  assert.ok(Math.abs(consultar([c], { lat: -30.1005, lon: -50.2 }).find(x => x.feicao === 'Margem').distM - 55) <= 2);
});

test('arquivo sem feições ou inválido: erro claro', () => {
  assert.throws(() => lerCamada('{"type":"FeatureCollection","features":[]}', 'a.geojson'), /Nenhuma área ou linha/);
  assert.throws(() => lerCamada('isto não é camada', 'a.txt'), /KML ou GeoJSON/);
});
