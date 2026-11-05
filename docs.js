// Notificação, Termo de Apreensão e Fiel Depositário, Auto de Constatação e Relatório Fotográfico, no layout dos modelos do Comando Ambiental
// da Brigada Militar (mesmo do Fiscal Pesca). Gera HTML para impressão (ou PDF pelo "Imprimir" do navegador).
(() => {

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const nomeProprio = s => String(s ?? '').toLowerCase().trim().split(/\s+/).map((w, i) => i && PARTICULAS.has(w) ? w
  : w.replace(/(^|['\-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())).join(' ');
const num = v => String(v).replace('.', ',');
const fmtCpf = c => c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || '';
const dataBr = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
const reais = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const marca = ok => ok ? '( X )' : '(&nbsp;&nbsp;&nbsp;)';
const linha = n => '_'.repeat(n);
const DESTINOS = ['Pátio ou depósito', 'Fiel depositário', 'Unidade da BM', 'Delegacia de Polícia'];

const descVeiculo = v => [v.tipo, [v.marca, v.modelo].filter(Boolean).join(' '), v.cor, v.ano, v.placa ? `placa ${v.placa}` : v.semPlaca ? 'sem placa' : '',
  v.chassi ? `chassi ${v.chassi}` : ''].filter(Boolean).join(', ');
const local = ab => [ab.local, ab.municipio].filter(Boolean).join(', ');
const coords = ab => ab.gps ? `Latitude ${num(ab.gps.lat.toFixed(5))}, longitude ${num(ab.gps.lon.toFixed(5))} (WGS 84)` : 'não registradas';

const cabecalho = (cfg, titulo) => `
  <table class="doc-cab"><tr>
    <td class="doc-logo">${cfg.logos?.brasao ? `<img src="${esc(cfg.logos.brasao)}" alt="">` : ''}</td>
    <td class="doc-orgao">ESTADO DO RIO GRANDE DO SUL<br>SECRETARIA DE SEGURANÇA PÚBLICA<br>BRIGADA MILITAR<br>COMANDO AMBIENTAL DA BRIGADA MILITAR</td>
    <td class="doc-logo">${cfg.logos?.comando ? `<img src="${esc(cfg.logos.comando)}" alt="">` : ''}</td>
  </tr></table>
  <div class="doc-titulo">${titulo}</div>`;
const campo = (rot, val, cls = '') => `<td class="${cls}"><span class="doc-rot">${rot}</span> ${esc(val)}</td>`;
const agente = (cfg, titulo) => { const ag = cfg.agente || {}; return `<div class="doc-faixa">${titulo}</div>
  <table class="doc-grade"><tr>${campo('Nome:', ag.nome, 'doc-largo')}${campo('Id Func.:', ag.idFunc)}</tr>
    <tr><td class="doc-assin"><span class="doc-rot">Assinatura:</span></td>${campo('Fração:', ag.fracao)}</tr></table>`; };
const pessoa = p => `
  <table class="doc-grade"><tr>${campo('Nome:', nomeProprio(p.nome))}</tr></table>
  <table class="doc-grade"><tr>${campo('CPF:', fmtCpf(p.cpf))}${campo('RG:', p.rg)}${campo('Telefone:', p.telefone)}</tr></table>
  <table class="doc-grade"><tr>${campo('Endereço:', p.endereco, 'doc-largo')}${campo('Bairro:', p.bairro)}</tr></table>
  <table class="doc-grade"><tr>${campo('Município/UF:', p.municipio)}${campo('CNH:', [p.cnh, p.cnhCat].filter(Boolean).join(' cat. '))}</tr></table>`;
const nFotos = ab => (ab.fotos || []).length;
const plural = n => `${n} foto${n > 1 ? 's' : ''}`;
const recusa = ab => ab.recusaAssinatura ? '<p class="doc-texto"><b>O autuado recusou-se a assinar</b> (Lei 15.434/2020, art. 113, §1º).</p>' : '';

// Motivos em vermelho (sem nenhum, os amarelos), com a norma, para a notificação e o auto.
function motivoSugerido(motivos) {
  const de = nivel => motivos.filter(m => m.nivel === nivel && !m.interno).map(m => `${m.texto} (${m.norma})`);
  return (de('vermelho').length ? de('vermelho') : de('amarelo')).join(' ');
}

const NOTIF_ABERTURA = 'Tendo em vista os princípios da precaução e da prevenção (artigo 225 da CF/88), fica notificado(a) pelo seguinte motivo:';
function notificacao(ab, cfg) {
  const n = ab.notificacao || {}, p = ab.condutor || {};
  return `<div class="doc">
    ${cabecalho(cfg, 'NOTIFICAÇÃO AMBIENTAL')}
    <table class="doc-grade"><tr>${campo('Data:', dataBr(ab.data))}${campo('Hora:', ab.data.slice(11, 16))}</tr></table>
    <table class="doc-grade"><tr>${campo('Nome ou razão social do(a) notificado(a):', nomeProprio(p.nome))}</tr></table>
    <table class="doc-grade"><tr>${campo('CPF / CNPJ:', fmtCpf(p.cpf))}${campo('RG:', p.rg)}${campo('Telefone:', p.telefone)}</tr></table>
    <table class="doc-grade"><tr>${campo('Endereço:', p.endereco)}</tr></table>
    <table class="doc-grade"><tr>${campo('Bairro:', p.bairro)}${campo('Município:', p.municipio)}</tr></table>
    <table class="doc-grade"><tr><td class="doc-motivo"><b>${NOTIF_ABERTURA}</b><div>${esc(n.motivo).replace(/\n/g, '<br>')}</div></td></tr></table>
    <table class="doc-grade"><tr><td><b>Local onde foi lavrada a notificação</b> ${esc(local(ab))}<br>
      <span class="doc-rot">Coordenadas geográficas:</span> ${esc(coords(ab))}</td></tr></table>
    <div class="doc-aviso">O NÃO ATENDIMENTO DO PRESENTE PODERÁ CONSTITUIR<br>CRIME DE DESOBEDIÊNCIA CONFORME ARTIGO 330 DO CÓDIGO PENAL</div>
    <table class="doc-grade"><tr><td><b>RECEBI A 2ª VIA DO PRESENTE, ESTANDO NOTIFICADO SOBRE O FATO E CIENTE DOS PRAZOS ESTIPULADOS.</b><br>
      EM _____/ _____/ ______<br>Assinatura do Notificado/ Preposto: ${linha(50)}</td></tr></table>
    ${recusa(ab)}
    <table class="doc-grade"><tr>${campo('Endereço de comparecimento e apresentação dos documentos solicitados:', n.comparecimento || cfg.comparecimento)}</tr></table>
    ${agente(cfg, 'DADOS DO POLICIAL MILITAR RESPONSÁVEL PELA NOTIFICAÇÃO')}
    <div class="doc-vias">1ª via – Processo | 2ª via – Notificado</div>
  </div>`;
}

const BASES = { penal: 'instrumento de crime (CPP, art. 6º, II; Lei 9.605/98, art. 25)', administrativa: 'Dec. RS 55.374/2020, art. 24',
  transito: 'CTB, art. 271' };
function termoApreensao(ab, cfg) {
  const a = ab.apreensao, f = a.fiel || {}, p = ab.condutor || {}, v = ab.veiculo || {};
  return `<div class="doc">
    ${cabecalho(cfg, 'TERMO DE APREENSÃO E FIEL DEPOSITÁRIO')}
    <div class="doc-faixa">APREENSÃO</div>
    <p class="doc-texto">Em decorrência da lavratura do ${marca(a.docTipo === 'BO/TC-COP')}BO/TC-COP / ${marca(a.docTipo === 'BA')}BA nº <b>${esc(a.docNumero) || linha(15)}</b>,
      que consta como responsável pelos fatos constatados o(a) Sr(a) <b>${esc(nomeProprio(p.nome))}</b>${p.cpf ? `, CPF <b>${esc(fmtCpf(p.cpf))}</b>` : ''},
      fica apreendido o bem abaixo descrito, com base em ${esc(BASES[a.base] || '')}:</p>
    <table class="doc-linhas">
      <tr class="linha-item"><td>${esc(descVeiculo(v))}</td><td class="doc-qtd">1 un</td></tr>
      <tr class="linha-item"><td>Valor de avaliação: <b>${esc(reais(a.valor))}</b> (Dec. RS 55.374/2020, art. 135, §1º)</td><td></td></tr>
      ${(a.outros || '').split('\n').filter(Boolean).map(x => `<tr class="linha-item"><td>${esc(x)}</td><td></td></tr>`).join('')}
      ${Array.from({ length: 6 }, () => '<tr class="linha-item"><td>&nbsp;</td><td></td></tr>').join('')}</table>
    ${ab.proprietario && !ab.proprietario.mesmo && ab.proprietario.nome ? `<p class="doc-texto">Proprietário do veículo: ${esc(nomeProprio(ab.proprietario.nome))}${ab.proprietario.cpf ? `, CPF ${esc(fmtCpf(ab.proprietario.cpf))}` : ''}.</p>` : ''}
    <table class="doc-grade"><tr><td class="doc-assin">Assinatura do responsável cujos bens foram apreendidos:</td></tr></table>
    ${recusa(ab)}
    <div class="doc-faixa">FIEL DEPOSITÁRIO</div>
    <p class="doc-texto doc-negrito">Nomeio como FIEL DEPOSITÁRIO dos bens aqui apreendidos, a pessoa abaixo qualificada, que desde já, fica ciente de que NÃO PODERÁ vender, usufruir, e/ou emprestar os mesmos, devendo apresentá-los quando solicitado pelo depositante, nas mesmas condições e quantidades que recebeu, conforme Art. 640 e 652 do Código Civil vigente.</p>
    <table class="doc-grade"><tr>${campo('Nome do(a) Fiel Depositário(a):', f.nome)}</tr></table>
    <table class="doc-grade"><tr>${campo('RG:', f.rg)}${campo('CPF:', fmtCpf(f.cpf))}${campo('Telefone:', f.telefone)}</tr></table>
    <table class="doc-grade"><tr>${campo('Endereço:', f.endereco, 'doc-largo')}${campo('Município/UF:', f.municipioUf)}</tr></table>
    <table class="doc-grade"><tr><td class="doc-assin">Assinatura do Fiel Depositário</td></tr></table>
    ${agente(cfg, 'DADOS DO AGENTE APREENSOR')}
    <table class="doc-grade"><tr><td><b>Destino do veículo quando não for nomeado Fiel Depositário:</b><br>
      ${DESTINOS.filter(d => d !== 'Fiel depositário').map(d => `${marca(a.destino === d)} ${d}`).join('&nbsp;&nbsp;')}</td></tr></table>
    <div class="doc-vias">1ª via – Processo | 2ª via – Autuado | 3ª via – Depósito</div>
  </div>`;
}

// Auto de Constatação: requisitos do Dec. RS 55.374/2020, art. 119. O enquadramento sugerido não vincula a autoridade.
function autoConstatacao(ab, cfg, r) {
  const p = ab.condutor || {}, o = ab.proprietario || {}, d = ab.dano || {};
  const enq = r.motivos.filter(m => m.nivel === 'vermelho' && m.enquadramento.startsWith('Infração')).map(m => m.enquadramento);
  return `<div class="doc">
    ${cabecalho(cfg, 'AUTO DE CONSTATAÇÃO')}
    <div class="doc-faixa">QUALIFICAÇÃO DO AUTUADO (CONDUTOR)</div>${pessoa(p)}
    ${!o.mesmo && o.nome ? `<div class="doc-faixa">PROPRIETÁRIO DO VEÍCULO</div>${pessoa(o)}` : ''}
    <div class="doc-faixa">DATA E LOCAL</div>
    <table class="doc-grade"><tr>${campo('Data:', dataBr(ab.data))}${campo('Hora:', ab.data.slice(11, 16))}${campo('Município:', ab.municipio)}</tr>
      <tr><td colspan="3"><span class="doc-rot">Local:</span> ${esc(ab.local)}<br><span class="doc-rot">Coordenadas:</span> ${esc(coords(ab))}</td></tr></table>
    <div class="doc-faixa">VEÍCULO</div><p class="doc-texto">${esc(descVeiculo(ab.veiculo || {}))}</p>
    <div class="doc-faixa">DESCRIÇÃO DOS FATOS</div>
    <p class="doc-texto">${esc(ab.fatos || historicoBO(ab, r)).replace(/\n/g, '<br>')}</p>
    ${nFotos(ab) ? `<p class="doc-texto">Anexo: relatório fotográfico com ${plural(nFotos(ab))}.</p>` : ''}
    ${d.areaM2 ? `<p class="doc-texto">Área atingida: ${esc(num(d.areaM2))} m². Vegetação: ${esc(d.vegetacao)}${d.estagio ? `, estágio ${esc(d.estagio.toLowerCase())}` : ''}.</p>` : ''}
    <div class="doc-faixa">CIRCUNSTÂNCIAS AGRAVANTES E ATENUANTES (Dec. RS 55.374/2020, art. 6º)</div>
    <p class="doc-texto">Agravantes: ${esc(r.agravantes.join('; ') || 'nenhuma identificada')}.<br>Atenuantes: ${esc(ab.atenuantes || 'nenhuma informada')}.</p>
    <div class="doc-faixa">ENQUADRAMENTO SUGERIDO (não vincula a autoridade julgadora)</div>
    <p class="doc-texto">${esc(enq.join('; ') || 'A definir pela autoridade competente.')}</p>
    ${recusa(ab)}
    <table class="doc-grade"><tr><td class="doc-assin">Assinatura do autuado:</td></tr></table>
    ${agente(cfg, 'AGENTE RESPONSÁVEL PELA CONSTATAÇÃO')}
    <div class="doc-vias">1ª via – SEMA/FEPAM | 2ª via – Autuado | 3ª via – Unidade</div>
  </div>`;
}

// Relatório fotográfico: cada foto com legenda, hora e coordenadas, dizendo de onde veio a coordenada.
const ORIGEM = { exif: 'GPS gravado na foto', aparelho: 'GPS do aparelho no momento da foto' };
const fotoInfo = x => [x.data ? `${dataBr(x.data)} ${x.data.slice(11, 16)}` : 'data não registrada no arquivo',
  x.gps ? `${num(x.gps.lat.toFixed(5))}, ${num(x.gps.lon.toFixed(5))}${x.gps.precisaoM ? ` (±${x.gps.precisaoM} m)` : ''} (WGS 84), ${ORIGEM[x.origem] || ''}` : 'sem coordenadas'].join(' · ');
function relatorioFotografico(ab, cfg) {
  return `<div class="doc">
    ${cabecalho(cfg, 'RELATÓRIO FOTOGRÁFICO')}
    <table class="doc-grade"><tr>${campo('Data:', dataBr(ab.data))}${campo('Hora:', ab.data.slice(11, 16))}${campo('Município:', ab.municipio)}</tr>
      <tr><td colspan="3"><span class="doc-rot">Local:</span> ${esc(ab.local)}<br><span class="doc-rot">Coordenadas da abordagem:</span> ${esc(coords(ab))}<br>
        <span class="doc-rot">Veículo:</span> ${esc(descVeiculo(ab.veiculo || {}))}</td></tr></table>
    ${(ab.fotos || []).map((x, i) => `<div class="doc-foto"><img src="${esc(x.img)}" alt="Foto ${i + 1}">
      <p class="doc-texto"><b>Foto ${i + 1}.</b> ${esc(x.legenda)}<br><span class="doc-rot">${esc(fotoInfo(x))}</span></p></div>`).join('')}
    ${agente(cfg, 'POLICIAL MILITAR RESPONSÁVEL PELAS FOTOS')}
  </div>`;
}

// Rascunho do histórico para o BO/TC (copiar no sistema oficial e revisar).
function historicoBO(ab, r) {
  const v = ab.veiculo || {}, p = ab.condutor || {}, l = ab.lugar || {};
  const ondeTxt = [l.feicoes?.length && l.feicoes.join(', ').toLowerCase(), l.fixadora && 'com vegetação fixadora de dunas',
    l.uc && `em Unidade de Conservação ${l.uc}${l.ucNome ? ` (${l.ucNome})` : ''}`].filter(Boolean).join(', ');
  const crimes = r.crimes.map(c => c.nome).join('; ');
  return `Em ${dataBr(ab.data)}, por volta das ${ab.data.slice(11, 16)}, em ${local(ab) || 'local a descrever'}${ab.gps ? ` (${coords(ab)})` : ''}, `
    + `a guarnição abordou o veículo ${descVeiculo(v) || 'a descrever'}, conduzido por ${nomeProprio(p.nome) || 'pessoa a identificar'}${p.cpf ? `, CPF ${fmtCpf(p.cpf)}` : ''}, `
    + `trafegando ${ondeTxt ? `em área de ${ondeTxt}` : 'em área a caracterizar'}. `
    + (r.motivos.filter(m => m.nivel === 'vermelho' && !m.interno).map(m => m.texto).join(' ') || 'Não foi constatada irregularidade.')
    + (crimes ? ` Os fatos, em tese, configuram: ${crimes}.` : '')
    + (ab.apreensao ? ` O veículo foi apreendido, avaliado em ${reais(ab.apreensao.valor)}.` : '')
    + (nFotos(ab) ? ` Foram feitas ${plural(nFotos(ab))} (relatório fotográfico anexo).` : '')
    + (ab.obs ? ` ${ab.obs}` : '');
}

// O que falta para o processo. Chaves resolvidas pela equipe ficam em ab.resolvidas.
const PEDE_NUMERO = new Set(['BA', 'BO/TC', 'BO/COP', 'Auto de Constatação', 'Apreensão', 'Notificação']);
function pendenciasDe(ab, r) {
  const out = [], feitas = new Set(ab.resolvidas || []), p = ab.condutor || {};
  const add = (k, texto) => { if (!feitas.has(k)) out.push({ chave: k, texto }); };
  if (!p.nome) add('pessoa', 'Identificar o condutor.');
  for (const pr of ab.providencias || []) if (PEDE_NUMERO.has(pr.tipo) && !String(pr.numero || '').trim()) add(`num:${pr.tipo}`, `Falta o número (${pr.tipo}).`);
  if (r.motivos.some(m => m.nivel === 'vermelho') && !(ab.providencias || []).some(pr => ['BA', 'BO/TC', 'BO/COP', 'Auto de Constatação'].includes(pr.tipo)))
    add('sem-documento', 'Irregular sem BA, BO ou Auto de Constatação.');
  if (ab.apreensao && !(+ab.apreensao.valor > 0)) add('ap-valor', 'Termo de apreensão sem valor de avaliação.');
  if (ab.apreensao && !ab.apreensao.fiel?.nome && !ab.apreensao.destino) add('ap-destino', 'Apreensão sem fiel depositário nem destino.');
  if ((ab.apreensao || ab.notificacao) && !(p.rg && p.endereco && p.municipio)) add('qualificacao', 'Qualificação incompleta (RG, endereço, município).');
  if (r.motivos.some(m => ['D05', 'D04', 'D06', 'D03'].includes(m.regra) && m.nivel === 'vermelho') && !ab.dano?.areaM2) add('area', 'Informar a área atingida (m²).');
  if (r.motivos.some(m => m.regra === 'D22' || m.regra === 'D03')) add('laudo', 'Pedir laudo (estágio sucessional ou alteração do local).');
  if (r.motivos.some(m => m.nivel === 'vermelho') && !nFotos(ab)) add('fotos', 'Sem fotos do fato.');
  return out;
}

// Lembrete: os dados só existem no aparelho.
function lembreteBackup(ultimo, hoje, temDados) {
  if (!temDados) return null;
  if (!ultimo) return 'Nenhum backup feito neste aparelho. Faça um backup.';
  const dias = Math.round((Date.parse(hoje.slice(0, 10)) - Date.parse(ultimo.slice(0, 10))) / 864e5);
  return dias > 7 ? `O último backup tem ${dias} dias. Faça um backup.` : null;
}

globalThis.Docs = { NOTIF_ABERTURA, DESTINOS, descVeiculo, motivoSugerido, notificacao, termoApreensao, autoConstatacao, historicoBO, pendenciasDe, lembreteBackup, relatorioFotografico, fotoInfo };
})();
