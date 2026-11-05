import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../normas.js';
import '../docs.js';
const { checar, rito, crimesDe, agravantes } = globalThis.Normas;
const { notificacao, termoApreensao, autoConstatacao, historicoBO, pendenciasDe, motivoSugerido, NOTIF_ABERTURA, lembreteBackup, relatorioFotografico } = globalThis.Docs;

const ab = {
  data: '2026-11-08T16:20', municipio: 'Cidreira', local: 'Lençóis Cidreirenses, margem da Lagoa da Fortaleza', gps: { lat: -30.12, lon: -50.2 },
  lugar: { via: false, feicoes: ['Campo de dunas móveis'], fixadora: true },
  veiculo: { tipo: 'UTV ou ATV', marca: 'Polaris', modelo: 'RZR', cor: 'Vermelho', semPlaca: true, chassi: '3NSABC' },
  condutor: { nome: 'FULANO DE TAL', cpf: '12345678909', cnhSit: 'Regular', cnhCat: 'B', nascimento: '1985-02-02' },
  proprietario: { mesmo: true }, dano: { vegetacao: 'Herbácea', areaM2: 35 }, condutas: {},
  providencias: [{ tipo: 'BO/TC', numero: '' }], apreensao: { base: 'penal', valor: 0, fiel: {} }, notificacao: { motivo: 'Trafegar sobre vegetação fixadora.' },
};
const motivos = checar(ab);
const r = { motivos, crimes: crimesDe(motivos), rito: rito(motivos), agravantes: agravantes(ab) };
const cfg = { agente: { nome: 'Sd Fulano', idFunc: '123', fracao: '4º Pel/1º BABM' }, comparecimento: 'Rua X, Tramandaí' };

test('notificação abre com precaução e prevenção', () => {
  const h = notificacao(ab, cfg);
  assert.ok(h.includes(NOTIF_ABERTURA));
  assert.ok(h.includes('Fulano de Tal'));
  assert.ok(h.includes('Rua X, Tramandaí'), 'comparecimento padrão de Dados');
});

test('termo traz o veículo, a base e o valor', () => {
  const h = termoApreensao({ ...ab, apreensao: { base: 'penal', valor: 85000 } }, cfg);
  assert.ok(h.includes('Polaris RZR'));
  assert.ok(h.includes('Lei 9.605/98, art. 25'));
  assert.ok(h.includes('85.000,00'));
});

test('auto de constatação: art. 119 e enquadramento sugerido', () => {
  const h = autoConstatacao(ab, cfg, r);
  assert.ok(h.includes('Latitude -30,12000'));
  assert.ok(h.includes('art. 56'));
  assert.ok(h.includes('Domingo ou feriado'));
  assert.ok(h.includes('35 m²'));
});

test('histórico do BO cita o crime e a apreensão', () => {
  const t = historicoBO(ab, r);
  assert.match(t, /art\. 50/);
  assert.match(t, /apreendido/);
  assert.match(t, /^Em 08\/11\/2026, por volta das 16:20/);
});

test('pendências', () => {
  const ks = pendenciasDe(ab, r).map(p => p.chave);
  assert.deepEqual(ks, ['num:BO/TC', 'ap-valor', 'ap-destino', 'qualificacao', 'fotos']);
  assert.ok(pendenciasDe({ ...ab, resolvidas: ['qualificacao'] }, r).every(p => p.chave !== 'qualificacao'));
  assert.ok(pendenciasDe({ ...ab, fotos: [foto] }, r).every(p => p.chave !== 'fotos'));
});

const foto = { id: 'f1', img: 'data:image/jpeg;base64,AAAA', legenda: 'Sulcos na duna frontal', data: '2026-11-08T16:22', gps: { lat: -30.12, lon: -50.2 }, origem: 'exif' };
test('relatório fotográfico: legenda, hora, coordenadas e origem', () => {
  const h = relatorioFotografico({ ...ab, fotos: [foto, { ...foto, id: 'f2', legenda: '', data: '', gps: null, origem: '' }] }, cfg);
  assert.ok(h.includes('RELATÓRIO FOTOGRÁFICO'));
  assert.ok(h.includes('Foto 1.') && h.includes('Sulcos na duna frontal'));
  assert.ok(h.includes('08/11/2026 16:22') && h.includes('-30,12000, -50,20000') && h.includes('GPS gravado na foto'));
  assert.ok(h.includes('Foto 2.') && h.includes('sem coordenadas') && h.includes('data não registrada'));
});

test('auto e histórico citam o relatório fotográfico', () => {
  const com = { ...ab, fotos: [foto, foto] };
  assert.ok(autoConstatacao(com, cfg, r).includes('relatório fotográfico com 2 fotos'));
  assert.match(historicoBO(com, r), /2 fotos \(relatório fotográfico anexo\)/);
  assert.ok(!autoConstatacao(ab, cfg, r).includes('relatório fotográfico'));
});

test('auto e pendência: como a distância da preamar foi medida', () => {
  const l = { via: false, feicoes: ['Restinga'], distPreamarM: 120 };
  const sem = { ...ab, lugar: l }, rs = { motivos: checar(sem), crimes: [], rito: rito([]), agravantes: [] };
  assert.ok(pendenciasDe(sem, rs).some(p => p.chave === 'medicao'));
  const com = { ...ab, lugar: { ...l, distMetodo: 'Trena' } };
  assert.ok(!pendenciasDe(com, rs).some(p => p.chave === 'medicao'));
  assert.ok(autoConstatacao(com, cfg, rs).includes('Distância da linha de preamar máxima: 120 m (medição: trena)'));
});

test('duna frontal sem vegetação marcada: pendência para informar a vegetação', () => {
  const a = { ...ab, lugar: { via: false, feicoes: ['Duna frontal'] }, dano: { vegetacao: 'Nenhuma' } }, ms = checar(a);
  const rs = { motivos: ms, crimes: crimesDe(ms), rito: rito(ms), agravantes: [] };
  assert.ok(pendenciasDe(a, rs).some(p => p.chave === 'vegetacao'));
  assert.ok(!pendenciasDe({ ...a, dano: { vegetacao: 'Herbácea' } }, rs).some(p => p.chave === 'vegetacao'));
});

test('motivo sugerido usa os vermelhos', () => assert.match(motivoSugerido(motivos), /fixadora/));
test('lembrete de backup', () => {
  assert.equal(lembreteBackup(null, '2026-11-04', false), null);
  assert.match(lembreteBackup('2026-10-01', '2026-11-04', true), /34 dias/);
});

test('documentos levam o fato, nunca a orientação ao agente', () => {
  const t = historicoBO(ab, r) + motivoSugerido(motivos);
  assert.ok(!/fotografe|perícia|Termo de apreensão sem valor/i.test(t));
});
