/* =========================================================
   Nearme — lógica do site (JavaScript puro, sem framework)
   Arquivo: js/app.js
   ========================================================= */
'use strict';

/* ---------- 1. CONFIGURAÇÃO ---------- */
const CONFIG = {
  // Link do Google Apps Script que grava os leads na aba "Leads" da planilha.
  // Enquanto estiver vazio, os formulários funcionam em "modo de teste" (dados vão só pro console).
  LEADS_URL: 'https://script.google.com/macros/s/AKfycbzUSVhD5TaAt3THfAObSN4adABAXeQ8ifH1pjhphbIJcisBtKt5Xqmz1Ym6GDtwjqy7/exec',

  // Link da planilha do Google publicada como CSV (veja o passo a passo).
  // Ex.: 'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv'
  // Enquanto estiver vazio, o site usa o arquivo data/eventos.json.
  PLANILHA_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqkrPJmHQ81SsNhxyRZjhn0v8w65g-je3JUK2V0GSU9zZ8ZYcHQ_fp8WVoxr1Ef1xyE1kmJ35hRrrp/pub?gid=0&single=true&output=csv',

  // Chave grátis do mapa escuro "Dark Matter" da CARTO (pedir em https://carto.com/basemaps/apikey).
  // Enquanto estiver vazio, o site usa o mapa do OpenStreetMap escurecido.
  CARTO_CHAVE: '',

  EVENTOS_URL: 'data/eventos.json',
  CENTRO_PORTUGAL: [39.7, -8.3],
  ZOOM_INICIAL: 7,
};

/* Categorias do briefing. O "id" tem que ser igual ao campo "categoria" do eventos.json */
const CATEGORIAS = [
  { id: 'música',      nome: 'Música',      icone: 'musica' },
  { id: 'festa',       nome: 'Festa',       icone: 'festa' },
  { id: 'cultura',     nome: 'Cultura',     icone: 'cultura' },
  { id: 'gastronomia', nome: 'Gastronomia', icone: 'gastronomia' },
  { id: 'desporto',    nome: 'Desporto',    icone: 'desporto' },
  { id: 'outros',      nome: 'Outros',      icone: 'outros' },
];

const QUANDO = [
  { id: 'todos', nome: 'Qualquer dia' },
  { id: 'hoje',  nome: 'Hoje' },
  { id: 'fim',   nome: 'Fim de semana' },
];

/* Ícones (desenhos SVG simples, no estilo "linha") */
const ICONES = {
  tudo: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  musica: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  festa: '<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>',
  cultura: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/>',
  gastronomia: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  desporto: '<circle cx="12" cy="12" r="10"/><path d="m12 7 4 3-1.5 5h-5L8 10z"/>',
  outros: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pino: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
  navegar: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  mapa: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
  seta: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  certo: '<path d="M20 6 9 17l-5-5"/>',
};

function icone(nome, classe = '') {
  return `<svg class="icone ${classe}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ''}</svg>`;
}

/* ---------- 2. ESTADO (o que o usuário escolheu) ---------- */
const ESTADO_INICIAL = { categoria: 'todas', quando: 'todos', data: '', cidade: 'todas', busca: '' };
let estado = { ...ESTADO_INICIAL };

const POR_PAGINA = 5;  // quantos eventos aparecem de cada vez no carrossel
let pagina = 0;        // página atual do carrossel (0 = primeira)
let eventos = [];     // todos os eventos futuros
let filtrados = [];   // eventos que passam nos filtros
let erroAoCarregar = false;

let mapa = null;
let camadaMarcadores = null;
let precisaAjustarMapa = true;
let eventoParaFocar = null;

/* ---------- 3. FUNÇÕES DE APOIO ---------- */

// Evita que textos do JSON quebrem o HTML (segurança básica)
function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Só aceita links que começam com http:// ou https://
function linkSeguro(url) {
  return /^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '';
}

// Remove acentos e deixa em minúsculas ("Música" -> "musica")
function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Lê "2026-11-14 21:00", "2026-11-14T21:00" ou "14/11/2026 21:00"
// (o Safari não aceita o espaço, por isso trocamos por T)
function lerData(texto) {
  if (!texto) return null;
  const t = String(texto).trim();
  const pt = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (pt) {
    const [, dia, mes, ano, hora = '0', minuto = '0'] = pt;
    return new Date(+ano, +mes - 1, +dia, +hora, +minuto);
  }
  const d = new Date(t.replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

// Lê números escritos com ponto ou vírgula ("38.71" ou "38,71")
function lerNumero(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return NaN;
  return Number(String(valor).trim().replace(',', '.'));
}

// Transforma o texto CSV da planilha numa lista de objetos { nome: ..., cidade: ... }
function lerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const linhas = [];
  let linha = [], campo = '', entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }  // aspas dentro do texto
        else entreAspas = false;
      } else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  if (!linhas.length) return [];

  const [cabecalho, ...resto] = linhas;
  const chaves = cabecalho.map(h => normalizar(h).replace(/\s+/g, '_'));
  return resto
    .filter(l => l.some(v => v.trim() !== ''))  // ignora linhas vazias
    .map(l => Object.fromEntries(chaves.map((k, i) => [k, (l[i] ?? '').trim()])));
}

function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function fimDoDia(d)    { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function categoriaDe(id) {
  return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}

/* Formatação de datas em português de Portugal */
const fmtDiaLongo = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDiaCurto = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
const fmtSemana   = new Intl.DateTimeFormat('pt-PT', { weekday: 'short' });
const fmtHora     = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });
const fmtMes      = new Intl.DateTimeFormat('pt-PT', { month: 'short' });

function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
function semPonto(t) { return t.replace('.', ''); }

// Texto completo da data (usado no detalhe do evento)
function textoData(e) {
  const duracaoHoras = (e.fim - e.inicio) / 36e5;
  if (duracaoHoras <= 24) {
    // mesmo dia, ou festa que acaba de madrugada
    return `${maiuscula(fmtDiaLongo.format(e.inicio))} · ${fmtHora.format(e.inicio)} – ${fmtHora.format(e.fim)}`;
  }
  return `De ${fmtDiaCurto.format(e.inicio)} a ${fmtDiaCurto.format(e.fim)} · ${fmtHora.format(e.inicio)} – ${fmtHora.format(e.fim)}`;
}

// Data que aparece no selo do cartão: se o evento dura vários dias e já começou,
// mostra o dia de hoje (ex.: semana inteira de 29/10 a 5/11 -> hoje mostra "3 NOV")
function dataDoSelo(e) {
  const hoje = new Date();
  return (e.inicio < inicioDoDia(hoje) && e.fim >= hoje) ? hoje : e.inicio;
}

// Texto curto (usado no cartão), ex.: "Sáb · 21:00"
function textoDataCurta(e) {
  const hoje = new Date();
  if (e.inicio <= hoje && e.fim >= hoje) return 'A decorrer';
  if (e.inicio.toDateString() === hoje.toDateString()) return `Hoje · ${fmtHora.format(e.inicio)}`;
  return `${maiuscula(semPonto(fmtSemana.format(e.inicio)))} · ${fmtHora.format(e.inicio)}`;
}

/* ---------- 4. CARREGAR EVENTOS ---------- */
// Busca os eventos: primeiro tenta a planilha; se não der, usa o eventos.json
async function obterDados() {
  if (CONFIG.PLANILHA_CSV_URL) {
    try {
      const url = new URL(CONFIG.PLANILHA_CSV_URL);
      url.searchParams.set('_', Date.now()); // evita pegar uma versão antiga guardada
      const resposta = await fetch(url, { cache: 'no-store' });
      if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
      return lerCSV(await resposta.text());
    } catch (erro) {
      console.warn('Não consegui ler a planilha. A usar o eventos.json.', erro);
    }
  }
  const resposta = await fetch(CONFIG.EVENTOS_URL, { cache: 'no-cache' });
  if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
  return resposta.json();
}

/* Cópia dos eventos guardada no navegador (localStorage).
   Na visita seguinte o site mostra essa cópia NA HORA e, quando a planilha chega, troca pela versão nova. */
const CHAVE_CACHE = 'nearme-eventos-v1';

function lerCache() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE_CACHE));
    return Array.isArray(guardado?.dados) ? guardado.dados : null;
  } catch (_) { return null; } // modo privado ou dados estragados: ignora
}

function guardarCache(dados) {
  try { localStorage.setItem(CHAVE_CACHE, JSON.stringify({ guardadoEm: Date.now(), dados })); }
  catch (_) { /* sem espaço ou modo privado: não faz mal */ }
}

const VALORES_SIM = ['sim', 's', 'true', 'verdadeiro', 'x', '1'];

// Transforma as linhas da planilha/JSON em eventos prontos a usar
function prepararEventos(dados) {
  const agora = new Date();

  return dados
    .filter(e => e && String(e.nome || '').trim())  // linha sem nome = ignorada
    .map((e, i) => {
      const inicio = lerData(e.data_inicio);
      // se não tiver data_fim, consideramos 3 horas de duração
      const fim = lerData(e.data_fim) || (inicio ? new Date(inicio.getTime() + 3 * 36e5) : null);
      const cat = CATEGORIAS.find(c => normalizar(c.id) === normalizar(e.categoria));
      return {
        ...e,
        id: String(e.id || '').trim() || 'linha-' + (i + 2), // sem id? usa o número da linha
        categoria: cat ? cat.id : 'outros',
        inicio,
        fim,
        lat: lerNumero(e.latitude),
        lng: lerNumero(e.longitude),
        destaque: e.destaque === true || VALORES_SIM.includes(normalizar(e.destaque)),
      };
    })
    // tira eventos sem data, sem coordenadas ou que já acabaram
    .filter(e => {
      const valido = e.inicio && e.fim && !isNaN(e.lat) && !isNaN(e.lng);
      if (!valido) console.warn('Evento ignorado (falta data ou localização):', e.nome);
      return valido && e.fim >= agora;
    })
    .sort((a, b) => a.inicio - b.inicio);
}

// Busca a versão nova dos eventos (planilha ou eventos.json) e guarda a cópia
async function carregarEventos() {
  try {
    const dados = await obterDados();
    eventos = prepararEventos(dados);
    erroAoCarregar = false;
    guardarCache(dados);
  } catch (erro) {
    // só mostra erro se também não houver cópia guardada para mostrar
    if (!eventos.length) erroAoCarregar = true;
    console.error('Não foi possível carregar os eventos:', erro);
    console.info('Dica: abra o site com o Live Server do VS Code (não dê duplo clique no index.html).');
  }
}

/* ---------- 5. FILTROS ---------- */
function intervaloDatas() {
  const agora = new Date();

  if (estado.quando === 'hoje') return [inicioDoDia(agora), fimDoDia(agora)];

  if (estado.quando === 'fim') {
    const diaSemana = agora.getDay(); // 0 = domingo, 6 = sábado
    const sabado = inicioDoDia(agora);
    if (diaSemana === 0) sabado.setDate(sabado.getDate() - 1);
    else sabado.setDate(sabado.getDate() + (6 - diaSemana));
    const domingo = fimDoDia(new Date(sabado.getFullYear(), sabado.getMonth(), sabado.getDate() + 1));
    return [sabado, domingo];
  }

  if (estado.quando === 'data' && estado.data) {
    const [a, m, d] = estado.data.split('-').map(Number);
    const dia = new Date(a, m - 1, d);
    return [inicioDoDia(dia), fimDoDia(dia)];
  }

  return [null, null];
}

// O texto da busca precisa aparecer no nome, local, cidade ou categoria (sem ligar a acentos)
function passaNaBusca(e) {
  const termo = normalizar(estado.busca);
  if (!termo) return true;
  const texto = normalizar([e.nome, e.local_nome, e.cidade, categoriaDe(e.categoria).nome, e.descricao].join(' '));
  return termo.split(/\s+/).every(palavra => texto.includes(palavra));
}

function filtrar() {
  const [ini, fim] = intervaloDatas();
  return eventos.filter(e =>
    (estado.categoria === 'todas' || e.categoria === estado.categoria) &&
    (estado.cidade === 'todas' || e.cidade === estado.cidade) &&
    (!ini || (e.fim >= ini && e.inicio <= fim)) &&
    passaNaBusca(e)
  );
}

/* ---------- 6. DESENHAR A TELA ---------- */

// Capa: cor da categoria + ícone; se tiver imagem, ela fica por cima
function capa(e) {
  const cat = categoriaDe(e.categoria);
  const img = linkSeguro(e.imagem_url)
    ? `<img src="${esc(e.imagem_url)}" alt="" loading="lazy">`
    : '';
  return `<div class="capa" data-cat="${esc(e.categoria)}">${icone(cat.icone, 'capa-icone')}${img}</div>`;
}

function cartaoEvento(e) {
  const cat = categoriaDe(e.categoria);
  const dia = dataDoSelo(e);
  return `
    <button type="button" class="cartao" data-id="${esc(e.id)}" aria-label="${esc(e.nome)}">
      ${capa(e)}
      <span class="selo-data"><b>${dia.getDate()}</b><small>${semPonto(fmtMes.format(dia)).toUpperCase()}</small></span>
      <span class="cartao-info">
        <h3>${esc(e.nome)}</h3>
        <p>${esc(e.local_nome)} · ${esc(e.cidade)}</p>
        <p class="meta">${cat.nome} · ${esc(textoDataCurta(e))}</p>
      </span>
    </button>`;
}

function renderHero() {
  const trilho = document.getElementById('hero-trilho');
  const pontos = document.getElementById('hero-pontos');

  const slideMarca = `
    <div class="slide slide-marca">
      <div class="slide-conteudo">
        <span class="sobretitulo">Mais que eventos. Experiências.</span>
        <h1>Descobre<br>o que te move</h1>
        <p>Concertos, festas, cultura, gastronomia e desporto perto de ti — tudo num mapa.</p>
        <a href="#mapa" class="botao">Explorar no mapa ${icone('seta', 'icone-sm')}</a>
      </div>
    </div>`;

  const destaques = eventos.filter(e => e.destaque).slice(0, 4).map(e => `
    <div class="slide">
      ${capa(e)}
      <div class="slide-conteudo">
        <span class="sobretitulo">Em destaque · ${categoriaDe(e.categoria).nome}</span>
        <h2>${esc(e.nome)}</h2>
        <p>${esc(textoDataCurta(e))} · ${esc(e.local_nome)}, ${esc(e.cidade)}</p>
        <button type="button" class="botao" data-id="${esc(e.id)}">Ver evento ${icone('seta', 'icone-sm')}</button>
      </div>
    </div>`);

  const slides = [slideMarca, ...destaques];
  const html = slides.join('');
  if (trilho.dataset.html === html) return; // nada mudou: não mexe (evita "saltar" o carrossel)
  trilho.dataset.html = html;
  trilho.innerHTML = html;
  trilho.scrollLeft = 0;
  pontos.innerHTML = slides.length > 1
    ? slides.map((_, i) => `<span class="ponto ${i === 0 ? 'ativo' : ''}"></span>`).join('')
    : '';
}

// Bolinhas e passagem automática do carrossel do topo (liga só uma vez)
function iniciarHero() {
  const trilho = document.getElementById('hero-trilho');
  const pontos = document.getElementById('hero-pontos');
  const total = () => trilho.children.length;

  // atualiza as bolinhas quando o usuário desliza
  trilho.addEventListener('scroll', () => {
    const atual = Math.round(trilho.scrollLeft / trilho.clientWidth);
    pontos.querySelectorAll('.ponto').forEach((p, i) => p.classList.toggle('ativo', i === atual));
  }, { passive: true });

  // passa sozinho a cada 6 segundos (para quando o usuário toca)
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzirMovimento) return;
  let pausado = false;
  trilho.addEventListener('pointerdown', () => { pausado = true; });
  setInterval(() => {
    if (pausado || total() < 2 || document.hidden || document.body.dataset.vista !== 'inicio') return;
    const atual = Math.round(trilho.scrollLeft / trilho.clientWidth);
    const proximo = (atual + 1) % total();
    trilho.scrollTo({ left: proximo * trilho.clientWidth, behavior: 'smooth' });
  }, 6000);
}

function renderCategorias() {
  const lista = [{ id: 'todas', nome: 'Tudo', icone: 'tudo' }, ...CATEGORIAS];

  document.getElementById('categorias-inicio').innerHTML = lista.map(c => {
    const ativo = estado.categoria === c.id;
    return `<button type="button" class="cat ${ativo ? 'ativo' : ''}" data-categoria="${c.id}" aria-pressed="${ativo}">
      <span class="cat-icone">${icone(c.icone)}</span><span class="cat-nome">${c.nome}</span></button>`;
  }).join('');

}

/* Filtros do Mapa: só dois botões ("Tudo" e "Qualquer dia").
   Cada um abre uma lista na vertical: ao passar o rato (computador) ou ao tocar (telemóvel). */
function textoDataEscolhida() {
  const [a, m, d] = estado.data.split('-').map(Number);
  return fmtDiaCurto.format(new Date(a, m - 1, d));
}

function renderFiltrosMapa() {
  const marcado = ativo => `${ativo ? 'ativo' : ''}" role="menuitemradio" aria-checked="${ativo}`;

  // Menu 1: categorias
  const cat = estado.categoria === 'todas' ? { nome: 'Tudo', icone: 'tudo' } : categoriaDe(estado.categoria);
  const itensCategoria = [{ id: 'todas', nome: 'Tudo', icone: 'tudo' }, ...CATEGORIAS].map(c => `
    <button type="button" class="menu-item ${marcado(estado.categoria === c.id)}" data-categoria="${c.id}">
      ${icone(c.icone, 'icone-sm')}<span>${c.nome}</span>
    </button>`).join('');

  // Menu 2: quando + cidade
  const temData = estado.quando === 'data' && estado.data;
  const nomeQuando = temData ? textoDataEscolhida() : QUANDO.find(q => q.id === estado.quando)?.nome || 'Qualquer dia';
  const rotuloQuando = estado.cidade === 'todas' ? nomeQuando : `${nomeQuando} · ${estado.cidade}`;

  const itensQuando = QUANDO.map(q => `
    <button type="button" class="menu-item ${marcado(estado.quando === q.id)}" data-quando="${q.id}">
      <span>${q.nome}</span>
    </button>`).join('');
  const itemData = `
    <label class="menu-item menu-data ${temData ? 'ativo' : ''}">
      ${icone('calendario', 'icone-sm')}<span>${temData ? textoDataEscolhida() : 'Escolher data'}</span>
      <input type="date" class="input-data" value="${esc(estado.data)}" min="${hojeISO()}" aria-label="Escolher data">
    </label>`;

  const cidades = [...new Set(eventos.map(e => e.cidade).filter(Boolean))].sort();
  const itensCidade = ['todas', ...cidades].map(c => `
    <button type="button" class="menu-item ${marcado(estado.cidade === c)}" data-cidade-valor="${esc(c)}">
      ${icone('pino', 'icone-sm')}<span>${c === 'todas' ? 'Todas as cidades' : esc(c)}</span>
    </button>`).join('');

  const seta = '<svg class="icone icone-sm seta-menu" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  document.getElementById('filtros-mapa').innerHTML = `
    <div class="menu-filtro">
      <button type="button" class="menu-botao" data-abrir-menu aria-haspopup="true" aria-expanded="false">
        ${icone(cat.icone, 'icone-sm')}<span>${cat.nome}</span>${seta}
      </button>
      <div class="menu-lista"><div class="menu-caixa" role="menu" aria-label="Categoria">${itensCategoria}</div></div>
    </div>
    <div class="menu-filtro">
      <button type="button" class="menu-botao" data-abrir-menu aria-haspopup="true" aria-expanded="false">
        ${icone('calendario', 'icone-sm')}<span>${esc(rotuloQuando)}</span>${seta}
      </button>
      <div class="menu-lista"><div class="menu-caixa" role="menu" aria-label="Quando e onde">
        <span class="menu-titulo">Quando</span>${itensQuando}${itemData}
        <span class="menu-titulo">Cidade</span>${itensCidade}
      </div></div>
    </div>`;
}

function fecharMenus(excepto) {
  document.querySelectorAll('.menu-filtro.aberto').forEach(m => {
    if (m === excepto) return;
    m.classList.remove('aberto');
    m.querySelector('[data-abrir-menu]').setAttribute('aria-expanded', 'false');
  });
}

function htmlFiltrosData() {
  const chips = QUANDO.map(q => {
    const ativo = estado.quando === q.id;
    return `<button type="button" class="chip ${ativo ? 'ativo' : ''}" data-quando="${q.id}" aria-pressed="${ativo}">${q.nome}</button>`;
  }).join('');

  const temData = estado.quando === 'data' && estado.data;
  let rotulo = 'Escolher data';
  if (temData) {
    const [a, m, d] = estado.data.split('-').map(Number);
    rotulo = fmtDiaCurto.format(new Date(a, m - 1, d));
  }
  const chipData = `
    <label class="chip chip-data ${temData ? 'ativo' : ''}">
      ${icone('calendario', 'icone-sm')}<span>${rotulo}</span>
      <input type="date" class="input-data" value="${esc(estado.data)}" min="${hojeISO()}" aria-label="Escolher data">
    </label>`;

  const cidades = [...new Set(eventos.map(e => e.cidade).filter(Boolean))].sort();
  const selectCidade = `
    <select class="chip chip-select ${estado.cidade !== 'todas' ? 'ativo' : ''}" data-cidade aria-label="Cidade">
      <option value="todas">Todas as cidades</option>
      ${cidades.map(c => `<option value="${esc(c)}" ${estado.cidade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>`;

  return chips + chipData + selectCidade;
}

function renderFiltrosData() {
  const html = htmlFiltrosData();
  document.getElementById('datas-inicio').innerHTML = html;
  renderFiltrosMapa();
}

function renderLista() {
  const lista = document.getElementById('lista-eventos');
  const contador = document.getElementById('contador');
  const nav = document.getElementById('carrossel-nav');
  nav.hidden = true;

  if (erroAoCarregar) {
    contador.textContent = '';
    lista.innerHTML = '<p class="vazio">Não foi possível carregar os eventos. Tenta recarregar a página.</p>';
    return;
  }

  contador.textContent = `(${filtrados.length})`;

  if (!filtrados.length) {
    const msg = estado.busca
      ? `Nenhum evento encontrado para “${esc(estado.busca)}”.`
      : 'Não encontrámos eventos com estes filtros.';
    lista.innerHTML = `
      <div class="vazio">
        <p>${msg}</p>
        <button type="button" class="botao botao-sec" data-limpar>Limpar filtros</button>
      </div>`;
    return;
  }

  // Carrossel: mostra só 5 eventos da página atual
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);
  pagina = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const inicio = pagina * POR_PAGINA;
  lista.innerHTML = filtrados.slice(inicio, inicio + POR_PAGINA).map(cartaoEvento).join('');
  lista.scrollLeft = 0; // no telemóvel, volta ao primeiro cartão da página

  if (totalPaginas > 1) {
    nav.hidden = false;
    document.getElementById('pagina-info').textContent = `${pagina + 1} / ${totalPaginas}`;
    nav.querySelector('[data-pagina="-1"]').disabled = pagina === 0;
    nav.querySelector('[data-pagina="1"]').disabled = pagina === totalPaginas - 1;
  }
}

// Setas do carrossel: anda uma página para trás (-1) ou para a frente (+1)
function mudarPagina(passo) {
  pagina += passo;
  renderLista();
  // se a lista ficou fora do ecrã, traz de volta ao título "Próximos eventos"
  const titulo = document.getElementById('contador').closest('.secao-titulo');
  if (titulo.getBoundingClientRect().top < 0) titulo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- 7. MAPA (Leaflet) ---------- */
/* O Leaflet (~150 KB) só é baixado quando a pessoa abre o Mapa (ou passa o dedo/rato por cima do botão "Mapa").
   integrity = "impressão digital" do arquivo: se alguém alterar o Leaflet no servidor, o navegador recusa. */
const LEAFLET = {
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  cssHash: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H',
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  jsHash: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH',
};
let promessaLeaflet = null;

function carregarLeaflet() {
  if (window.L) return Promise.resolve();
  if (promessaLeaflet) return promessaLeaflet; // já está a ser baixado
  promessaLeaflet = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    Object.assign(css, { rel: 'stylesheet', href: LEAFLET.css, integrity: LEAFLET.cssHash, crossOrigin: 'anonymous' });
    document.head.appendChild(css);

    const js = document.createElement('script');
    Object.assign(js, { src: LEAFLET.js, integrity: LEAFLET.jsHash, crossOrigin: 'anonymous' });
    js.onload = () => resolve();
    js.onerror = () => { promessaLeaflet = null; reject(new Error('Leaflet não carregou')); };
    document.head.appendChild(js);
  });
  return promessaLeaflet;
}

async function abrirMapa() {
  const caixa = document.getElementById('mapa-leaflet');
  if (!window.L) caixa.dataset.estado = 'a-carregar';
  try {
    await carregarLeaflet();
    caixa.dataset.estado = '';
  } catch (erro) {
    console.error(erro);
    caixa.dataset.estado = 'erro';
    return;
  }
  if (document.body.dataset.vista !== 'mapa') return; // a pessoa já saiu do mapa
  iniciarMapa();
  requestAnimationFrame(ajustarMapa);
}

function iniciarMapa() {
  if (mapa || typeof L === 'undefined') return;

  mapa = L.map('mapa-leaflet', { zoomControl: false }).setView(CONFIG.CENTRO_PORTUGAL, CONFIG.ZOOM_INICIAL);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  if (CONFIG.CARTO_CHAVE) {
    // Mapa escuro "Dark Matter" da CARTO (exige manter a atribuição)
    L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CONFIG.CARTO_CHAVE)}`, {
      maxZoom: 20,
      attribution: `${osm} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    }).addTo(mapa);
  } else {
    // Sem chave da CARTO: mapa do OpenStreetMap com as cores invertidas pelo CSS (.mapa-escurecido)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'mapa-escurecido',
      attribution: osm,
    }).addTo(mapa);
  }

  camadaMarcadores = L.layerGroup().addTo(mapa);
  desenharMarcadores();
}

function desenharMarcadores() {
  if (!mapa) return;
  camadaMarcadores.clearLayers();

  filtrados.forEach(e => {
    const cat = categoriaDe(e.categoria);
    const marcador = L.marker([e.lat, e.lng], {
      title: e.nome,
      icon: L.divIcon({
        className: 'marcador',
        html: `<span class="pino"><svg viewBox="0 0 24 24">${ICONES[cat.icone]}</svg></span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 48], // a "ponta" da gota fica no local exato
      }),
    });
    marcador.on('click', () => abrirEvento(e.id));
    camadaMarcadores.addLayer(marcador);
  });

  precisaAjustarMapa = true;
  if (document.body.dataset.vista === 'mapa') ajustarMapa();
}

// Dá zoom para mostrar todos os marcadores visíveis
function ajustarMapa() {
  if (!mapa) return;
  mapa.invalidateSize();

  if (eventoParaFocar) {
    const e = eventos.find(x => x.id === eventoParaFocar);
    eventoParaFocar = null;
    if (e) { mapa.setView([e.lat, e.lng], 15); precisaAjustarMapa = false; return; }
  }

  if (!precisaAjustarMapa) return;
  precisaAjustarMapa = false;

  if (filtrados.length) {
    const limites = L.latLngBounds(filtrados.map(e => [e.lat, e.lng]));
    mapa.fitBounds(limites, { padding: [60, 60], maxZoom: 14 });
  } else {
    mapa.setView(CONFIG.CENTRO_PORTUGAL, CONFIG.ZOOM_INICIAL);
  }
}

/* ---------- 8. DETALHE DO EVENTO ---------- */
const folha = document.getElementById('folha');

// Endereço que vai para a área de transferência (se não houver endereço, usa o local + cidade)
function enderecoCompleto(e) {
  const endereco = String(e.endereco || '').trim();
  if (endereco) return endereco;
  return [e.local_nome, e.cidade].filter(Boolean).join(', ');
}

// Copia um texto (com plano B para navegadores antigos)
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (_) {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(campo);
    campo.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    campo.remove();
    return ok;
  }
}

async function copiarEndereco(botao) {
  const ok = await copiarTexto(botao.dataset.copiar);
  const texto = botao.querySelector('span');
  botao.classList.toggle('copiado', ok);
  botao.querySelector('svg').innerHTML = ICONES[ok ? 'certo' : 'copiar'];
  texto.textContent = ok ? 'Copiado!' : 'Não deu';
  clearTimeout(botao._espera);
  botao._espera = setTimeout(() => {
    botao.classList.remove('copiado');
    botao.querySelector('svg').innerHTML = ICONES.copiar;
    texto.textContent = 'Copiar';
  }, 2000);
}

function abrirEvento(id) {
  const e = eventos.find(x => x.id === String(id));
  if (!e) return;
  const cat = categoriaDe(e.categoria);
  const link = linkSeguro(e.link_externo);
  const comoChegar = `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`;

  document.getElementById('folha-conteudo').innerHTML = `
    <div class="folha-capa">${capa(e)}</div>
    <div class="folha-corpo">
      <span class="tag">${icone(cat.icone, 'icone-sm')} ${cat.nome}</span>
      <h2 id="folha-titulo">${esc(e.nome)}</h2>
      <ul class="detalhes">
        <li>${icone('calendario')}<span>${esc(textoData(e))}</span></li>
        <li>${icone('pino')}<span class="detalhe-texto">${esc(e.local_nome)}<br><small>${esc(e.endereco)}</small></span>
          <button type="button" class="botao-copiar" data-copiar="${esc(enderecoCompleto(e))}" aria-label="Copiar endereço">
            ${icone('copiar', 'icone-sm')}<span>Copiar</span>
          </button></li>
        <li>${icone('euro')}<span>${esc(e.preco || 'Preço a confirmar')}</span></li>
      </ul>
      ${e.descricao ? `<p class="descricao">${esc(e.descricao)}</p>` : ''}
      <div class="acoes">
        <a class="botao" href="${comoChegar}" target="_blank" rel="noopener">${icone('navegar')} Como chegar</a>
        ${link ? `<a class="botao botao-sec" href="${esc(link)}" target="_blank" rel="noopener">${icone('externo')} Bilhetes / mais info</a>` : ''}
        <button type="button" class="botao botao-texto" data-ver-mapa="${esc(e.id)}">${icone('mapa')} Ver no mapa</button>
      </div>
    </div>`;

  folha.hidden = false;
  document.body.classList.add('sem-scroll');
  folha.querySelector('.folha-fechar').focus();
}

function fecharEvento() {
  folha.hidden = true;
  document.body.classList.remove('sem-scroll');
}

/* ---------- 9. NAVEGAÇÃO ENTRE "PÁGINAS" (#inicio, #mapa…) ---------- */
const VISTAS = ['inicio', 'mapa', 'novidades', 'divulgar'];

function mostrarVista() {
  const pedida = location.hash.slice(1);
  const vista = VISTAS.includes(pedida) ? pedida : 'inicio';

  document.querySelectorAll('.vista').forEach(s => s.classList.toggle('ativa', s.id === 'vista-' + vista));
  document.querySelectorAll('.nav-baixo a').forEach(a => {
    const ativo = a.dataset.vista === vista;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.dataset.vista = vista;
  window.scrollTo(0, 0);

  if (vista === 'mapa') abrirMapa();
}

/* ---------- 10. ATUALIZAR TUDO QUANDO UM FILTRO MUDA ---------- */
function atualizar() {
  filtrados = filtrar();
  pagina = 0; // filtro novo -> carrossel volta ao início
  renderCategorias();
  renderFiltrosData();
  renderLista();
  desenharMarcadores();
}

/* ---------- 11. FORMULÁRIOS (leads) ---------- */
async function enviarFormulario(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const msg = form.querySelector('.form-msg');
  const botao = form.querySelector('button[type="submit"]');

  // validação simples dos campos obrigatórios
  if (!form.checkValidity()) {
    const invalido = form.querySelector(':invalid');
    mostrarMensagem(msg, 'Verifica os campos assinalados.', 'erro');
    invalido?.focus();
    return;
  }

  const dados = Object.fromEntries(new FormData(form));
  if (dados._gotcha) return; // robô de spam preencheu o campo escondido
  delete dados._gotcha;
  dados.data_cadastro = new Date().toISOString();

  if (!CONFIG.LEADS_URL) {
    console.info('Lead recebido (modo de teste):', dados);
    mostrarMensagem(msg, 'Modo de teste: os dados aparecem na consola.', 'aviso');
    form.reset();
    return;
  }

  botao.disabled = true;
  botao.textContent = 'A enviar…';
  const resultado = await enviarLead(dados);
  botao.disabled = false;
  botao.textContent = botao.dataset.texto;

  if (resultado === 'ok') {
    form.reset();
    mostrarMensagem(msg, form.dataset.sucesso, 'ok');
  } else {
    // Não chegou: guarda no navegador e tenta de novo sozinho (ao voltar a internet ou na próxima visita)
    guardarLeadPendente(dados);
    mostrarMensagem(msg, 'Não conseguimos enviar agora. Guardámos os teus dados e tentamos de novo automaticamente.', 'aviso');
    form.reset();
  }
}

/* Envia um lead para o Google Apps Script (grava uma linha na aba "Leads").
   Devolve 'ok' quando temos a certeza ou boa razão para crer que chegou, ou 'falhou' quando de certeza não chegou. */
async function enviarLead(dados) {
  if (!navigator.onLine) return 'falhou';              // sem internet: nem tenta
  const controlo = new AbortController();
  const limite = setTimeout(() => controlo.abort(), 15000); // desiste ao fim de 15 segundos
  try {
    // Pedido "normal" (sem no-cors): assim conseguimos ver se o Google respondeu com erro.
    const resposta = await fetch(CONFIG.LEADS_URL, {
      method: 'POST',
      body: new URLSearchParams(dados),
      signal: controlo.signal,
    });
    return resposta.ok ? 'ok' : 'falhou';               // ex.: 404 ou 500 = não gravou
  } catch (erro) {
    if (erro.name === 'AbortError') return 'falhou';    // demorou demais
    // Outro erro com internet ligada: normalmente é o Google não deixar LER a resposta (CORS),
    // mas o pedido chega e a linha é gravada. Por isso contamos como enviado.
    console.warn('Lead enviado, mas sem confirmação do Google:', erro);
    return 'ok';
  } finally {
    clearTimeout(limite);
  }
}

/* Leads que não chegaram ficam guardados aqui até conseguirmos enviar */
const CHAVE_LEADS = 'nearme-leads-pendentes';

function lerLeadsPendentes() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LEADS)) || []; } catch (_) { return []; }
}
function gravarLeadsPendentes(lista) {
  try {
    if (lista.length) localStorage.setItem(CHAVE_LEADS, JSON.stringify(lista));
    else localStorage.removeItem(CHAVE_LEADS);
  } catch (_) { /* modo privado: não dá para guardar */ }
}
function guardarLeadPendente(dados) {
  gravarLeadsPendentes([...lerLeadsPendentes(), dados].slice(-20)); // no máximo 20
}

let enviandoPendentes = false;
async function reenviarLeadsPendentes() {
  if (enviandoPendentes || !CONFIG.LEADS_URL) return;
  const pendentes = lerLeadsPendentes();
  if (!pendentes.length) return;
  enviandoPendentes = true;
  const ficam = [];
  for (const lead of pendentes) {
    if ((await enviarLead(lead)) !== 'ok') ficam.push(lead);
  }
  gravarLeadsPendentes(ficam);
  enviandoPendentes = false;
}

function mostrarMensagem(el, texto, tipo) {
  el.textContent = texto;
  el.className = 'form-msg ' + tipo;
}

/* ---------- 12. CLIQUES E EVENTOS ---------- */
document.addEventListener('click', ev => {
  // Menus do Mapa: tocar no botão abre/fecha; tocar fora fecha
  const menu = ev.target.closest('.menu-filtro');
  fecharMenus(menu);
  const botaoMenu = ev.target.closest('[data-abrir-menu]');
  if (botaoMenu) {
    const abrir = !menu.classList.contains('aberto');
    menu.classList.toggle('aberto', abrir);
    botaoMenu.setAttribute('aria-expanded', String(abrir));
    return;
  }

  const alvo = ev.target.closest('[data-copiar], [data-id], [data-categoria], [data-quando], [data-cidade-valor], [data-limpar], [data-fechar], [data-ver-mapa], [data-pagina], .input-data');
  if (!alvo) return;

  if (alvo.dataset.pagina) { mudarPagina(Number(alvo.dataset.pagina)); return; }
  if (alvo.dataset.cidadeValor) { estado.cidade = alvo.dataset.cidadeValor; atualizar(); return; }

  if (alvo.matches('.input-data')) {
    try { alvo.showPicker(); } catch (_) { /* navegadores antigos abrem sozinhos */ }
    return;
  }
  if (alvo.hasAttribute('data-fechar')) { fecharEvento(); return; }
  if (alvo.hasAttribute('data-copiar')) { copiarEndereco(alvo); return; }

  if (alvo.dataset.verMapa) {
    eventoParaFocar = alvo.dataset.verMapa;
    fecharEvento();
    if (location.hash === '#mapa') mostrarVista(); else location.hash = 'mapa';
    return;
  }
  if (alvo.dataset.id) { abrirEvento(alvo.dataset.id); return; }

  if (alvo.dataset.categoria) {
    const escolhida = alvo.dataset.categoria;
    // no menu do Mapa escolhe direto; nos ícones do Início, tocar de novo na ativa volta para "Tudo"
    estado.categoria = (estado.categoria === escolhida && !alvo.closest('.menu-filtro')) ? 'todas' : escolhida;
    atualizar();
    return;
  }
  if (alvo.dataset.quando) {
    estado.quando = alvo.dataset.quando;
    estado.data = '';
    atualizar();
    return;
  }
  if (alvo.hasAttribute('data-limpar')) {
    estado = { ...ESTADO_INICIAL };
    document.getElementById('busca').value = '';
    atualizar();
  }
});

/* Barra de busca: filtra enquanto a pessoa escreve */
const campoBusca = document.getElementById('busca');
if (window.matchMedia('(max-width: 480px)').matches) campoBusca.placeholder = 'Procurar'; // texto curto no telemóvel
let esperaBusca = null;
campoBusca.addEventListener('input', () => {
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(() => {   // espera 200 ms para não refazer a lista a cada letra
    estado.busca = campoBusca.value.trim();
    atualizar();
    // se estiver em "Novidades" ou "Divulgar", volta ao início para ver os resultados
    if (estado.busca && !['inicio', 'mapa'].includes(document.body.dataset.vista)) location.hash = 'inicio';
  }, 200);
});
// Enter: esconde o teclado do telemóvel e leva até a lista de eventos
document.getElementById('form-busca').addEventListener('submit', ev => {
  ev.preventDefault();
  campoBusca.blur();
  if (document.body.dataset.vista === 'inicio') {
    document.getElementById('contador').closest('.secao-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

document.addEventListener('change', ev => {
  const alvo = ev.target;
  if (alvo.matches('.input-data')) {
    estado.data = alvo.value;
    estado.quando = alvo.value ? 'data' : 'todos';
    atualizar();
  } else if (alvo.matches('[data-cidade]')) {
    estado.cidade = alvo.value;
    atualizar();
  }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !folha.hidden) fecharEvento();
  if (ev.key === 'Escape') fecharMenus();
});

window.addEventListener('hashchange', mostrarVista);

// Imagem que não carrega: o logo vira texto e a foto do evento some (fica a cor da categoria).
// Fica aqui, e não em onerror="..." no HTML, porque a política de segurança (CSP) bloqueia código no HTML.
document.addEventListener('error', ev => {
  const img = ev.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (img.classList.contains('logo-img')) img.closest('.logo')?.classList.add('sem-imagem');
  else if (img.closest('.capa')) img.remove();
}, true);

/* ---------- 13. INÍCIO ---------- */
async function iniciar() {
  document.getElementById('ano').textContent = new Date().getFullYear();

  // o logo pode ter falhado antes deste script carregar
  const logo = document.querySelector('.logo-img');
  if (logo && logo.complete && logo.naturalWidth === 0) logo.closest('.logo').classList.add('sem-imagem');

  document.querySelectorAll('form[data-lead]').forEach(form => {
    const botao = form.querySelector('button[type="submit"]');
    botao.dataset.texto = botao.textContent;
    form.addEventListener('submit', enviarFormulario);
  });

  iniciarHero();
  mostrarVista();

  // 1) mostra já a cópia guardada da última visita (se houver)...
  const copia = lerCache();
  if (copia) {
    eventos = prepararEventos(copia);
    renderHero();
    atualizar();
  }
  // 2) ...e depois troca pela versão nova da planilha, sem perder a página do carrossel nem a busca
  const paginaAntes = pagina;
  await carregarEventos();
  renderHero();
  atualizar();
  if (copia) { pagina = paginaAntes; renderLista(); }

  // leads que ficaram por enviar numa visita anterior
  reenviarLeadsPendentes();
  window.addEventListener('online', reenviarLeadsPendentes);
}

// Começa a baixar o mapa assim que a pessoa aponta/toca num link para o Mapa (abre mais rápido)
['pointerover', 'touchstart', 'focusin'].forEach(tipo => {
  document.addEventListener(tipo, ev => {
    if (ev.target.closest?.('a[href="#mapa"]')) carregarLeaflet().catch(() => {});
  }, { passive: true });
});

iniciar();
