import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../normas.js';
const { checar, classificar, rito, crimesDe, basesApreensao, agravantes, feriado, idade, areasDoPonto, faixaLagoa } = globalThis.Normas;

// Abordagem base: duna fora de via, sem dano, quarta-feira de manhã.
const ab = (x = {}) => ({ data: '2026-11-04T10:00', lugar: { via: false, feicoes: [], ...x.lugar }, veiculo: { tipo: '4x4', ...x.veiculo },
  condutor: { cnhSit: 'Regular', cnhCat: 'B', nascimento: '1990-01-01', ...x.condutor }, proprietario: { ...x.proprietario },
  dano: { vegetacao: 'Nenhuma', ...x.dano }, condutas: { ...x.condutas }, apreensao: x.apreensao ?? null, reincidencia: x.reincidencia || '' });
const regras = (a, ctx) => checar(a, ctx).map(m => m.regra);
const tem = (a, r, ctx) => regras(a, ctx).includes(r);
const de = (a, r, ctx) => checar(a, ctx).filter(m => m.regra === r);

test('D01: fora de via avisa que o CTB administrativo não vale', () => {
  assert.ok(tem(ab(), 'D01'));
  assert.ok(!tem(ab({ lugar: { via: true } }), 'D01', { convenio: true }));
});

test('D02: em via sem convênio, não lavra AIT', () => {
  assert.ok(tem(ab({ lugar: { via: true } }), 'D02'));
  assert.ok(!tem(ab({ lugar: { via: true } }), 'D02', { convenio: true }));
});

test('D03: sulcos em duna frontal ou campo de dunas sugerem art. 63 com laudo', () => {
  const m = de(ab({ lugar: { feicoes: ['Campo de dunas móveis'] }, dano: { sulcos: true } }), 'D03');
  assert.equal(m[0].nivel, 'amarelo');
  assert.equal(m[0].crime, 'L9605-63');
  assert.ok(!tem(ab({ lugar: { feicoes: ['Restinga'] }, dano: { sulcos: true } }), 'D03'));
});

test('D04: restinga é APP até 300 m da preamar', () => {
  assert.equal(classificar({ feicoes: ['Restinga'], distPreamarM: 300 }).app[0][0], 'D04');
  assert.equal(classificar({ feicoes: ['Restinga'], distPreamarM: 301 }).app.length, 0);
  assert.ok(tem(ab({ lugar: { feicoes: ['Restinga'], distPreamarM: 120 }, dano: { vegetacao: 'Herbácea' } }), 'D04'));
});

test('D05: vegetação fixadora danificada = art. 50 e Dec. art. 56, em qualquer distância', () => {
  const m = de(ab({ lugar: { fixadora: true, distPreamarM: 2000 }, dano: { vegetacao: 'Herbácea', areaM2: 40 } }), 'D05')[0];
  assert.equal(m.nivel, 'vermelho');
  assert.equal(m.crime, 'L9605-50');
  assert.match(m.enquadramento, /art\. 56/);
  assert.ok(!tem(ab({ lugar: { fixadora: true } }), 'D05'), 'sem dano, sem enquadramento');
});

test('D06: faixa da lagoa 100 m rural, 50 m até 20 ha, 30 m urbana', () => {
  assert.equal(faixaLagoa({ zona: 'rural' }), 100);
  assert.equal(faixaLagoa({ zona: 'rural', ate20ha: true }), 50);
  assert.equal(faixaLagoa({ zona: 'urbana' }), 30);
  assert.ok(tem(ab({ lugar: { lagoa: { distM: 80, zona: 'rural' } }, dano: { vegetacao: 'Herbácea' } }), 'D06'));
  assert.ok(!tem(ab({ lugar: { lagoa: { distM: 80, zona: 'rural', ate20ha: true } }, dano: { vegetacao: 'Herbácea' } }), 'D06'));
});

test('D07: UC dobra as multas; UC federal avisa competência', () => {
  const ms = de(ab({ lugar: { uc: 'federal', fixadora: true }, dano: { vegetacao: 'Herbácea' } }), 'D07');
  assert.equal(ms.length, 2);
  assert.equal(ms[0].crime, 'L9605-40');
  assert.match(de(ab({ lugar: { uc: 'estadual', fixadora: true }, dano: { vegetacao: 'Herbácea' } }), 'D05')[0].enquadramento, /em dobro/);
});

test('D08: possível bem da União', () => assert.ok(tem(ab({ lugar: { marinha: true } }), 'D08')));

test('D09: até 2 anos somados é TC; acima, DP', () => {
  assert.equal(rito(checar(ab({ lugar: { fixadora: true }, dano: { vegetacao: 'Herbácea' } }))).rito, 'TC');
  const dois = checar(ab({ lugar: { fixadora: true }, dano: { vegetacao: 'Herbácea', tocaNinho: true } }));
  assert.equal(rito(dois).meses, 24);
  assert.equal(rito(dois).rito, 'TC');
  const tres = checar(ab({ lugar: { fixadora: true }, dano: { vegetacao: 'Herbácea', tocaNinho: true, areia: true } }));
  assert.equal(rito(tres).rito, 'DP');
  assert.equal(rito(checar(ab({ condutas: { embriaguez: true } }))).rito, 'DP');
  assert.equal(rito(checar(ab())).rito, null);
  const amarelo = rito(checar(ab({ lugar: { feicoes: ['Duna frontal'] }, dano: { sulcos: true } })));
  assert.equal(amarelo.rito, null);
  assert.equal(amarelo.seConfirmar, 'DP');
  assert.equal(crimesDe(dois).length, 2);
});

test('D10: bases de apreensão', () => {
  const crime = ab({ lugar: { fixadora: true }, dano: { vegetacao: 'Herbácea' } });
  const bs = basesApreensao(crime, checar(crime));
  assert.ok(bs.find(b => b.base === 'penal').ok);
  assert.ok(!bs.find(b => b.base === 'administrativa').ok, 'sem posse ilícita, alteração ou uso reiterado');
  assert.ok(!bs.find(b => b.base === 'transito').ok, 'fora de via');
  assert.ok(basesApreensao(ab(), [], { historico: 2 }).find(b => b.base === 'administrativa').ok);
  const via = ab({ lugar: { via: true }, veiculo: { semPlaca: true } });
  assert.ok(!basesApreensao(via, checar(via)).find(b => b.base === 'transito').ok, 'sem convênio');
  assert.ok(basesApreensao(via, checar(via, { convenio: true }), { convenio: true }).find(b => b.base === 'transito').ok);
});

test('D11: histórico do veículo ou da pessoa marca uso reiterado', () => {
  assert.ok(tem(ab(), 'D11', { historico: 1 }));
  assert.ok(!tem(ab(), 'D11'));
});

test('D12 e D15: agravantes', () => {
  const a = agravantes(ab({ data: 'x', reincidencia: '123/2025', lugar: { fixadora: true } }));
  assert.ok(a.some(x => x.startsWith('Reincidência')));
  assert.ok(a.includes('Área legalmente protegida'));
  assert.ok(agravantes({ ...ab(), data: '2026-11-08T10:00' }).includes('Domingo ou feriado'), 'domingo');
  assert.ok(agravantes({ ...ab(), data: '2026-11-20T10:00' }).includes('Domingo ou feriado'), 'Consciência Negra');
  assert.ok(agravantes({ ...ab(), data: '2026-04-03T10:00' }).includes('Domingo ou feriado'), 'Sexta-feira Santa de 2026');
  assert.ok(!feriado('2026-11-04'));
  assert.ok(agravantes({ ...ab(), data: '2026-11-04T19:30' }).includes('Período noturno (18h às 6h)'));
  assert.ok(agravantes({ ...ab(), data: '2026-11-04T05:59' }).includes('Período noturno (18h às 6h)'));
  assert.ok(!agravantes({ ...ab(), data: '2026-11-04T06:00' }).includes('Período noturno (18h às 6h)'));
});

test('D13 e D14: fiel depositário com histórico e termo sem valor', () => {
  assert.ok(tem(ab({ apreensao: { valor: 5000, fiel: { autuado: true } } }), 'D13', { historico: 1 }));
  assert.equal(de(ab({ apreensao: { valor: null } }), 'D14')[0].nivel, 'amarelo');
  assert.ok(!tem(ab({ apreensao: { valor: 5000 } }), 'D14'));
});

test('D16: embriaguez é crime em qualquer local; infração só em via', () => {
  const fora = de(ab({ condutas: { embriaguez: true } }), 'D16')[0];
  assert.equal(fora.crime, 'CTB-306');
  assert.equal(fora.enquadramento, '');
  assert.match(de(ab({ lugar: { via: true }, condutas: { embriaguez: true } }), 'D16', { convenio: true })[0].enquadramento, /165/);
});

test('D17: menor conduzindo e art. 310 para quem entregou, em qualquer local', () => {
  assert.equal(idade('2010-11-05', '2026-11-04'), 15);
  const ms = de(ab({ condutor: { nascimento: '2010-01-01', cnhSit: 'Sem CNH' }, proprietario: { entregouDirecao: true } }), 'D17');
  assert.equal(ms.length, 2);
  assert.equal(ms[1].crime, 'CTB-310');
});

test('D18: sem placa só gera infração em via', () => {
  assert.equal(de(ab({ veiculo: { tipo: 'Quadriciclo', semPlaca: true } }), 'D18')[0].nivel, 'info');
  assert.equal(de(ab({ lugar: { via: true }, veiculo: { semPlaca: true } }), 'D18', { convenio: true })[0].norma, 'CTB, art. 230, IV');
  assert.equal(de(ab({ lugar: { via: true }, veiculo: { registro: 'Não licenciado' } }), 'D18', { convenio: true })[0].norma, 'CTB, art. 230, V');
});

test('D19: toca ou ninho; espécie ameaçada vale 250 UPF', () => {
  assert.match(de(ab({ dano: { tocaNinho: true } }), 'D19')[0].enquadramento, /25 UPF/);
  assert.match(de(ab({ dano: { tocaNinho: true, ameacada: true } }), 'D19')[0].enquadramento, /250 UPF/);
});

test('D20: sem irregularidade, orientação', () => {
  assert.ok(tem(ab(), 'D20'));
  assert.ok(!tem(ab({ lugar: { fixadora: true }, dano: { vegetacao: 'Herbácea' } }), 'D20'));
});

test('D21 e D22: trilha reiterada e Mata Atlântica em estágio médio', () => {
  assert.equal(de(ab({ lugar: { fixadora: true }, dano: { reiterada: true } }), 'D21')[0].crime, 'L9605-48');
  assert.equal(de(ab({ dano: { vegetacao: 'Arbustiva', estagio: 'Médio' } }), 'D22')[0].crime, 'L9605-38A');
  assert.ok(!tem(ab({ dano: { vegetacao: 'Herbácea', estagio: 'Médio' } }), 'D22'));
});

test('D23: extração de areia; em duna também art. 44; em bem da União, Lei 8.176', () => {
  assert.deepEqual(de(ab({ dano: { areia: true } }), 'D23').map(m => m.crime), ['L9605-55']);
  assert.deepEqual(de(ab({ lugar: { feicoes: ['Duna frontal'], marinha: true }, dano: { areia: true } }), 'D23').map(m => m.crime), ['L9605-55', 'L9605-44', 'L8176-2']);
});

test('D24 a D27: fuga, evento, habilitação e condutas na via', () => {
  assert.equal(de(ab({ condutas: { fuga: true } }), 'D24')[0].crime, 'L9605-69');
  assert.ok(tem(ab({ condutas: { evento: true } }), 'D25'));
  assert.ok(!tem(ab({ condutor: { cnhSit: 'Sem CNH' } }), 'D26'), 'fora de via, sem CNH não é crime nem infração');
  assert.equal(de(ab({ lugar: { via: true }, condutor: { cnhSit: 'Sem CNH' }, condutas: { perigoDano: true } }), 'D26', { convenio: true })[0].crime, 'CTB-309');
  assert.ok(tem(ab({ lugar: { via: true }, veiculo: { tipo: 'Quadriciclo' }, condutor: { cnhCat: 'A' } }), 'D26', { convenio: true }));
  assert.ok(!tem(ab({ lugar: { via: true }, veiculo: { tipo: 'Quadriciclo' }, condutor: { cnhCat: 'AB' } }), 'D26', { convenio: true }));
  assert.ok(!tem(ab({ condutas: { manobra: true } }), 'D27'), 'manobra fora de via');
  assert.equal(de(ab({ condutas: { velocidadePessoas: true } }), 'D27')[0].crime, 'CTB-311');
});

test('GPS no corredor eólico dos Lençóis Cidreirenses', () => {
  assert.equal(areasDoPonto({ lat: -30.123, lon: -50.195 }).length, 1);
  assert.equal(areasDoPonto({ lat: -29.98, lon: -50.13 }).length, 0);
  assert.equal(areasDoPonto(null).length, 0);
});
