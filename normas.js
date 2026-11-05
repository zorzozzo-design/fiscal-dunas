// Classificação do local e regras D01 a D27, checadas ao vivo na abordagem.
// Fonte de cada regra: documento "Fiscal Dunas: base legal e regras do app". Indica e sugere enquadramento, não autua.
(() => {

// Crimes usados nas regras: pena máxima em meses (para o rito, Lei 9.099/95, art. 61).
const CRIMES = {
  'L9605-29': ['Lei 9.605/98, art. 29, §1º, II (destruir ninho, abrigo ou criadouro)', 12],
  'L9605-38A': ['Lei 9.605/98, art. 38-A (vegetação de Mata Atlântica em estágio médio ou avançado)', 36],
  'L9605-40': ['Lei 9.605/98, art. 40 (dano a Unidade de Conservação)', 60],
  'L9605-44': ['Lei 9.605/98, art. 44 (extrair areia de APP sem autorização)', 12],
  'L9605-48': ['Lei 9.605/98, art. 48 (impedir a regeneração natural)', 12],
  'L9605-50': ['Lei 9.605/98, art. 50 (danificar vegetação fixadora de dunas)', 12],
  'L9605-55': ['Lei 9.605/98, art. 55 (extração mineral sem autorização)', 12],
  'L9605-63': ['Lei 9.605/98, art. 63 (alterar local especialmente protegido)', 36],
  'L9605-69': ['Lei 9.605/98, art. 69 (obstar ou dificultar a fiscalização)', 36],
  'L8176-2': ['Lei 8.176/91, art. 2º (usurpação de bem da União)', 60],
  'CTB-306': ['CTB, art. 306 (embriaguez ao volante)', 36],
  'CTB-308': ['CTB, art. 308 (racha em via pública)', 36],
  'CTB-309': ['CTB, art. 309 (dirigir sem habilitação gerando perigo de dano)', 12],
  'CTB-310': ['CTB, art. 310 (entregar a direção a não habilitado)', 12],
  'CTB-311': ['CTB, art. 311 (velocidade incompatível onde há concentração de pessoas)', 12],
};
const DEC = 'Dec. RS 55.374/2020';
const FEICOES = ['Duna frontal', 'Campo de dunas móveis', 'Banhado', 'Capão de mata em margem de lagoa', 'Restinga', 'Faixa de praia'];
// Lei 15.434/2020, art. 208: ambientes da Zona Costeira com uso restrito ao que garanta a conservação.
const PROTEGIDAS = new Set(['Duna frontal', 'Campo de dunas móveis', 'Banhado', 'Capão de mata em margem de lagoa']);
// Res. CONAMA 303/2002, art. 2º, VIII: a restinga inclui as dunas; até 300 m da preamar é APP (art. 3º, IX, a).
const RESTINGA_300 = ['Restinga', 'Duna frontal', 'Campo de dunas móveis'];
const METODOS_PREAMAR = ['', 'GPS e camada de preamar', 'Trena', 'Imagem de satélite', 'Estimativa'];
const TIPOS_SEM_PLACA = new Set(['Quadriciclo', 'UTV ou ATV', 'Moto de trilha']);

// Diretrizes Ambientais do Litoral Norte (SEMA/FEPAM, 2024), diretriz 1.3: corredor de alimentação eólica dos Lençóis
// Cidreirenses, entre a Lagoa Fortaleza e o oceano (pontos 1, 2, 4 e 3, SIRGAS 2000).
const CORREDOR_LENCOIS = [[-30.107732, -50.17516], [-30.121254, -50.209191], [-30.138707, -50.211827], [-30.127295, -50.183178]];
const noPoligono = (p, vs) => { let d = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
  const [yi, xi] = vs[i], [yj, xj] = vs[j]; if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) d = !d; } return d; };
const areasDoPonto = gps => gps && noPoligono([gps.lat, gps.lon], CORREDOR_LENCOIS)
  ? ['Corredor de alimentação eólica dos Lençóis Cidreirenses (Diretrizes Ambientais do Litoral Norte, diretriz 1.3)'] : [];

// Código Florestal, art. 4º, II: faixa da lagoa natural (rural 100 m, ou 50 m até 20 ha; urbana 30 m).
const faixaLagoa = l => l.zona === 'urbana' ? 30 : l.ate20ha ? 50 : 100;

// Perguntas 1 a 6 da classificação do local.
function classificar(lugar = {}) {
  const fs = lugar.feicoes || [], app = [];
  // [regra, motivo, norma]: a regra da APP que vale para o dano.
  if (lugar.fixadora) app.push(['D05', 'Vegetação fixadora de dunas', 'Lei 12.651/2012, art. 4º, VI']);
  const rest = fs.find(f => RESTINGA_300.includes(f));
  if (rest && lugar.distPreamarM != null && lugar.distPreamarM <= 300)
    app.push(['D04', `${rest} a ${lugar.distPreamarM} m da preamar máxima`, 'Res. CONAMA 303/2002, art. 3º, IX; STJ, REsp 1.827.303/SC']);
  if (lugar.lagoa?.distM != null && lugar.lagoa.distM <= faixaLagoa(lugar.lagoa))
    app.push(['D06', `A ${lugar.lagoa.distM} m da lagoa (faixa de ${faixaLagoa(lugar.lagoa)} m)`, 'Lei 12.651/2012, art. 4º, II']);
  if (fs.includes('Banhado')) app.push(['D03', 'Banhado', 'Lei 15.434/2020, art. 144']);
  return { via: !!lugar.via, zonaCosteira: fs.some(f => PROTEGIDAS.has(f)), app, uc: lugar.uc || '', marinha: !!lugar.marinha, privada: !!lugar.privada };
}

// Páscoa (algoritmo de Meeus) para a Sexta-feira Santa.
function pascoa(a) {
  const b = Math.floor(a / 100), c = a % 100, d = (19 * (a % 19) + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const e = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - d - (c % 4)) % 7, f = d + e - 7 * Math.floor(((a % 19) + 11 * d + 22 * e) / 451) + 114;
  return new Date(Date.UTC(a, Math.floor(f / 31) - 1, (f % 31) + 1));
}
// Feriados nacionais e o estadual de 20/09 (Lei RS 4.850/1964).
const FIXOS = ['01-01', '04-21', '05-01', '09-07', '09-20', '10-12', '11-02', '11-15', '11-20', '12-25'];
function feriado(dia) {
  if (FIXOS.includes(dia.slice(5, 10))) return true;
  const s = pascoa(+dia.slice(0, 4)); s.setUTCDate(s.getUTCDate() - 2);
  return s.toISOString().slice(0, 10) === dia.slice(0, 10);
}
const diaSemana = dia => new Date(dia.slice(0, 10) + 'T12:00Z').getUTCDay();

// Agravantes do Dec. RS 55.374/2020, art. 6º, que o app identifica sozinho.
function agravantes(ab, ctx = {}) {
  const c = classificar(ab.lugar), out = [], data = ab.data || '';
  if (ab.reincidencia) out.push(`Reincidência (auto nº ${ab.reincidencia}, art. 21)`);
  if (c.zonaCosteira || c.app.length) out.push('Área legalmente protegida');
  if (c.uc || ab.lugar?.amortecimento) out.push('Unidade de Conservação ou zona de amortecimento');
  if (ab.condutas?.fuga) out.push('Obstrução da fiscalização');
  if (ab.dano?.ameacada) out.push('Espécie ameaçada');
  if (ab.dano?.tocaNinho) out.push('Sítio reprodutivo de fauna');
  if (data && (diaSemana(data) === 0 || feriado(data))) out.push('Domingo ou feriado');
  const h = +data.slice(11, 13);
  if (data.length >= 13 && (h >= 18 || h < 6)) out.push('Período noturno (18h às 6h)');
  return out;
}

const idade = (nasc, data) => {
  if (!nasc || !data) return null;
  let a = +data.slice(0, 4) - +nasc.slice(0, 4);
  if (data.slice(5, 10) < nasc.slice(5, 10)) a--;
  return a;
};

// Regras. ctx: { convenio: município com convênio de trânsito, historico: abordagens anteriores do mesmo veículo ou pessoa }.
function checar(ab, ctx = {}) {
  const out = [];
  // texto = o fato (vai para notificação e BO); dica = orientação ao agente (só no painel); interno = aviso do app, fora dos documentos.
  const add = (regra, nivel, texto, norma, enquadramento = '', crime = '', dica = '', interno = false) => out.push({ regra, nivel, texto, norma, enquadramento, crime, dica, interno });
  const aviso = (regra, nivel, texto, norma) => add(regra, nivel, texto, norma, '', '', '', true);
  const c = classificar(ab.lugar), d = ab.dano || {}, v = ab.veiculo || {}, k = ab.condutas || {}, cond = ab.condutor || {};
  const ehApp = c.app.length > 0, ap300 = c.app.some(a => a[0] === 'D04');
  const comDano = d.vegetacao && d.vegetacao !== 'Nenhuma';
  const emUc = !!c.uc;
  const dobro = emUc ? ' (em dobro: UC, art. 108)' : '';

  // D01 e D02: a matriz de trânsito administrativa só vale em via e com convênio.
  if (c.via && !ctx.convenio) aviso('D02', 'amarelo', 'Este município está sem convênio de trânsito. Não lavre AIT. Registre o fato e chame o órgão de trânsito.', 'CTB, art. 23, III');
  if (!c.via) aviso('D01', 'info', 'Fora de via, o CTB não tem infração administrativa. Use a matriz ambiental e os crimes que não exigem via pública.', 'CTB, arts. 1º e 2º');

  // D03: duna frontal, campo de dunas móveis, banhado ou capão de mata (Zona Costeira).
  if (c.zonaCosteira && d.sulcos)
    add('D03', 'amarelo', 'Sulcos, rampas ou cortes em ambiente especialmente protegido da Zona Costeira.',
      'Lei 15.434/2020, art. 208', `Infração: ${DEC}, art. 89 (500 a 10.000 UPF)${dobro}`, 'L9605-63', 'Enquadre só com laudo da alteração.');

  // D04 a D06: APP. Dano com vegetação fixadora = art. 50; outra APP = Dec. art. 56, crime a conferir.
  // Veículo sobre duna frontal (faixa da preamar) sempre danifica a vegetação fixadora: dano presumido.
  const dunaFrontal = (ab.lugar?.feicoes || []).includes('Duna frontal');
  const area = d.areaM2 ? ` (${d.areaM2} m²)` : '';
  if (dunaFrontal || (comDano && ab.lugar?.fixadora))
    // O documento só afirma o dano depois que o agente marca a vegetação atingida.
    add('D05', 'vermelho', dunaFrontal ? `Veículo sobre duna frontal, na faixa da preamar${comDano ? `, danificando a vegetação fixadora${area}` : ''}.` : `Vegetação fixadora de dunas danificada${area}.`,
      'Lei 12.651/2012, art. 4º, VI', `Infração: ${DEC}, art. 56 (250 a 2.500 UPF por ha ou fração)${dobro}`, 'L9605-50',
      dunaFrontal ? 'O painel presume o dano. Marque a vegetação atingida. Descreva no histórico a vegetação esmagada. Fotografe o rastro.' : 'Descreva a vegetação. Fotografe o dano. Peça perícia.');
  else if (comDano && ehApp)
    add(c.app[0][0], 'vermelho', `Vegetação nativa danificada em APP (${c.app.map(a => a[1].toLowerCase()).join('; ')}).`,
      c.app.map(a => a[2]).join('; '), `Infração: ${DEC}, art. 56 (250 a 2.500 UPF por ha ou fração)${dobro}. Crime a conferir: art. 48 ou art. 38`, '',
      ap300 ? 'A APP dos 300 m vem de um precedente da 2ª Turma do STJ, não vinculante. Registre a medição e a vegetação de restinga.' : '');
  if (ap300 && ab.lugar.distMetodo === 'Estimativa')
    aviso('D04', 'amarelo', 'A distância da preamar é uma estimativa. Meça com GPS e camada, trena ou imagem. Sem medição, a APP dos 300 m fica fraca.', 'Res. CONAMA 303/2002, art. 3º, IX, a');
  if (d.reiterada && (ehApp || c.zonaCosteira))
    add('D21', 'amarelo', 'Trilha usada de forma reiterada, mantendo o solo nu, impedindo a regeneração natural.',
      'Lei 9.605/98, art. 48', `Infração: ${DEC}, art. 65 (250 UPF por ha ou fração)${dobro}`, 'L9605-48', 'Fotografe o ponto em datas diferentes e registre as datas. O TJRS exige prova pericial do impedimento.');
  if (comDano && ['Arbustiva', 'Arbórea'].includes(d.vegetacao) && ['Médio', 'Avançado'].includes(d.estagio))
    add('D22', 'vermelho', `Restinga ${d.vegetacao.toLowerCase()} em estágio ${d.estagio.toLowerCase()} de regeneração (Mata Atlântica) danificada.`,
      'Lei 11.428/2006', `Infração: ${DEC}, art. 58 (300 UPF/ha + 50 UPF/ha por ser Mata Atlântica)${dobro}`, 'L9605-38A', 'Peça laudo do estágio de regeneração.');

  // D07: Unidade de Conservação.
  if (emUc) {
    add('D07', comDano ? 'vermelho' : 'amarelo', `Tráfego de veículo dentro de Unidade de Conservação ${c.uc}${ab.lugar.ucNome ? ` (${ab.lugar.ucNome})` : ''}${comDano ? ', com dano' : ''}.`,
      `${DEC}, arts. 106 e 108`, `Infração: ${DEC}, art. 106 (25 a 500 UPF)`, comDano ? 'L9605-40' : '', 'Em UC, as multas dobram.');
    if (c.uc === 'federal') aviso('D07', 'amarelo', 'A UC é federal. O caso é da Justiça Federal e do ICMBio. Comunique o ICMBio.', 'CF/88, art. 109, IV');
  }
  // D08: bem da União.
  if (c.marinha) aviso('D08', 'amarelo', 'O local pode ser terreno de marinha ou lagoa ligada ao mar. Então o caso pode ser federal. Comunique a PF ou o MPF, além da DP.', 'STJ, RHC 50.692/SC; AREsp 2.313.729/SP');

  // Extração de areia.
  if (d.areia) {
    add('D23', 'vermelho', `Extração de areia${d.areiaM3 ? ` (${d.areiaM3} m³)` : ''} sem autorização.`, 'Lei 9.605/98, art. 55',
      `Infração: ${DEC}, art. 78 (75 a 150 UPF por ha ou fração)${dobro}`, 'L9605-55');
    // Art. 44 fala em extrair "de florestas" de preservação permanente: só com vegetação arbórea em APP.
    if (ehApp && d.vegetacao === 'Arbórea') add('D23', 'vermelho', 'Extração de areia em APP com floresta.', 'Lei 9.605/98, art. 44', `Infração: ${DEC}, art. 64 (250 a 2.500 UPF por ha ou fração)${dobro}`, 'L9605-44');
    if (c.marinha) add('D23', 'amarelo', 'Areia retirada de possível bem da União: usurpação.', 'Lei 8.176/91, art. 2º', '', 'L8176-2');
  }

  // D19: toca ou ninho.
  if (d.tocaNinho)
    add('D19', 'vermelho', `Toca, ninho ou abrigo destruído${d.especie ? ` (${d.especie})` : ''}${d.ameacada ? ', espécie ameaçada' : ''}.`, 'Lei 9.605/98, art. 29, §1º, II',
      `Infração: ${DEC}, art. 38, §3º (${d.ameacada ? 250 : 25} UPF por indivíduo)${dobro}`, 'L9605-29');

  if (k.fuga) add('D24', 'vermelho', 'Fuga, desobediência ou embaraço à fiscalização.', 'Lei 9.605/98, art. 69', `Infração: ${DEC}, art. 93 (25 a 5.000 UPF)`, 'L9605-69');
  if (k.evento) add('D25', 'amarelo', 'Passeio ou evento organizado na área.', 'Lei 9.605/98, art. 2º; Lei 15.434/2020, art. 49', '', '', 'O organizador responde como coautor. Em UC, o evento precisa de autorização do gestor.');

  // D16: embriaguez vale em qualquer local.
  if (k.embriaguez) add('D16', 'vermelho', 'Condutor com sinais de embriaguez.', 'CTB, art. 306', c.via ? 'Infração: CTB, art. 165 (gravíssima x10, suspensão)' : '', 'CTB-306', 'É crime em qualquer local. Conduza à DP.');
  if (k.recusaTeste && c.via) add('D16', 'vermelho', 'Recusa ao teste de alcoolemia.', 'CTB, art. 165-A', 'Infração: gravíssima x10, suspensão');

  // D17: menor conduzindo e direção sem habilitação.
  const anos = idade(cond.nascimento, ab.data);
  const semCnh = ['Sem CNH', 'Suspensa', 'Cassada'].includes(cond.cnhSit);
  if (anos != null && anos < 18) add('D17', 'vermelho', `Condutor com ${anos} anos.`, 'Lei 8.069/90', '', '', 'É ato infracional (ECA). Chame o responsável.');
  if ((semCnh || (anos != null && anos < 18)) && ab.proprietario?.entregouDirecao)
    add('D17', 'vermelho', 'Direção do veículo entregue a pessoa não habilitada.', 'CTB, art. 310; STJ, Súmula 575', '', 'CTB-310', 'Vale em qualquer local. Não exige prova de perigo.');
  if (semCnh && c.via && !(anos != null && anos < 18)) {
    if (k.perigoDano) add('D26', 'vermelho', 'Direção sem habilitação gerando perigo de dano.', 'CTB, art. 309', '', 'CTB-309');
    add('D26', 'vermelho', cond.cnhSit === 'Sem CNH' ? 'Condutor sem CNH.' : `CNH ${cond.cnhSit.toLowerCase()}.`,
      cond.cnhSit === 'Sem CNH' ? 'CTB, art. 162, I' : 'CTB, art. 162, II', 'Infração: gravíssima x3; retenção do veículo');
  }
  if (c.via && v.tipo === 'Quadriciclo' && cond.cnhCat && !/[BCDE]/.test(cond.cnhCat) && !semCnh)
    add('D26', 'vermelho', `Quadriciclo exige CNH B; condutor tem ${cond.cnhCat}.`, 'CTB, art. 162, III; Res. CONTRAN 573/2015', 'Infração: gravíssima x2; retenção');

  // D18: veículo sem placa ou sem licenciamento.
  if (v.semPlaca || ['Sem registro', 'Não licenciado'].includes(v.registro)) {
    if (c.via) add('D18', 'vermelho', v.semPlaca ? 'Veículo sem placa em via.' : `Veículo ${v.registro.toLowerCase()} em via.`,
      v.semPlaca ? 'CTB, art. 230, IV' : 'CTB, art. 230, V', 'Infração: gravíssima; remoção do veículo');
    else aviso('D18', 'info', `Veículo ${v.semPlaca ? 'sem placa' : v.registro.toLowerCase()} fora de via. Só registre o fato.${TIPOS_SEM_PLACA.has(v.tipo) ? ' A Res. CONTRAN 1.023/2026 não autoriza este veículo em duna.' : ''}`, 'CTB, art. 1º');
  }
  if (c.via) {
    if (k.semCapacete) add('D27', 'vermelho', 'Sem capacete.', 'CTB, art. 244, I', 'Infração: gravíssima, suspensão; retenção');
    if (k.manobra) add('D27', 'vermelho', 'Manobra perigosa (zerinho, cavalo de pau, arrancada).', 'CTB, art. 175', 'Infração: gravíssima x10, suspensão; remoção');
    if (k.racha) add('D27', 'vermelho', 'Racha ou disputa na via.', 'CTB, art. 308', 'Infração: CTB, art. 173 ou 174', 'CTB-308');
  }
  if (k.velocidadePessoas) add('D27', 'vermelho', 'Velocidade incompatível onde há concentração de pessoas.', 'CTB, art. 311', '', 'CTB-311');

  // D11 a D13: histórico do veículo e da pessoa.
  if (ctx.historico) aviso('D11', 'amarelo', `${ctx.historico} abordage${ctx.historico > 1 ? 'ns anteriores' : 'm anterior'} do mesmo veículo ou pessoa. Isso indica uso reiterado.`, `${DEC}, art. 24, III`);
  if (ab.apreensao?.fiel?.autuado && ctx.historico)
    aviso('D13', 'amarelo', 'O fiel depositário é um autuado com histórico. Há risco de nova infração. Nomeie outro depositário.', `${DEC}, art. 141; STJ, Tema 1043`);
  if (ab.apreensao && !(+ab.apreensao.valor > 0))
    aviso('D14', 'amarelo', 'O Termo de Apreensão está sem o valor de avaliação. Informe o valor.', `${DEC}, art. 135, §1º`);

  // D20: nada irregular.
  if (!out.some(m => m.nivel === 'vermelho')) aviso('D20', 'info', 'Nenhuma irregularidade confirmada. Registre a orientação. Se necessário, notifique.', 'Lei 15.434/2020, art. 13; CF/88, art. 225');
  return out;
}

// D09: TC até 2 anos de pena máxima somada (Lei 9.099/95, art. 61); acima, condução à DP.
function rito(motivos) {
  const soma = ms => [...new Set(ms.map(m => m.crime).filter(Boolean))].reduce((t, k) => t + CRIMES[k][1], 0);
  const conf = soma(motivos.filter(m => m.nivel === 'vermelho')), tudo = soma(motivos.filter(m => m.nivel !== 'info'));
  const nome = m => !m ? null : m <= 24 ? 'TC' : 'DP';
  return { meses: conf, rito: nome(conf), seConfirmar: tudo > conf ? nome(tudo) : null };
}
const crimesDe = motivos => [...new Set(motivos.filter(m => m.crime && m.nivel !== 'info').map(m => m.crime))].map(k => ({ id: k, nome: CRIMES[k][0], meses: CRIMES[k][1] }));

// D10: bases possíveis para recolher o veículo.
function basesApreensao(ab, motivos, ctx = {}) {
  const c = classificar(ab.lugar), v = ab.veiculo || {}, k = ab.condutas || {};
  const crime = motivos.some(m => m.crime && m.nivel === 'vermelho');
  const adm = [v.posseIlicita && 'posse ilícita', v.alterado && 'alterado para a prática ilícita', ctx.historico && 'uso reiterado'].filter(Boolean);
  const tr = c.via && (v.semPlaca || ['Sem registro', 'Não licenciado'].includes(v.registro) || k.manobra || k.racha);
  return [
    { base: 'penal', ok: crime, motivo: crime ? 'Instrumento de crime em flagrante (CPP, art. 6º, II; Lei 9.605/98, art. 25; STJ, Tema 1036)' : 'Sem crime marcado' },
    { base: 'administrativa', ok: adm.length > 0, motivo: adm.length ? `${DEC}, art. 24: ${adm.join(', ')}` : `Exige posse ilícita, alteração ou uso reiterado (${DEC}, art. 24)` },
    { base: 'transito', ok: !!(tr && ctx.convenio), motivo: !c.via ? 'Fora de via' : !ctx.convenio ? 'Município sem convênio' : tr ? 'CTB, arts. 230, 175 ou 173 e 271' : 'Sem hipótese de remoção' },
  ];
}

// Resumo para o Guia (consulta offline).
const GUIA = [
  ['Primeiro o local', 'Classifique o local primeiro. Praia aberta ao público, rua e estrada são via, e nelas o CTB vale. Duna fechada, Tuia e área privada ficam fora de via. Fora de via, use a matriz ambiental e os crimes de trânsito que não exigem via (CTB, arts. 306, 310 e 311).'],
  ['APP', 'A vegetação fixadora de duna é APP em qualquer distância (Lei 12.651, art. 4º, VI). A restinga até 300 m da preamar também é APP, incluídas as dunas (Res. CONAMA 303, art. 3º, IX, a). Esta regra vem de um precedente da 2ª Turma do STJ (REsp 1.827.303/SC), não vinculante. A faixa de lagoa natural é APP. Na zona rural, a faixa é de 100 m, ou 50 m em lagoa de até 20 ha. Na zona urbana, é de 30 m. O banhado também é protegido (Lei 15.434, art. 144). A Res. 303 (art. 3º, XI) faz da duna APP em qualquer lugar. O STJ ainda não decidiu sobre este inciso. A Res. 302 vale só para reservatório artificial, como açude ou barragem.'],
  ['Medir a preamar', 'A APP dos 300 m depende da distância. Registre como mediu: GPS com camada, trena ou imagem. Fotografe a linha de preamar que usou como referência. Uma estimativa não sustenta a APP.'],
  ['Caso típico', 'O veículo esmaga a vegetação fixadora. O crime é o art. 50 da Lei 9.605, com rito de TC. No Auto de Constatação, use o Dec. 55.374, art. 56. Para a prova, registre fotos, área em m², GPS e a descrição da vegetação.'],
  ['Rito', 'Some as penas máximas dos crimes. Até 2 anos, o rito é TC. Acima de 2 anos, conduza à DP. Exemplos acima de 2 anos: arts. 38-A, 40, 63 e 69 da Lei 9.605 e art. 306 do CTB.'],
  ['Recolher o veículo', 'Há três bases para recolher o veículo. Penal: o veículo é instrumento do crime em flagrante. Administrativa: exige posse ilícita, alteração ou uso reiterado. Trânsito: só em via e com convênio.'],
  ['Fiel depositário', 'O autuado não tem direito de ser fiel depositário (STJ, Tema 1043). Não nomeie um reincidente como depositário. O termo exige o valor de avaliação.'],
  ['Competência', 'UC federal ou terreno de marinha: o caso é da Justiça Federal. UC estadual ou municipal: em regra, o caso é da Justiça Estadual.'],
  ['Sem irregularidade', 'Registre a orientação (Lei 15.434, art. 13). Na próxima abordagem, a orientação registrada prova o uso reiterado.'],
];

globalThis.Normas = { CRIMES, FEICOES, METODOS_PREAMAR, TIPOS_SEM_PLACA, CORREDOR_LENCOIS, noPoligono, areasDoPonto, faixaLagoa, classificar, feriado, agravantes, idade, checar, rito, crimesDe, basesApreensao, GUIA };
})();
