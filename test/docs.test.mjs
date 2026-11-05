import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../normas.js';
import '../docs.js';
const { checar, rito, crimesDe, agravantes } = globalThis.Normas;
const { notificacao, termoApreensao, autoConstatacao, historicoBO, pendenciasDe, motivoSugerido, NOTIF_ABERTURA, lembreteBackup } = globalThis.Docs;

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
  assert.deepEqual(ks, ['num:BO/TC', 'ap-valor', 'ap-destino', 'qualificacao']);
  assert.ok(pendenciasDe({ ...ab, resolvidas: ['qualificacao'] }, r).every(p => p.chave !== 'qualificacao'));
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
