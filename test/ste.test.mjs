// Textos que o agente lê (Guia, dicas e avisos do painel, pendências) seguem o ASD-STE100 adaptado ao português:
// frase com até 25 palavras e instrução no imperativo. Os documentos oficiais ficam fora desta regra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../normas.js';
import '../docs.js';
const { checar, GUIA, rito, crimesDe } = globalThis.Normas;
const { pendenciasDe } = globalThis.Docs;

const frases = t => t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔ])/).filter(Boolean);
const palavras = f => f.split(/\s+/).filter(Boolean).length;
const longas = textos => textos.flatMap(t => frases(t)).filter(f => palavras(f) > 25);

// Cenários que acendem as regras D01 a D27.
const base = { data: '2026-11-08T19:00', veiculo: { tipo: 'Quadriciclo', semPlaca: true }, proprietario: { entregouDirecao: true },
  condutor: { cnhSit: 'Sem CNH', nascimento: '2010-01-01' }, apreensao: { base: 'penal', valor: 0, fiel: { autuado: true } } };
const cenarios = [
  { ...base, lugar: { via: false, feicoes: ['Duna frontal', 'Restinga'], distPreamarM: 100, distMetodo: 'Estimativa', uc: 'federal', marinha: true },
    dano: { vegetacao: 'Arbórea', estagio: 'Médio', sulcos: true, reiterada: true, tocaNinho: true, areia: true }, condutas: { fuga: true, evento: true, embriaguez: true } },
  { ...base, lugar: { via: true, feicoes: ['Restinga'], distPreamarM: 200, fixadora: true }, dano: { vegetacao: 'Herbácea' },
    condutor: { cnhSit: 'Sem CNH', nascimento: '1990-01-01' }, condutas: { perigoDano: true, manobra: true, racha: true, velocidadePessoas: true, semCapacete: true } },
  { data: '2026-11-04T10:00', lugar: { via: false, feicoes: ['Campo de dunas móveis'] }, veiculo: { tipo: '4x4' }, condutor: {}, dano: { vegetacao: 'Nenhuma' }, condutas: {} },
];
const motivos = cenarios.flatMap(a => [...checar(a, {}), ...checar(a, { convenio: true, historico: 2 })]);

test('Guia: frases com até 25 palavras', () => assert.deepEqual(longas(GUIA.map(([, x]) => x)), []));
test('painel: dicas e avisos com até 25 palavras por frase', () =>
  assert.deepEqual(longas(motivos.flatMap(m => [m.dica, m.interno ? m.texto : ''].filter(Boolean))), []));
test('pendências: uma instrução no imperativo', () => {
  const ps = cenarios.flatMap(a => { const ms = checar(a); return pendenciasDe({ ...a, providencias: [{ tipo: 'BO/TC' }], notificacao: {} },
    { motivos: ms, crimes: crimesDe(ms), rito: rito(ms) }); });
  assert.ok(ps.length >= 6);
  for (const p of ps) assert.match(p.texto, /^(Identifique|Informe|Faça|Complete|Peça|Fotografe) [^.]*\.$/, p.texto);
});
