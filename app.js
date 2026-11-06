const { FEICOES, areasDoPonto, checar, rito, crimesDe, agravantes, basesApreensao, CRIMES, GUIA, METODOS_PREAMAR } = window.Normas;
const { NOTIF_ABERTURA, DESTINOS, descVeiculo, motivoSugerido, notificacao, termoApreensao, autoConstatacao, historicoBO, pendenciasDe, lembreteBackup, relatorioFotografico, fotoInfo,
  notificacaoTermica, termoTermico, autoTermico } = window.Docs;
const { lerExif } = window.Fotos;
const { lerCamada, consultar } = window.Camadas;

// ---------- utilitários ----------
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const agora = () => new Date().toISOString();
const agoraLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const hojeIso = () => agoraLocal().slice(0, 10);
const fmtData = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
const fmtCpf = c => c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || '';
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const opcoes = (lista, sel) => lista.map(v => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(v || '(não informado)')}</option>`).join('');
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const nomeProprio = s => String(s ?? '').toLowerCase().trim().split(/\s+/).map((w, i) => i && PARTICULAS.has(w) ? w
  : w.replace(/(^|['\-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())).join(' ');
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const soAlnum = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const lerPref = (k, pad = '') => { try { return localStorage.getItem(k) ?? pad; } catch { return pad; } };
const gravarPref = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

// Municípios com dunas e restingas na costa do RS (para a lista de sugestões; aceita qualquer outro).
const MUNICIPIOS = ['Torres', 'Arroio do Sal', 'Capão da Canoa', 'Xangri-lá', 'Osório', 'Imbé', 'Tramandaí', 'Cidreira', 'Balneário Pinhal',
  'Palmares do Sul', 'Mostardas', 'Tavares', 'São José do Norte', 'Rio Grande', 'Santa Vitória do Palmar', 'Chuí'];
const TIPOS_VEICULO = ['4x4 ou caminhonete', 'Carro', 'Moto de trilha', 'Moto', 'Quadriciclo', 'UTV ou ATV', 'Caminhão', 'Máquina', 'Outro'];
const REGISTROS = ['Não verificado', 'Regular', 'Sem registro', 'Não licenciado'];
const CNH_SIT = ['Não verificada', 'Regular', 'Sem CNH', 'Suspensa', 'Cassada'];
const VEGETACAO = ['Nenhuma', 'Herbácea', 'Arbustiva', 'Arbórea'];
const ESTAGIOS = ['', 'Inicial', 'Médio', 'Avançado'];
const UCS = ['', 'federal', 'estadual', 'municipal'];
const PROVIDENCIAS = ['Orientação', 'Notificação', 'BA', 'BO/TC', 'BO/COP', 'Condução à DP', 'Auto de Constatação', 'Apreensão', 'Remoção (trânsito)', 'Retenção (trânsito)'];
const COM_NUMERO = new Set(['Notificação', 'BA', 'BO/TC', 'BO/COP', 'Auto de Constatação', 'Apreensão']);
const BASES = { '': '(escolha)', penal: 'Penal: instrumento do crime', administrativa: 'Ambiental administrativa', transito: 'Trânsito' };
const COR_TXT = { verde: 'Sem irregularidade', amarelo: 'Conferir', vermelho: 'Irregular' };

// ---------- armazenamento criptografado (IndexedDB + AES-GCM), mesmo modelo do Fiscal Pesca ----------
function idb() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open('fiscal-dunas', 2);
    r.onupgradeneeded = () => { for (const l of ['kv', 'abordagens', 'fotos']) if (!r.result.objectStoreNames.contains(l)) r.result.createObjectStore(l); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function tx(loja, modo, fn) {
  const d = await idb();
  return new Promise((ok, erro) => { const t = d.transaction(loja, modo), r = fn(t.objectStore(loja)); t.oncomplete = () => ok(r?.result); t.onerror = () => erro(t.error); });
}
const apagarTudo = () => new Promise(ok => { const r = indexedDB.deleteDatabase('fiscal-dunas'); r.onsuccess = r.onerror = r.onblocked = () => ok(); });
async function derivar(senha, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function cifrar(chave, salt, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(JSON.stringify(obj)));
  return { app: 'fiscal-dunas', v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function decifrar(chave, cofre) {
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(cofre.iv) }, chave, unb64(cofre.ct))));
}
// Fotos: cada uma num registro próprio, cifrada em binário. A abordagem guarda só a referência (id, legenda, hora, GPS),
// e a imagem é lida só quando aparece na tela ou no relatório.
const cifrarBytes = async (k, bytes) => { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes) }; };
const decifrarBytes = (k, r) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv }, k, r.ct);
const urlsFoto = new Map();
const urlFoto = (id, tipo = 'image/jpeg') => {
  if (!urlsFoto.has(id)) urlsFoto.set(id, tx('fotos', 'readonly', s => s.get(id))
    .then(async r => r ? URL.createObjectURL(new Blob([await decifrarBytes(chave, r)], { type: tipo })) : ''));
  return urlsFoto.get(id);
};
// Grava as fotos novas antes do registro que aponta para elas (nunca fica referência sem foto). Apaga as removidas depois.
async function gravarFotosNovas(novas, ids) {
  const put = await Promise.all([...novas].filter(([fid]) => ids.has(fid)).map(async ([fid, b]) => [fid, await cifrarBytes(chave, await b.arrayBuffer())]));
  if (put.length) await tx('fotos', 'readwrite', s => put.forEach(([fid, r]) => s.put(r, fid)));
}
const apagarFotos = async ids => { if (ids.length) await tx('fotos', 'readwrite', s => ids.forEach(fid => s.delete(fid))); };

let chave = null, salt = null, db = null;
// Camadas do mapa: dados públicos, sem cifra, fora do backup e fora do bloco regravado a cada salvamento.
let camadas = [];
const sujosAb = new Set();
async function salvar() {
  const lote = [...sujosAb]; sujosAb.clear();
  const meta = await cifrar(chave, salt, { cfg: db.cfg });
  const regs = await Promise.all(lote.map(async id => [id, await cifrar(chave, salt, db.abordagens[id])]));
  if (regs.length) await tx('abordagens', 'readwrite', s => regs.forEach(([id, v]) => s.put(v, id)));
  await tx('kv', 'readwrite', s => s.put(meta, 'meta'));
}
async function carregar(meta) {
  db = { cfg: (await decifrar(chave, meta)).cfg, abordagens: {} };
  const d = await idb();
  const regs = await new Promise((ok, erro) => { const out = [], r = d.transaction('abordagens').objectStore('abordagens').openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) return ok(out); out.push([c.key, c.value]); c.continue(); }; r.onerror = () => erro(r.error); });
  for (const [id, v] of regs) db.abordagens[id] = await decifrar(chave, v);
  camadas = (await tx('kv', 'readonly', s => s.get('camadas'))) || [];
}

let tAviso;
function aviso(texto, tipo = 'ok') {
  const el = $('#aviso'); el.textContent = texto; el.className = tipo === 'erro' ? 'aviso-erro' : ''; el.hidden = false;
  clearTimeout(tAviso); tAviso = setTimeout(() => { el.hidden = true; }, 2600);
}
async function ocupado(fn, texto = 'Aguarde') {
  const el = $('#carregando'), t = setTimeout(() => { el.querySelector('p').textContent = texto; el.hidden = false; }, 400);
  try { return await fn(); } finally { clearTimeout(t); el.hidden = true; }
}
const salvarCom = async texto => { await ocupado(salvar, 'Salvando'); aviso(texto); };

// ---------- tela de senha ----------
async function telaSenha() {
  const meta = await tx('kv', 'readonly', s => s.get('meta'));
  app.innerHTML = `<div class="card centro"><h1>${meta ? 'Desbloquear' : 'Criar senha'}</h1>
    <p class="muted peq">${meta ? 'Os dados ficam criptografados neste aparelho.' : 'Os dados ficam só neste aparelho. A senha criptografa os dados. Sem a senha, não é possível recuperar os dados.'}</p>
    <form id="f"><label for="s1">Senha</label><input id="s1" type="password" autocomplete="current-password" required minlength="6">
      ${meta ? '' : '<label for="s2">Repita a senha</label><input id="s2" type="password" required minlength="6">'}
      <p><button>${meta ? 'Entrar' : 'Criar'}</button></p><p id="m" class="msg erro"></p></form>
    ${meta ? '<p class="peq"><a href="#" id="esqueci">Esqueci a senha (apaga tudo)</a></p>' : ''}</div>`;
  $('#s1').focus();
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const s1 = $('#s1').value;
    try {
      if (meta) { salt = unb64(meta.salt); await ocupado(async () => { chave = await derivar(s1, salt); await carregar(meta); }, 'Abrindo os dados'); }
      else {
        if (s1 !== $('#s2').value) throw new Error('As senhas não conferem. Digite a mesma senha duas vezes.');
        salt = crypto.getRandomValues(new Uint8Array(16));
        await ocupado(async () => { chave = await derivar(s1, salt); db = { cfg: {}, abordagens: {} }; await salvar(); }, 'Criando a base');
      }
      $('#nav').hidden = false;
      rotear();
    } catch (err) { chave = null; $('#m').textContent = err.message?.includes('conferem') ? err.message : 'Senha incorreta.'; }
  };
  $('#esqueci')?.addEventListener('click', async e => { e.preventDefault(); if (confirm('Apagar todos os dados deste aparelho?')) { await apagarTudo(); location.reload(); } });
}

// ---------- cálculo da abordagem ----------
// D11: outras abordagens com a mesma placa, chassi ou CPF do condutor ou do proprietário.
function historicoDe(A) {
  const chaves = a => [a.veiculo?.placa && 'p' + soAlnum(a.veiculo.placa), a.veiculo?.chassi && 'c' + soAlnum(a.veiculo.chassi),
    a.condutor?.cpf && 'f' + a.condutor.cpf, a.proprietario?.cpf && 'f' + a.proprietario.cpf].filter(Boolean);
  const minhas = new Set(chaves(A));
  return Object.values(db.abordagens).filter(o => o.id !== A.id && (o.data || '') <= (A.data || '~') && chaves(o).some(k => minhas.has(k)))
    .sort((a, b) => b.data.localeCompare(a.data));
}
// Todo o RS tem convênio de trânsito com a BM; em Dados ficam só as exceções (convênio vencido ou suspenso).
const temConvenio = mun => !(db.cfg.semConvenio || []).some(m => semAcento(m) === semAcento(mun));
function calcular(A) {
  const hist = historicoDe(A), ctx = { convenio: temConvenio(A.municipio), historico: hist.length };
  const motivos = checar(A, ctx);
  const cor = motivos.some(m => m.nivel === 'vermelho') ? 'vermelho' : motivos.some(m => m.nivel === 'amarelo') ? 'amarelo' : 'verde';
  const r = { motivos, cor, hist, crimes: crimesDe(motivos), rito: rito(motivos), agravantes: agravantes(A, ctx), bases: basesApreensao(A, motivos, ctx) };
  r.pend = pendenciasDe(A, r);
  return r;
}

// ---------- lista de abordagens ----------
const filtro = { q: '' };
const abas = aba => `<div class="abas-seg">${[['lista', '#/', 'Abordagens'], ['den', '#/denuncias', 'Denúncias']]
  .map(([k, h, t]) => `<a href="${h}" class="${aba === k ? 'ativo' : ''}">${t}</a>`).join('')}</div>`;

// ---------- denúncias ----------
const TIPOS_DEN = ['Veículo em duna ou restinga', 'Evento off-road', 'Extração de areia', 'Dano à vegetação', 'Outro'];
const ORIGENS_DEN = ['190', 'Disque-denúncia', 'WhatsApp', 'Pessoalmente', 'Outro órgão', 'Outra'];
const SITUACOES_DEN = ['Nova', 'Em apuração', 'Atendida', 'Improcedente'];
const separar = s => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
function telaDenuncias() {
  const ds = (db.cfg.denuncias ||= []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  app.innerHTML = `<div class="card">${abas('den')}<div class="linha" style="justify-content:space-between"><h1>Denúncias</h1><a class="btn" href="#/denuncia/novo">Nova denúncia</a></div>
    <input id="qd" type="search" placeholder="Local, placa, pessoa ou relato" value="${esc(filtro.qd || '')}" autocomplete="off">
    <p id="contd" class="muted peq"></p><ul id="listad" class="lista"></ul></div>`;
  const desenhar = () => {
    const q = semAcento(filtro.qd || '').trim();
    const vs = ds.filter(d => !q || semAcento([d.tipo, d.situacao, d.local, d.municipio, d.descricao, d.obs, ...(d.placas || []), ...(d.pessoas || [])].join(' ')).includes(q));
    $('#contd').textContent = `${vs.length} de ${ds.length} denúncias`;
    $('#listad').innerHTML = vs.map(d => `<li><a href="#/denuncia/${d.id}"><div class="nome">${esc(d.tipo)} · ${esc(d.situacao)}${d.anexos?.length ? ` · ${d.anexos.length} anexo(s)` : ''}</div>
      <div class="info">${fmtData(d.data)} · ${esc([d.local, d.municipio].filter(Boolean).join(', '))}${d.placas?.length ? ' · ' + esc(d.placas.join(', ')) : ''}</div>
      <div class="info">${esc((d.descricao || '').slice(0, 90))}</div></a></li>`).join('') || '<li class="muted peq" style="padding:10px">Nenhuma denúncia.</li>';
  };
  $('#qd').oninput = e => { filtro.qd = e.target.value; desenhar(); };
  desenhar();
}
function telaDenuncia(id) {
  const ex = (db.cfg.denuncias ||= []).find(d => d.id === id);
  const d = ex ? structuredClone(ex) : { id: novoId(), data: hojeIso(), tipo: TIPOS_DEN[0], origem: ORIGENS_DEN[0], situacao: 'Nova',
    municipio: lerPref('fdunas-mun') || '', local: '', descricao: '', pessoas: [], placas: [], obs: '' };
  d.anexos ??= [];
  const novas = new Map(); // anexos ainda não gravados: id -> Blob
  let salvas = new Set(d.anexos.map(x => x.id));
  // Abordagens abertas desta denúncia ou com a mesma placa: liga a denúncia ao que já foi feito no campo.
  const abs = Object.values(db.abordagens).filter(a => a.denunciaId === d.id || (a.veiculo?.placa && d.placas.includes(soAlnum(a.veiculo.placa).toUpperCase())));
  app.innerHTML = `<div class="card"><p class="peq"><a href="#/denuncias">← Denúncias</a></p><h1>${ex ? 'Denúncia' : 'Nova denúncia'}</h1>
    <div class="grade">
      <div><label for="d-data">Data</label><input id="d-data" type="date" value="${esc(d.data)}"></div>
      <div><label for="d-sit">Situação</label><select id="d-sit">${opcoes(SITUACOES_DEN, d.situacao)}</select></div>
      <div><label for="d-tipo">Tipo</label><select id="d-tipo">${opcoes(TIPOS_DEN, d.tipo)}</select></div>
      <div><label for="d-orig">Origem</label><select id="d-orig">${opcoes(ORIGENS_DEN, d.origem)}</select></div>
      <div><label for="d-mun">Município</label><input id="d-mun" list="d-muns" value="${esc(d.municipio)}"></div>
      <div><label for="d-local">Local</label><input id="d-local" value="${esc(d.local)}" placeholder="Praia, duna, lagoa, acesso"></div></div>
    <datalist id="d-muns">${MUNICIPIOS.map(m => `<option value="${esc(m)}">`).join('')}</datalist>
    <label for="d-desc">Relato (cole a mensagem aqui)</label><textarea id="d-desc" rows="5">${esc(d.descricao)}</textarea>
    <label for="d-placas">Placas (separe com vírgula)</label><input id="d-placas" autocapitalize="characters" value="${esc(d.placas.join(', '))}">
    <label for="d-pessoas">Pessoas citadas (uma por linha)</label><textarea id="d-pessoas" rows="2">${esc(d.pessoas.join('\n'))}</textarea>
    <label for="d-obs">Providências e observações</label><textarea id="d-obs" rows="3">${esc(d.obs)}</textarea>
    <h2 class="sec-tit">Anexos</h2><div id="anexos" class="fotos"></div>
    <label class="btn sec" for="d-anx">Anexar foto ou vídeo</label><input id="d-anx" type="file" accept="image/*,video/*" multiple hidden>
    <p class="muted peq">O app reduz as fotos. Os vídeos ficam no tamanho original, até 50 MB cada.</p>
    ${abs.length ? `<h2 class="sec-tit">Abordagens ligadas</h2><ul class="lista">${abs.map(a => `<li><a href="#/ab/${a.id}"><div class="nome">${esc(a.veiculo.placa)} · ${esc(nomeProprio(a.condutor?.nome) || 'Condutor não identificado')}</div>
      <div class="info">${fmtData(a.data)} · ${esc([a.local, a.municipio].filter(Boolean).join(', '))}</div></a></li>`).join('')}</ul>` : ''}
    <p class="linha"><button id="b-den" type="button">Salvar denúncia</button>${ex ? `<a class="btn sec" href="#/ab/novo?den=${d.id}">Nova abordagem desta denúncia</a>` : ''}</p>
    ${ex ? '<details><summary>Apagar denúncia</summary><p><button type="button" id="b-apagar-den" class="perigo">Apagar esta denúncia</button></p></details>' : ''}</div>`;
  const anexos = () => {
    $('#anexos').innerHTML = d.anexos.map((x, i) => `<div class="foto">${x.tipo === 'video' ? `<video data-anx="${x.id}" controls preload="metadata"></video>` : `<img data-anx="${x.id}" alt="Anexo ${i + 1}">`}
      <div><b>Anexo ${i + 1}</b> <span class="muted peq">${x.tipo === 'video' ? 'vídeo' : 'foto'}</span>
        <input data-leg-anx="${x.id}" placeholder="Legenda: o que o anexo mostra" value="${esc(x.legenda)}">
        <button type="button" class="sec" data-rmanx="${x.id}">Remover</button></div></div>`).join('');
    $('#anexos').querySelectorAll('[data-anx]').forEach(el => urlFoto(el.dataset.anx, d.anexos.find(x => x.id === el.dataset.anx).mime).then(u => { el.src = u; }));
  };
  $('#anexos').oninput = e => { const x = d.anexos.find(a => a.id === e.target.dataset.legAnx); if (x) x.legenda = e.target.value; };
  $('#anexos').onclick = e => {
    const id = e.target.dataset.rmanx;
    if (!id || !confirm('Remover este anexo?')) return;
    d.anexos = d.anexos.filter(x => x.id !== id); novas.delete(id); anexos();
  };
  $('#d-anx').onchange = async e => {
    const fs = [...e.target.files]; e.target.value = '';
    const grandes = fs.filter(f => f.type.startsWith('video/') && f.size > 50e6);
    await ocupado(async () => { for (const f of fs) {
      if (grandes.includes(f)) continue;
      const video = f.type.startsWith('video/'), blob = video ? f : await reduzir(f), id = novoId();
      novas.set(id, blob); urlsFoto.set(id, Promise.resolve(URL.createObjectURL(blob)));
      d.anexos.push({ id, tipo: video ? 'video' : 'foto', mime: video ? f.type || 'video/mp4' : 'image/jpeg', legenda: '' });
    } }, 'Processando os anexos').catch(() => aviso('Não foi possível ler o arquivo.', 'erro'));
    if (grandes.length) aviso(`Vídeo com mais de 50 MB não foi anexado: ${grandes.map(f => f.name).join(', ')}.`, 'erro');
    anexos();
  };
  anexos();
  sairSemSalvar = () => novas.size > 0 && !confirm('Há anexos não salvos. Sair sem salvar?');
  $('#b-den').onclick = async () => {
    Object.assign(d, { data: $('#d-data').value, situacao: $('#d-sit').value, tipo: $('#d-tipo').value, origem: $('#d-orig').value,
      municipio: $('#d-mun').value.trim(), local: $('#d-local').value.trim(), descricao: $('#d-desc').value.trim(),
      placas: separar($('#d-placas').value).map(x => soAlnum(x).toUpperCase()), pessoas: separar($('#d-pessoas').value), obs: $('#d-obs').value.trim(), atualizadoEm: agora() });
    d.criadoEm ||= agora();
    const ids = new Set(d.anexos.map(x => x.id));
    await ocupado(async () => {
      await gravarFotosNovas(novas, ids);
      const i = db.cfg.denuncias.findIndex(x => x.id === d.id);
      if (i >= 0) db.cfg.denuncias[i] = d; else db.cfg.denuncias.push(d);
      await salvar();
      await apagarFotos([...salvas].filter(fid => !ids.has(fid)));
    }, 'Salvando');
    novas.clear(); salvas = ids; aviso('Denúncia salva.');
    if (ex) telaDenuncia(d.id); else location.hash = '#/denuncia/' + d.id;
  };
  if (ex) $('#b-apagar-den').onclick = async () => {
    if (!confirm('Apagar esta denúncia?')) return;
    db.cfg.denuncias = db.cfg.denuncias.filter(x => x.id !== d.id); await salvar(); await apagarFotos([...salvas]);
    novas.clear(); location.hash = '#/denuncias';
  };
}

function telaAbordagens() {
  const todas = Object.values(db.abordagens).sort((a, b) => b.data.localeCompare(a.data));
  const lembrete = lembreteBackup(db.cfg.ultimoBackup, hojeIso(), todas.length > 0);
  app.innerHTML = `<div class="card">${lembrete ? `<p class="msg erro peq">${esc(lembrete)} <a href="#/dados">Abrir Dados</a></p>` : ''}
    ${abas('lista')}<div class="linha" style="justify-content:space-between"><h1>Abordagens</h1><a class="btn" href="#/ab/novo">Nova abordagem</a></div>
    <input id="q" type="search" placeholder="Placa, chassi, nome ou CPF" value="${esc(filtro.q)}" autocomplete="off">
    <p id="cont" class="muted peq"></p><ul id="lista" class="lista"></ul></div>`;
  const desenhar = () => {
    const q = semAcento(filtro.q).trim(), qn = soAlnum(filtro.q);
    const as = todas.filter(a => !q || semAcento([a.condutor?.nome, a.proprietario?.nome, a.municipio, a.local].join(' ')).includes(q)
      || (qn.length >= 3 && [a.veiculo?.placa, a.veiculo?.chassi, a.condutor?.cpf, a.proprietario?.cpf].some(x => soAlnum(x).includes(qn))));
    $('#cont').textContent = `${as.length} de ${todas.length} abordagens`;
    $('#lista').innerHTML = as.map(a => { const r = calcular(a); return `<li><a href="#/ab/${a.id}">
      <div class="nome">${esc(nomeProprio(a.condutor?.nome) || 'Condutor não identificado')}${a.veiculo?.placa ? ` · ${esc(a.veiculo.placa)}` : ''}</div>
      <div class="info">${fmtData(a.data)} ${esc(a.data.slice(11, 16))} · ${esc([a.local, a.municipio].filter(Boolean).join(', '))} · ${esc(a.veiculo?.tipo || '')}</div>
      <span class="tag sem-${r.cor}">${COR_TXT[r.cor]}</span>${r.rito.rito ? `<span class="tag">${r.rito.rito}</span>` : ''}${a.apreensao ? '<span class="tag">Apreensão</span>' : ''}
      ${r.pend.length ? `<span class="tag aviso">${r.pend.length} pendência(s)</span>` : ''}</a></li>`; }).join('')
      || '<li class="muted peq" style="padding:10px">Nenhuma abordagem.</li>';
  };
  desenhar();
  $('#q').oninput = e => { filtro.q = e.target.value; desenhar(); };
}

// ---------- abordagem ----------
// Campos ligados ao objeto da abordagem por caminho (data-k="lugar.via"). data-t: num, cpf, maiusc. data-se: mostra se o caminho é verdadeiro.
const pegar = (o, k) => k.split('.').reduce((x, p) => x?.[p], o);
const definir = (o, k, v) => { const ps = k.split('.'), u = ps.pop(); ps.reduce((x, p) => (x[p] ??= {}), o)[u] = v; };
const chk = (k, rot) => `<label class="chk"><input type="checkbox" data-k="${k}"> ${rot}</label>`;
const txt = (k, rot, ex = '') => `<div><label>${rot}</label><input data-k="${k}"${ex}></div>`;
const nume = (k, rot) => txt(k, rot, ' data-t="num" type="number" min="0" step="any" inputmode="decimal"');
const sel = (k, rot, ops, rotulos) => `<div><label>${rot}</label><select data-k="${k}">${ops.map(v => `<option value="${esc(v)}">${esc(rotulos?.[v] ?? (v || '(não informado)'))}</option>`).join('')}</select></div>`;
const pessoaCampos = p => `<div class="grade">${txt(`${p}.nome`, 'Nome completo')}${txt(`${p}.cpf`, 'CPF', ' data-t="cpf" inputmode="numeric"')}
  ${txt(`${p}.rg`, 'RG')}${txt(`${p}.telefone`, 'Telefone', ' type="tel"')}${txt(`${p}.endereco`, 'Endereço')}${txt(`${p}.bairro`, 'Bairro')}
  ${txt(`${p}.municipio`, 'Município', ' list="muns"')}</div>`;

function novaAbordagem() {
  return { id: novoId(), data: agoraLocal(), municipio: lerPref('fdunas-mun'), local: '', gps: null,
    lugar: { via: false, feicoes: [], fixadora: false, distPreamarM: null, lagoa: { distM: null, zona: 'rural', ate20ha: false }, uc: '', ucNome: '', amortecimento: false, marinha: false, privada: false },
    veiculo: { tipo: TIPOS_VEICULO[0], placa: '', chassi: '', marca: '', modelo: '', cor: '', ano: '', registro: 'Não verificado', semPlaca: false, alterado: false, posseIlicita: false },
    condutor: { cnhSit: 'Não verificada', cnhCat: '' }, proprietario: { mesmo: true, entregouDirecao: false },
    dano: { vegetacao: 'Nenhuma', estagio: '', areaM2: null }, condutas: {}, reincidencia: '',
    providencias: [], apreensao: null, notificacao: null, fatos: '', atenuantes: '', obs: '', recusaAssinatura: false, resolvidas: [], fotos: [] };
}

// Foto reduzida a 1280 px em JPEG (o navegador já aplica a orientação do EXIF).
async function reduzir(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.75));
}
const posicao = () => new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(
  p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, precisaoM: Math.round(p.coords.accuracy) }), () => ok(null),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }) : ok(null));

// bobinaMm: impressora térmica (58 ou 80 mm). A página fica com a largura da bobina e a altura do conteúdo: sai uma tira só.
async function imprimir(html, bobinaMm = 0) {
  let d = $('#impressao');
  if (!d) { d = Object.assign(document.createElement('div'), { id: 'impressao' }); document.body.appendChild(d); }
  d.innerHTML = html;
  await Promise.all([...d.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
  $('#pg-termica')?.remove();
  if (bobinaMm) {
    d.style.setProperty('--t-larg', `${bobinaMm - 10}mm`);
    d.style.cssText += ';display:block;position:absolute;left:-9999px';
    const alturaMm = Math.ceil(d.querySelector('.termica').offsetHeight * 25.4 / 96) + 10;
    d.style.display = d.style.position = d.style.left = '';
    document.head.append(Object.assign(document.createElement('style'), { id: 'pg-termica',
      textContent: `@media print { @page { size: ${bobinaMm}mm ${alturaMm}mm; margin: 5mm 5mm; } }` }));
  }
  document.body.classList.add('imprimindo');
  const fim = () => { document.body.classList.remove('imprimindo'); $('#pg-termica')?.remove(); removeEventListener('afterprint', fim); };
  addEventListener('afterprint', fim);
  print();
}

function telaAbordagem(rota) {
  const [id, q] = rota.split('?'), ex = db.abordagens[id];
  if (id !== 'novo' && !ex) { app.innerHTML = '<div class="card"><p>Abordagem não encontrada.</p><p><a href="#/">Voltar</a></p></div>'; return; }
  const A = ex ? structuredClone(ex) : novaAbordagem();
  A.fotos ??= [];
  // Aberta a partir de uma denúncia: já vem com município, local e a primeira placa.
  const den = !ex && (db.cfg.denuncias || []).find(d => d.id === new URLSearchParams(q || '').get('den'));
  if (den) Object.assign(A, { denunciaId: den.id, municipio: den.municipio || A.municipio, local: den.local }, { veiculo: { ...A.veiculo, placa: den.placas[0] || '' } });
  const novas = new Map(); // fotos ainda não gravadas: id -> Blob
  let salvas = new Set(A.fotos.map(x => x.id));
  let alterado = false;
  app.innerHTML = `<form id="fa" autocomplete="off">
    <div class="card"><p class="peq"><a href="#/">← Abordagens</a></p><h1>${ex ? 'Abordagem' : 'Nova abordagem'}</h1>
      ${A.denunciaId ? `<p class="peq"><a href="#/denuncia/${esc(A.denunciaId)}">Abordagem aberta a partir de uma denúncia</a></p>` : ''}
      <div class="grade">${txt('data', 'Data e hora', ' type="datetime-local"')}${txt('municipio', 'Município', ' list="muns"')}
        <div style="grid-column:1/-1">${txt('local', 'Local', ' placeholder="Ex.: Tuia, margem da Lagoa do Gentil"')}</div></div>
      <div class="linha" style="margin-top:6px"><button class="sec" id="b-gps" type="button">Registrar GPS</button><span id="gps" class="muted peq"></span></div>
      <datalist id="muns">${MUNICIPIOS.map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>

    <details class="card card-dobra" open><summary><h2>1. Local</h2></summary>
      ${chk('lugar.via', '<b>Via:</b> praia, rua, estrada ou caminho aberto ao público')}
      ${chk('lugar.placaProibicao', 'Há placa de proibição de veículos no local')}
      <label>Ambiente</label><div class="chips">${FEICOES.map(f => `<label class="chk chip-chk"><input type="checkbox" data-arr="lugar.feicoes" value="${esc(f)}"> ${esc(f)}</label>`).join('')}</div>
      ${chk('lugar.fixadora', 'A vegetação atingida <b>fixa duna</b>')}
      <div class="grade">${nume('lugar.distPreamarM', 'Distância da preamar máxima (m)')}${sel('lugar.distMetodo', 'Como foi medida', METODOS_PREAMAR)}${nume('lugar.lagoa.distM', 'Distância da lagoa (m)')}
        ${sel('lugar.lagoa.zona', 'Zona da lagoa', ['rural', 'urbana'])}</div>
      ${chk('lugar.lagoa.ate20ha', 'Lagoa com até 20 ha (faixa de 50 m em zona rural)')}
      <div class="grade">${sel('lugar.uc', 'Unidade de Conservação', UCS, { '': 'Não', federal: 'Federal', estadual: 'Estadual', municipal: 'Municipal' })}
        <div data-se="lugar.uc">${txt('lugar.ucNome', 'Nome da UC')}</div></div>
      ${chk('lugar.amortecimento', 'Zona de amortecimento de UC')}
      ${chk('lugar.marinha', 'Até 33 m da preamar de 1831 (terreno de marinha) ou lagoa ligada ao mar')}
      ${chk('lugar.privada', 'Área privada (a proteção ambiental continua)')}</details>

    <details class="card card-dobra" open><summary><h2>2. Veículo</h2></summary><div class="grade">${sel('veiculo.tipo', 'Tipo', TIPOS_VEICULO)}${txt('veiculo.placa', 'Placa', ' data-t="maiusc" autocapitalize="characters"')}
      ${txt('veiculo.chassi', 'Chassi', ' data-t="maiusc" autocapitalize="characters"')}${txt('veiculo.marca', 'Marca')}${txt('veiculo.modelo', 'Modelo')}
      ${txt('veiculo.cor', 'Cor')}${txt('veiculo.ano', 'Ano', ' inputmode="numeric"')}${sel('veiculo.registro', 'Registro e licenciamento', REGISTROS)}</div>
      ${chk('veiculo.semPlaca', 'Sem placa')}${chk('veiculo.alterado', 'Alterado para a prática ilícita (ex.: preparo para duna)')}${chk('veiculo.posseIlicita', 'Posse ilícita (furto, roubo, adulteração)')}
      <div id="hist"></div></details>

    <details class="card card-dobra" open><summary><h2>3. Condutor</h2></summary>${pessoaCampos('condutor')}
      <div class="grade">${txt('condutor.nascimento', 'Nascimento', ' type="date"')}${txt('condutor.cnh', 'Nº da CNH')}${txt('condutor.cnhCat', 'Categoria', ' data-t="maiusc"')}
        ${sel('condutor.cnhSit', 'Situação da CNH', CNH_SIT)}</div>
      <h2 class="sec-tit">Proprietário</h2>${chk('proprietario.mesmo', 'O condutor é o proprietário')}
      <div data-senao="proprietario.mesmo">${pessoaCampos('proprietario')}</div>
      ${chk('proprietario.entregouDirecao', 'Alguém entregou a direção ao condutor (art. 310)')}</details>

    <details class="card card-dobra" open><summary><h2>4. Dano e fotos</h2></summary><div class="grade">${sel('dano.vegetacao', 'Vegetação atingida', VEGETACAO)}${sel('dano.estagio', 'Estágio de regeneração', ESTAGIOS)}
      ${nume('dano.areaM2', 'Área atingida (m²)')}</div>
      ${chk('dano.sulcos', 'Sulcos, rampas ou cortes na duna')}${chk('dano.reiterada', 'Trilha usada de forma reiterada (solo nu)')}
      ${chk('dano.tocaNinho', 'Toca, ninho ou abrigo destruído')}<div data-se="dano.tocaNinho" class="grade">${txt('dano.especie', 'Espécie')}<div>${chk('dano.ameacada', 'Espécie ameaçada')}</div></div>
      ${chk('dano.areia', 'Extração de areia')}<div data-se="dano.areia" class="grade">${nume('dano.areiaM3', 'Volume (m³)')}</div>
      <h2 class="sec-tit">Fotos</h2><div id="fotos" class="fotos"></div>
      <div class="linha"><label class="btn sec" for="f-cam">Tirar foto</label><input id="f-cam" type="file" accept="image/*" capture="environment" hidden>
        <label class="btn sec" for="f-gal">Da galeria</label><input id="f-gal" type="file" accept="image/*" multiple hidden></div>
      <p class="muted peq">Hora e coordenadas vêm do arquivo da foto. Se o arquivo não tem GPS, a foto tirada pelo app recebe o GPS do aparelho. A foto da galeria sem GPS fica sem coordenadas.</p></details>

    <details class="card card-dobra" open><summary><h2>5. Condutas</h2></summary>
      ${chk('condutas.embriaguez', 'Sinais de embriaguez')}${chk('condutas.recusaTeste', 'Recusa ao teste de alcoolemia')}
      ${chk('condutas.perigoDano', 'Direção com perigo de dano')}${chk('condutas.velocidadePessoas', 'Velocidade incompatível perto de pessoas')}
      ${chk('condutas.estacionado', 'Veículo estacionado na areia')}${chk('condutas.manobra', 'Zerinho, cavalo de pau ou arrancada')}${chk('condutas.racha', 'Racha ou disputa')}${chk('condutas.semCapacete', 'Sem capacete')}
      ${chk('condutas.fuga', 'Fuga, desobediência ou embaraço à fiscalização')}${chk('condutas.evento', 'Passeio ou evento organizado')}
      <div class="grade">${txt('reincidencia', 'Nº de auto anterior confirmado (reincidência)')}</div></details>

    <div id="enq"></div>

    <details class="card card-dobra" open><summary><h2>6. Medidas</h2></summary><div id="provs" class="provs"></div>
      <h2 class="sec-tit">Apreensão do veículo</h2><label class="chk"><input type="checkbox" id="ap-on"> Apreender</label>
      <div data-se="apreensao"><div id="bases" class="peq"></div>
        <div class="grade">${sel('apreensao.base', 'Base da apreensão', Object.keys(BASES), BASES)}${nume('apreensao.valor', 'Valor de avaliação (R$)')}
          ${sel('apreensao.docTipo', 'Documento', ['BO/TC-COP', 'BA'])}${txt('apreensao.docNumero', 'Nº do documento')}${sel('apreensao.destino', 'Destino', ['', ...DESTINOS])}</div>
        <label>Outros itens apreendidos (um por linha)</label><textarea data-k="apreensao.outros" rows="2"></textarea>
        <h2 class="sec-tit">Fiel depositário</h2><div class="grade">${txt('apreensao.fiel.nome', 'Nome')}${txt('apreensao.fiel.cpf', 'CPF', ' data-t="cpf" inputmode="numeric"')}
          ${txt('apreensao.fiel.rg', 'RG')}${txt('apreensao.fiel.telefone', 'Telefone')}${txt('apreensao.fiel.endereco', 'Endereço')}${txt('apreensao.fiel.municipioUf', 'Município/UF')}</div>
        ${chk('apreensao.fiel.autuado', 'O fiel depositário é o autuado')}</div>
      <h2 class="sec-tit">Notificação</h2><label class="chk"><input type="checkbox" id="nt-on"> Notificar o condutor</label>
      <div data-se="notificacao"><p class="peq muted">${esc(NOTIF_ABERTURA)}</p><textarea data-k="notificacao.motivo" rows="3"></textarea>
        ${txt('notificacao.comparecimento', 'Endereço de comparecimento', ` placeholder="${esc(db.cfg.comparecimento || '')}"`)}</div></details>

    <details class="card card-dobra" open><summary><h2>7. Fatos e documentos</h2></summary>
      <label>Descrição dos fatos (histórico do BO e do Auto de Constatação)</label><textarea data-k="fatos" rows="5"></textarea>
      <p><button class="sec" id="b-fatos" type="button">Gerar texto pelo enquadramento</button></p>
      <div class="grade">${txt('atenuantes', 'Atenuantes')}</div>${chk('recusaAssinatura', 'O autuado não quis assinar')}
      <label>Observações</label><textarea data-k="obs" rows="2"></textarea>
      <label for="fmt-doc">Formato dos documentos</label><select id="fmt-doc">${opcoes(['Folha A4', 'Impressora térmica'], lerPref('fdunas-fmt', 'Folha A4'))}</select>
      <div class="linha" style="margin-top:10px"><button class="sec" type="button" data-doc="notificacao">Notificação</button>
        <button class="sec" type="button" data-doc="termo">Termo de apreensão</button><button class="sec" type="button" data-doc="auto">Auto de Constatação</button>
        <button class="sec" type="button" data-doc="fotos">Relatório fotográfico</button>
        <button class="sec" type="button" id="b-copiar">Copiar histórico</button></div>
      <p class="muted peq">Para salvar em PDF, toque em "Imprimir". Antes, preencha o agente e os logos em Dados. Na impressora térmica, o Relatório fotográfico sai em A4.</p>
      ${ex ? '<details><summary>Apagar abordagem</summary><p><button type="button" id="b-apagar" class="perigo">Apagar esta abordagem</button></p></details>' : ''}</details>
    <div class="barra-ab"><button type="button" id="ba-cor" class="ba-cor"></button><span id="m-ab" class="msg peq"></span><button id="b-salvar" type="button">Salvar</button></div></form>`;
  document.body.classList.add('com-barra');
  const f = $('#fa');

  // Preenche os campos e mostra os blocos condicionais.
  const preencher = () => {
    f.querySelectorAll('[data-k]').forEach(el => { const v = pegar(A, el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = el.dataset.t === 'cpf' ? fmtCpf(v) : v ?? ''; });
    f.querySelectorAll('[data-arr]').forEach(el => { el.checked = (pegar(A, el.dataset.arr) || []).includes(el.value); });
    $('#ap-on').checked = !!A.apreensao; $('#nt-on').checked = !!A.notificacao;
    mostrar();
  };
  const mostrar = () => {
    f.querySelectorAll('[data-se]').forEach(el => { el.hidden = !pegar(A, el.dataset.se); });
    f.querySelectorAll('[data-senao]').forEach(el => { el.hidden = !!pegar(A, el.dataset.senao); });
  };
  const provs = () => {
    $('#provs').innerHTML = PROVIDENCIAS.map(t => { const p = A.providencias.find(x => x.tipo === t);
      return `<div class="prov"><label class="chk"><input type="checkbox" data-prov="${esc(t)}"${p ? ' checked' : ''}> ${esc(t)}</label>
        ${p && COM_NUMERO.has(t) ? `<input data-provn="${esc(t)}" placeholder="Número" value="${esc(p.numero)}">` : ''}</div>`; }).join('');
  };

  // Painel ao vivo: regras, rito, agravantes e bases de apreensão.
  const desenhar = () => {
    const r = calcular(A);
    $('#enq').innerHTML = `<div class="card sem sem-${r.cor}" id="enq-card"><div class="sem-cor">${COR_TXT[r.cor]}</div>
      <ul>${r.motivos.map(m => `<li class="m-${m.nivel}"><b>${m.regra}</b> ${esc(m.texto)}${m.dica ? ` <i>${esc(m.dica)}</i>` : ''}<div class="sem-norma">${esc(m.norma)}${m.enquadramento ? ' · ' + esc(m.enquadramento) : ''}${m.crime ? ' · Crime: ' + esc(CRIMES[m.crime][0]) : ''}</div></li>`).join('')}</ul>
      ${r.rito.rito ? `<p><b>Rito: ${r.rito.rito === 'TC' ? 'Termo Circunstanciado' : 'condução à DP'}</b> (pena máxima somada: ${r.rito.meses} meses)</p>` : ''}
      ${r.rito.seConfirmar ? `<p class="peq">Com os itens "Conferir" confirmados, o rito é: ${r.rito.seConfirmar === 'TC' ? 'TC' : 'condução à DP'}.</p>` : ''}
      ${r.agravantes.length ? `<p class="peq"><b>Agravantes:</b> ${esc(r.agravantes.join('; '))}</p>` : ''}
      ${r.pend.length ? `<p class="peq"><b>Pendências:</b> ${esc(r.pend.map(p => p.texto).join(' '))}</p>` : ''}</div>`;
    $('#hist').innerHTML = r.hist.length ? `<p class="msg erro peq">Já abordado ${r.hist.length} vez(es): ${r.hist.map(h => `<a href="#/ab/${h.id}">${fmtData(h.data)}</a>`).join(', ')}</p>` : '';
    $('#bases').innerHTML = r.bases.map(b => `<div>${b.ok ? '✓' : '✗'} <b>${esc(BASES[b.base])}:</b> ${esc(b.motivo)}</div>`).join('');
    $('#ba-cor').className = `ba-cor sem-${r.cor}`;
    $('#ba-cor').textContent = `${COR_TXT[r.cor]}${r.rito.rito ? ' · ' + r.rito.rito : ''}`;
    return r;
  };

  f.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k) {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.t === 'num') v = v === '' ? null : +v;
      if (el.dataset.t === 'cpf') v = v.replace(/\D/g, '').slice(0, 11);
      if (el.dataset.t === 'maiusc') { v = v.toUpperCase(); el.value = v; }
      definir(A, el.dataset.k, v);
    } else if (el.dataset.arr) {
      const l = pegar(A, el.dataset.arr) || [];
      definir(A, el.dataset.arr, el.checked ? [...new Set([...l, el.value])] : l.filter(x => x !== el.value));
    } else if (el.dataset.prov) {
      A.providencias = el.checked ? [...A.providencias, { tipo: el.dataset.prov, numero: '' }] : A.providencias.filter(p => p.tipo !== el.dataset.prov);
      provs();
    } else if (el.dataset.leg) {
      A.fotos.find(x => x.id === el.dataset.leg).legenda = el.value;
    } else if (el.type === 'file') {
      return;
    } else if (el.dataset.provn) {
      A.providencias.find(p => p.tipo === el.dataset.provn).numero = el.value;
    } else if (el.id === 'ap-on') {
      A.apreensao = el.checked ? { base: '', valor: null, docTipo: 'BO/TC-COP', docNumero: '', destino: '', outros: '', fiel: {} } : null;
      preencher();
    } else if (el.id === 'nt-on') {
      A.notificacao = el.checked ? { motivo: motivoSugerido(calcular(A).motivos), comparecimento: '' } : null;
      preencher();
    }
    alterado = true;
    mostrar();
    desenhar();
  });

  $('#b-gps').onclick = () => {
    if (!navigator.geolocation) return aviso('GPS indisponível neste aparelho.', 'erro');
    $('#gps').textContent = 'Obtendo posição…';
    navigator.geolocation.getCurrentPosition(p => {
      A.gps = { lat: p.coords.latitude, lon: p.coords.longitude, precisaoM: Math.round(p.coords.accuracy) };
      alterado = true; verGps(); desenhar();
    }, () => { $('#gps').textContent = 'Não foi possível obter o GPS.'; }, { enableHighAccuracy: true, timeout: 20000 });
  };
  const verGps = () => {
    if (!A.gps) { $('#gps').textContent = ''; return; }
    const areas = areasDoPonto(A.gps), cam = consultar(camadas, A.gps);
    $('#gps').innerHTML = `${A.gps.lat.toFixed(5)}, ${A.gps.lon.toFixed(5)} (±${A.gps.precisaoM ?? '?'} m)${areas.map(a => `<br><b>${esc(a)}</b>`).join('')}`
      + cam.map(r => `<br>${r.dentro ? `<b>Dentro de: ${esc(r.feicao)}</b>` : `${esc(r.feicao)}: ${r.distM} m`} <span class="muted">(${esc(r.camada)})</span>`).join('');
  };
  const fotos = () => {
    $('#fotos').innerHTML = A.fotos.map((x, i) => `<div class="foto"><img data-foto="${x.id}" alt="Foto ${i + 1}">
      <div><b>Foto ${i + 1}</b> <span class="muted peq">${esc(fotoInfo(x))}</span>
        <input data-leg="${x.id}" placeholder="Legenda: o que a foto mostra" value="${esc(x.legenda)}">
        <button type="button" class="sec" data-rmfoto="${x.id}">Remover</button></div></div>`).join('');
    $('#fotos').querySelectorAll('[data-foto]').forEach(img => urlFoto(img.dataset.foto).then(u => { img.src = u; }));
  };
  // Coordenada: a do EXIF; sem ela, a do aparelho só para foto tirada agora pelo app.
  const addFotos = async (files, camera) => {
    let pos;
    for (const file of files) {
      const e = lerExif(await file.arrayBuffer());
      let gps = null, origem = '';
      if (e.lat != null) { gps = { lat: e.lat, lon: e.lon }; origem = 'exif'; }
      else if (camera) { if (pos === undefined) pos = await posicao(); if (pos) { gps = pos; origem = 'aparelho'; } }
      const id = novoId(), blob = await reduzir(file);
      novas.set(id, blob); urlsFoto.set(id, Promise.resolve(URL.createObjectURL(blob)));
      A.fotos.push({ id, legenda: '', data: e.data || (camera ? agoraLocal() : ''), gps, origem });
    }
    alterado = true; fotos(); desenhar();
  };
  for (const [id, camera] of [['#f-cam', true], ['#f-gal', false]]) $(id).onchange = async e => {
    const fs = [...e.target.files]; e.target.value = '';
    if (fs.length) try { await ocupado(() => addFotos(fs, camera), 'Processando as fotos'); } catch { aviso('Não foi possível ler a foto.', 'erro'); }
  };
  $('#fotos').onclick = e => {
    const id = e.target.dataset.rmfoto;
    if (!id || !confirm('Remover esta foto?')) return;
    A.fotos = A.fotos.filter(x => x.id !== id); novas.delete(id); alterado = true; fotos(); desenhar();
  };
  $('#b-fatos').onclick = () => {
    if (A.fatos && !confirm('Substituir o texto atual?')) return;
    A.fatos = historicoBO({ ...A, fatos: '' }, calcular(A)); alterado = true; preencher();
  };
  $('#b-copiar').onclick = async () => {
    try { await navigator.clipboard.writeText(A.fatos || historicoBO(A, calcular(A))); aviso('Histórico copiado.'); } catch { aviso('Não foi possível copiar.', 'erro'); }
  };
  $('#fmt-doc').onchange = e => gravarPref('fdunas-fmt', e.target.value);
  f.querySelectorAll('[data-doc]').forEach(b => b.onclick = () => {
    const r = calcular(A), t = b.dataset.doc;
    // Térmica: a mesma informação, em uma coluna (docs.js). O Relatório fotográfico fica sempre em A4.
    const mm = $('#fmt-doc').value === 'Impressora térmica' ? (db.cfg.termicaMm || 58) : 0;
    if (t === 'notificacao') return A.notificacao ? imprimir((mm ? notificacaoTermica : notificacao)(A, db.cfg), mm) : aviso('Marque "Notificar o condutor".', 'erro');
    if (t === 'auto') return imprimir((mm ? autoTermico : autoConstatacao)(A, db.cfg, r), mm);
    if (t === 'fotos') return A.fotos.length ? ocupado(async () => imprimir(relatorioFotografico({ ...A,
      fotos: await Promise.all(A.fotos.map(async x => ({ ...x, img: await urlFoto(x.id) }))) }, db.cfg)), 'Montando o relatório')
      : aviso('Nenhuma foto nesta abordagem.', 'erro');
    // D10 e D14: o termo exige base válida e valor de avaliação.
    if (!A.apreensao) return aviso('Marque "Apreender".', 'erro');
    const base = r.bases.find(x => x.base === A.apreensao.base);
    if (!base) return aviso('Escolha a base da apreensão.', 'erro');
    if (!base.ok) return aviso(`Base sem requisito: ${base.motivo}.`, 'erro');
    if (!(+A.apreensao.valor > 0)) return aviso('Informe o valor de avaliação do veículo.', 'erro');
    imprimir((mm ? termoTermico : termoApreensao)(A, db.cfg), mm);
  });
  $('#b-apagar')?.addEventListener('click', async () => {
    if (!confirm('Apagar esta abordagem?')) return;
    delete db.abordagens[A.id];
    await tx('abordagens', 'readwrite', s => s.delete(A.id));
    await apagarFotos([...salvas]);
    await salvarCom('Abordagem apagada.');
    alterado = false; location.hash = '#/';
  });
  $('#ba-cor').onclick = () => $('#enq').scrollIntoView({ behavior: 'smooth' });
  const gravar = async () => {
    A.atualizadoEm = agora();
    // Fotos novas antes da abordagem (ela nunca aponta para foto inexistente); as removidas, depois.
    const ids = new Set(A.fotos.map(x => x.id));
    await gravarFotosNovas(novas, ids);
    db.abordagens[A.id] = structuredClone(A);
    sujosAb.add(A.id);
    if (A.municipio) gravarPref('fdunas-mun', A.municipio);
    await salvar();
    await apagarFotos([...salvas].filter(fid => !ids.has(fid)));
    novas.clear(); salvas = ids;
    alterado = false;
    if (!ex) { history.replaceState(null, '', `#/ab/${A.id}`); hashAtual = location.hash; }
    $('#m-ab').textContent = `Salva às ${new Date().toTimeString().slice(0, 5)}`;
  };
  $('#b-salvar').onclick = async () => { await ocupado(gravar, 'Salvando'); aviso('Abordagem salva.'); };
  // Saiu do app no meio da abordagem: grava antes do bloqueio por tempo, para nada se perder.
  salvarPendente = () => alterado && gravar();
  // Sair sem salvar: pergunta (dados de campo não podem se perder).
  sairSemSalvar = () => alterado && !confirm('Há alterações não salvas. Sair sem salvar?');
  provs(); preencher(); verGps(); fotos(); desenhar();
}
let sairSemSalvar = () => false, salvarPendente = () => {};

// ---------- guia de consulta rápida (offline) ----------
// Card recolhível: o título é o botão de abrir e fechar.
const dobra = (titulo, corpo, aberto = false) => `<details class="card card-dobra"${aberto ? ' open' : ''}><summary><h2>${esc(titulo)}</h2></summary>${corpo}</details>`;
function telaGuia() {
  app.innerHTML = `<div class="card"><h1>Guia rápido</h1><p class="muted peq">Resumo da base legal do app. O app indica o enquadramento, mas não autua. Confirme sempre o enquadramento.</p></div>
    ${GUIA.map(([t, x], i) => dobra(t, `<p>${esc(x)}</p>`, i === 0)).join('')}
    ${dobra('Crimes e pena máxima', `<div class="tabela"><table><thead><tr><th>Crime</th><th>Pena máxima</th><th>Rito isolado</th></tr></thead>
      <tbody>${Object.values(CRIMES).map(([n, m]) => `<tr><td>${esc(n)}</td><td>${m / 12 >= 1 ? `${m / 12} ano(s)` : `${m} meses`}</td><td>${m <= 24 ? 'TC' : 'DP'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted peq">Com mais de um crime, o app soma as penas máximas. Até 2 anos, o rito é TC (Lei 9.099/95, art. 61).</p>`)}
    ${dobra('UPF-RS', '<p>As multas do Dec. RS 55.374/2020 são em UPF. Em 2026, 1 UPF = R$ 28,3264 (250 UPF = R$ 7.081,60). O valor final é da autoridade julgadora.</p>')}`;
}

// ---------- dados ----------
const msg = (s, t, erro = false) => { const el = $(s); el.textContent = t; el.className = `msg peq${erro ? ' erro' : ''}`; };
function mesclarBackup(outro) {
  let n = 0;
  for (const [id, b] of Object.entries(outro.abordagens || {})) { // vale a versão editada por último
    const a = db.abordagens[id];
    if (!a || (b.atualizadoEm || '') > (a.atualizadoEm || '')) { db.abordagens[id] = b; sujosAb.add(id); n++; }
  }
  db.cfg.semConvenio = [...new Set([...(db.cfg.semConvenio || []), ...(outro.cfg?.semConvenio || [])])];
  for (const x of outro.cfg?.denuncias || []) { // vale a versão editada por último
    const l = (db.cfg.denuncias ||= []), i = l.findIndex(y => y.id === x.id);
    if (i < 0) { l.push(x); n++; } else if ((x.atualizadoEm || '') > (l[i].atualizadoEm || '')) { l[i] = x; n++; }
  }
  return n;
}
function telaDados() {
  const ag = db.cfg.agente || {}, logos = { ...(db.cfg.logos || {}) };
  const conv = new Set(db.cfg.semConvenio || []);
  app.innerHTML = `<div class="card"><h1>Dados</h1><p class="muted peq">Agente, convênios, camadas do mapa e backup.</p></div>
    <details class="card card-dobra"${ag.nome ? '' : ' open'}><summary><h2>Agente</h2></summary>
      <div class="grade"><div><label for="g-nome">Nome</label><input id="g-nome" value="${esc(ag.nome)}"></div>
        <div><label for="g-id">Id funcional</label><input id="g-id" value="${esc(ag.idFunc)}"></div>
        <div><label for="g-fr">Fração</label><input id="g-fr" value="${esc(ag.fracao)}" placeholder="4º Pel/2ª Cia/1º BPAmb"></div></div>
      <label for="g-comp">Endereço de comparecimento (notificação)</label><input id="g-comp" value="${esc(db.cfg.comparecimento)}">
      <label for="g-mm">Largura da bobina da impressora térmica</label><select id="g-mm">${opcoes(['58 mm', '80 mm'], `${db.cfg.termicaMm || 58} mm`)}</select>
      <p class="muted peq">No Android, instale um app de impressão térmica (por exemplo, RawBT). No "Imprimir", escolha a impressora térmica.</p>
      <div class="grade"><div><label for="l-bras">Brasão do RS</label><input id="l-bras" type="file" accept="image/*"><div id="v-bras"></div></div>
        <div><label for="l-cmd">Logo do Comando de Polícia Ambiental</label><input id="l-cmd" type="file" accept="image/*"><div id="v-cmd"></div></div></div>
      <p><button id="b-ag" type="button">Salvar</button></p></details>
    <details class="card card-dobra"><summary><h2>Convênios de trânsito</h2></summary><p class="muted peq">Todo o RS tem convênio de trânsito com a BM (CTB, art. 23, III). Marque só os municípios com convênio vencido ou suspenso. Nesses municípios, o app não sugere AIT nem remoção.</p>
      <div class="chips">${MUNICIPIOS.map(m => `<label class="chk chip-chk"><input type="checkbox" data-conv="${esc(m)}"${conv.has(m) ? ' checked' : ''}> ${esc(m)}</label>`).join('')}</div>
      <label for="c-outros">Outros municípios sem convênio (separe por vírgula)</label><input id="c-outros" value="${esc([...conv].filter(m => !MUNICIPIOS.includes(m)).join(', '))}">
      <p><button id="b-conv" type="button">Salvar convênios</button></p></details>
    <details class="card card-dobra"><summary><h2>Camadas do mapa</h2></summary><p class="muted peq">Importe arquivos KML ou GeoJSON: UC, campo de dunas, linha de preamar ou margem de lagoa. No GPS da abordagem, o app mostra a área do ponto e a distância das linhas até 2 km. Converta shapefile ou KMZ para KML antes, no Google Earth ou no QGIS. As camadas ficam só neste aparelho. O backup não leva as camadas.</p>
      <ul id="l-cam" class="peq"></ul>
      <label class="btn sec" for="f-cam-imp">Importar camada</label><input id="f-cam-imp" type="file" accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json,application/json" multiple hidden>
      <p id="m-cam" class="msg peq"></p></details>
    <details class="card card-dobra"><summary><h2>Backup</h2></summary><p class="muted peq">Os dados existem só neste aparelho. O backup sai criptografado com a sua senha.${db.cfg.ultimoBackup ? ` Último: ${fmtData(db.cfg.ultimoBackup)}.` : ''}</p>
      <div class="linha"><button class="sec" id="b-exp" type="button">Baixar backup</button><button class="sec" id="b-nuvem" type="button">Enviar para a nuvem</button>
        <label class="btn sec" for="f-bak">Importar backup</label><input id="f-bak" type="file" accept="application/json,.json" hidden></div>
      <label class="chk"><input type="checkbox" id="bk-fotos" checked> Incluir fotos e anexos no backup (arquivo maior)</label>
      <p id="m-bak" class="msg peq"></p>
      <details><summary>Apagar todos os dados deste aparelho</summary><p><button id="b-zerar" class="perigo" type="button">Apagar tudo</button></p></details></details>`;
  const verLogos = () => {
    $('#v-bras').innerHTML = logos.brasao ? `<img src="${esc(logos.brasao)}" alt="" style="height:56px;margin-top:6px">` : '';
    $('#v-cmd').innerHTML = logos.comando ? `<img src="${esc(logos.comando)}" alt="" style="height:56px;margin-top:6px">` : '';
  };
  const lerImagem = (input, k) => input.onchange = () => { const r = new FileReader(); r.onload = () => { logos[k] = r.result; verLogos(); }; r.readAsDataURL(input.files[0]); };
  lerImagem($('#l-bras'), 'brasao'); lerImagem($('#l-cmd'), 'comando'); verLogos();
  $('#b-ag').onclick = async () => {
    db.cfg.agente = { nome: $('#g-nome').value.trim(), idFunc: $('#g-id').value.trim(), fracao: $('#g-fr').value.trim() };
    db.cfg.comparecimento = $('#g-comp').value.trim();
    db.cfg.termicaMm = parseInt($('#g-mm').value, 10);
    db.cfg.logos = logos;
    await salvarCom('Dados do agente salvos.');
  };
  $('#b-conv').onclick = async () => {
    db.cfg.semConvenio = [...[...document.querySelectorAll('[data-conv]')].filter(c => c.checked).map(c => c.dataset.conv),
      ...$('#c-outros').value.split(',').map(s => s.trim()).filter(Boolean)];
    await salvarCom('Convênios salvos.');
  };
  const verCamadas = () => {
    $('#l-cam').innerHTML = camadas.map((c, i) => `<li>${esc(c.nome)} <span class="muted">(${c.feicoes.length} feiç${c.feicoes.length > 1 ? 'ões' : 'ão'})</span>
      <button type="button" class="sec" data-rmcam="${i}">Remover</button></li>`).join('') || '<li class="muted">Nenhuma camada.</li>';
  };
  const gravarCamadas = () => tx('kv', 'readwrite', s => s.put(camadas, 'camadas'));
  $('#f-cam-imp').onchange = async e => {
    const fs = [...e.target.files]; e.target.value = '';
    const erros = [];
    for (const f of fs) try { camadas.push(lerCamada(await f.text(), f.name)); } catch (err) { erros.push(`${f.name}: ${err.message}`); }
    await gravarCamadas(); verCamadas();
    msg('#m-cam', erros.length ? erros.join(' ') : 'Camada importada.', !!erros.length);
  };
  $('#l-cam').onclick = async e => {
    const i = e.target.dataset.rmcam;
    if (i == null || !confirm(`Remover a camada "${camadas[i].nome}"?`)) return;
    camadas.splice(+i, 1); await gravarCamadas(); verCamadas();
  };
  verCamadas();
  const baixar = (blob, nome) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nome }); a.click(); URL.revokeObjectURL(a.href); };
  const exportar = async enviar => {
    const nome = `backup-dunas-${hojeIso()}.json`;
    const comFotos = $('#bk-fotos').checked;
    // As fotos vão como estão no aparelho (já cifradas com a mesma chave), fora do bloco principal: sem cifrar duas vezes.
    const cofre = await ocupado(async () => {
      const c = await cifrar(chave, salt, db);
      if (comFotos) {
        c.fotos = {};
        const ids = [...Object.values(db.abordagens).flatMap(a => (a.fotos || []).map(x => x.id)), ...(db.cfg.denuncias || []).flatMap(d => (d.anexos || []).map(x => x.id))];
        for (const id of ids) {
          const r = await tx('fotos', 'readonly', s => s.get(id));
          if (r) c.fotos[id] = { iv: b64(r.iv), ct: b64(r.ct) };
        }
      }
      return c;
    }, 'Gerando o backup');
    const blob = new Blob([JSON.stringify(cofre)], { type: 'application/json' });
    const marcar = async () => { db.cfg.ultimoBackup = agora(); await salvar(); };
    if (enviar && navigator.canShare) {
      const arq = new File([blob], nome, { type: 'application/json' });
      if (navigator.canShare({ files: [arq] })) {
        try { await navigator.share({ files: [arq], title: nome }); await marcar(); return msg('#m-bak', 'Backup enviado. Salve no Google Drive ou OneDrive.'); }
        catch (err) { if (err.name === 'AbortError') return; }
      }
    }
    baixar(blob, nome); await marcar();
    msg('#m-bak', enviar ? 'Compartilhar indisponível: backup baixado. Salve o arquivo no Drive ou OneDrive.' : 'Backup exportado.');
  };
  $('#b-exp').onclick = () => exportar(false);
  $('#b-nuvem').onclick = () => exportar(true);
  $('#f-bak').onchange = async e => {
    try {
      const cofre = JSON.parse(await e.target.files[0].text());
      if (cofre.app !== 'fiscal-dunas') throw new Error('Este arquivo não é um backup do Fiscal Dunas.');
      const senha = prompt('Senha usada no aparelho que gerou o backup:');
      if (!senha) return;
      let outro, k;
      try { outro = await ocupado(async () => decifrar(k = await derivar(senha, unb64(cofre.salt)), cofre), 'Abrindo o backup'); } catch { throw new Error('Senha do backup incorreta.'); }
      const n = mesclarBackup(outro);
      const fs = Object.entries(cofre.fotos || {});
      if (fs.length) await ocupado(async () => {
        const regs = await Promise.all(fs.map(async ([id, r]) => [id, await cifrarBytes(chave, await decifrarBytes(k, { iv: unb64(r.iv), ct: unb64(r.ct) }))]));
        await tx('fotos', 'readwrite', s => regs.forEach(([id, r]) => s.put(r, id)));
      }, 'Importando as fotos');
      await salvarCom('Backup mesclado.');
      telaDados(); msg('#m-bak', `Backup mesclado (${n} abordagem(ns) nova(s) ou atualizada(s)).`);
    } catch (err) { msg('#m-bak', err.message, true); }
    e.target.value = '';
  };
  $('#b-zerar').onclick = async () => { if (confirm('Apagar todos os dados deste aparelho? Faça um backup antes.')) { await apagarTudo(); location.reload(); } };
}

// ---------- roteamento, tema e bloqueio ----------
let hashAtual = location.hash;
function rotear() {
  if (!chave) return telaSenha();
  if (location.hash !== hashAtual && sairSemSalvar()) { history.replaceState(null, '', hashAtual); return; }
  hashAtual = location.hash; sairSemSalvar = () => false; salvarPendente = () => {};
  document.body.classList.remove('com-barra');
  const h = location.hash;
  const secao = /^#\/(ab\/|denuncia)/.test(h) ? '#/' : h || '#/';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('ativo', a.getAttribute('href') === secao));
  if (h === '#/denuncias') return telaDenuncias();
  if (h.startsWith('#/denuncia/')) return telaDenuncia(h.slice(11));
  if (h.startsWith('#/ab/')) return telaAbordagem(h.slice(5));
  if (h === '#/guia') return telaGuia();
  if (h === '#/dados') return telaDados();
  return telaAbordagens();
}
addEventListener('hashchange', rotear);
$('#btn-bloquear').onclick = () => location.reload();
const temaAtual = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const ICONE_SOL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICONE_LUA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const mostrarTema = () => { const escuro = temaAtual() === 'dark', b = $('#btn-tema');
  b.setAttribute('aria-label', escuro ? 'Usar tema claro' : 'Usar tema escuro'); b.title = b.getAttribute('aria-label'); b.innerHTML = escuro ? ICONE_SOL : ICONE_LUA; };
$('#btn-tema').onclick = () => { const novo = temaAtual() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = novo; gravarPref('fd-tema', novo); mostrarTema(); };
mostrarTema();

// Bloqueio após 5 min em segundo plano (a abordagem aberta é gravada ao sair).
addEventListener('pagehide', () => chave && salvarPendente());
let escondidoEm = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { escondidoEm = Date.now(); if (chave) salvarPendente(); }
  else if (db && escondidoEm && Date.now() - escondidoEm > 5 * 60e3) location.reload();
});

// Abre do cache (sw.js); quando uma versão nova instala, avisa para recarregar.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const tinha = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinha || $('#aviso-versao')) return;
    const a = Object.assign(document.createElement('button'), { id: 'aviso-versao', type: 'button', textContent: 'Versão nova do app. Toque para atualizar.' });
    a.onclick = () => location.reload();
    document.body.appendChild(a);
  });
}
rotear();
