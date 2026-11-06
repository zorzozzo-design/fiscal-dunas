import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../normas.js';
import '../docs.js';
const { numerar, cpfValido, placaValida, chassiValido, resumoPeriodo, csvAbordagens, notificacao, notificacaoTermica, pendenciasDe } = globalThis.Docs;
const { checar, rito, crimesDe } = globalThis.Normas;

test('numeração: FD-idFunc-ano-seq, contador que nunca volta', () => {
  const cfg = {};
  assert.equal(numerar(cfg, {}, '2026', '1234567'), 'FD-1234567-2026-0001');
  assert.equal(cfg.numeracao['2026'], 1);
  assert.equal(numerar(cfg, {}, '2026', '1234567'), 'FD-1234567-2026-0002', 'abordagem apagada não devolve o número');
  assert.equal(numerar(cfg, {}, '2027', '1234567'), 'FD-1234567-2027-0001', 'reinicia no ano novo');
  const abs = { x: { numero: 'FD-1234567-2026-0040' } };
  assert.equal(numerar({}, abs, '2026', '1234567'), 'FD-1234567-2026-0041', 'backup de outro aparelho: segue do maior');
  assert.equal(numerar({}, {}, '2026', ''), 'FD-SEMID-2026-0001');
});

test('documentos levam o número e o tipo', () => {
  const ab = { numero: 'FD-1234567-2026-0007', data: '2026-11-08T16:20', municipio: 'Cidreira', local: 'Tuia', condutor: { nome: 'A' }, notificacao: { motivo: 'x' } };
  assert.ok(notificacao(ab, {}).includes('Nº FD-1234567-2026-0007/N'));
  assert.ok(notificacaoTermica(ab, {}).includes('FD-1234567-2026-0007/N'));
});

test('CPF, placa e chassi', () => {
  assert.ok(cpfValido('12345678909'));
  assert.ok(!cpfValido('12345678900'));
  assert.ok(!cpfValido('11111111111'));
  assert.ok(placaValida('IZA2B34') && placaValida('ABC-1234') && placaValida('abc1234'));
  assert.ok(!placaValida('AB1234') && !placaValida('ABCD123'));
  assert.ok(chassiValido('9BWZZZ377VT004251'));
  assert.ok(!chassiValido('9BWZZZ377VT00425') && !chassiValido('9BWZZZ377VT0O4251'), '17 caracteres, sem I, O ou Q');
});

test('pendências de conferência, dispensáveis', () => {
  const ab = { data: '2026-11-08T16:20', lugar: {}, veiculo: { placa: 'AB1234', chassi: '123' }, condutor: { nome: 'A', cpf: '12345678900' }, proprietario: { mesmo: true }, dano: {}, condutas: {}, providencias: [] };
  const ms = checar(ab), r = { motivos: ms, crimes: crimesDe(ms), rito: rito(ms) };
  const ks = pendenciasDe(ab, r).map(p => p.chave);
  assert.ok(['cpf', 'placa', 'chassi'].every(k => ks.includes(k)), ks.join());
  assert.ok(!pendenciasDe({ ...ab, resolvidas: ['cpf', 'placa', 'chassi'] }, r).some(p => ['cpf', 'placa', 'chassi'].includes(p.chave)));
});

const itens = [
  { ab: { numero: 'FD-1-2026-0001', data: '2026-11-02T10:00', municipio: 'Cidreira', local: 'Tuia "norte"', veiculo: { placa: 'IZA2B34', tipo: 'UTV ou ATV' }, condutor: { nome: 'JOÃO; DA SILVA', cpf: '12345678909' }, notificacao: { motivo: 'x' }, apreensao: { base: 'penal' }, fotos: [{}, {}] }, crimes: ['L9605-50'], rito: 'TC' },
  { ab: { numero: 'FD-1-2026-0002', data: '2026-11-03T10:00', municipio: 'Tramandaí', local: '', veiculo: {}, condutor: {} }, crimes: [], rito: '' },
  { ab: { numero: 'FD-1-2026-0003', data: '2026-11-04T10:00', municipio: 'Cidreira', veiculo: {}, condutor: {} }, crimes: ['L9605-50', 'CTB-308'], rito: 'DP' },
];
test('resumo do período', () => {
  const r = resumoPeriodo(itens);
  assert.equal(r.total, 3);
  assert.equal(r.notificacoes, 1);
  assert.equal(r.apreensoes, 1);
  assert.equal(r.comCrime, 2);
  assert.deepEqual(r.porCrime[0], ['L9605-50', 2]);
  assert.deepEqual(r.porMunicipio[0], ['Cidreira', 2]);
});
test('CSV para planilha: ponto e vírgula, aspas e uma linha por abordagem', () => {
  const linhas = csvAbordagens(itens).replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(linhas.length, 4);
  assert.match(linhas[0], /^Número;Data;Hora;Município/);
  assert.ok(linhas[1].includes('"João; da Silva"'), linhas[1]);
  assert.ok(linhas[1].includes('"Tuia ""norte"""'), linhas[1]);
  assert.ok(linhas[1].includes('Lei 9.605/98, art. 50'));
});
