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
};

function icone(nome, classe = '') {
  return `<svg class="icone ${classe}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ''}</svg>`;
}

/* ---------- 2. ESTADO (o que o usuário escolheu) ---------- */
const ESTADO_INICIAL = { categoria: 'todas', quando: 'todos', data: '', cidade: 'todas' };
let estado = { ...ESTADO_INICIAL };
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

const VALORES_SIM = ['sim', 's', 'true', 'verdadeiro', 'x', '1'];

async function carregarEventos() {
  try {
    const dados = await obterDados();
    const agora = new Date();

    eventos = dados
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
  } catch (erro) {
    erroAoCarregar = true;
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

function filtrar() {
  const [ini, fim] = intervaloDatas();
  return eventos.filter(e =>
    (estado.categoria === 'todas' || e.categoria === estado.categoria) &&
    (estado.cidade === 'todas' || e.cidade === estado.cidade) &&
    (!ini || (e.fim >= ini && e.inicio <= fim))
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
  return `
    <button type="button" class="cartao" data-id="${esc(e.id)}" aria-label="${esc(e.nome)}">
      ${capa(e)}
      <span class="selo-data"><b>${e.inicio.getDate()}</b><small>${semPonto(fmtMes.format(e.inicio)).toUpperCase()}</small></span>
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
  trilho.innerHTML = slides.join('');
  pontos.innerHTML = slides.length > 1
    ? slides.map((_, i) => `<span class="ponto ${i === 0 ? 'ativo' : ''}"></span>`).join('')
    : '';

  // atualiza as bolinhas quando o usuário desliza
  trilho.addEventListener('scroll', () => {
    const atual = Math.round(trilho.scrollLeft / trilho.clientWidth);
    pontos.querySelectorAll('.ponto').forEach((p, i) => p.classList.toggle('ativo', i === atual));
  }, { passive: true });

  // passa sozinho a cada 6 segundos (para quando o usuário toca)
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (slides.length > 1 && !reduzirMovimento) {
    let pausado = false;
    trilho.addEventListener('pointerdown', () => { pausado = true; });
    setInterval(() => {
      if (pausado || document.hidden || document.body.dataset.vista !== 'inicio') return;
      const atual = Math.round(trilho.scrollLeft / trilho.clientWidth);
      const proximo = (atual + 1) % slides.length;
      trilho.scrollTo({ left: proximo * trilho.clientWidth, behavior: 'smooth' });
    }, 6000);
  }
}

function renderCategorias() {
  const lista = [{ id: 'todas', nome: 'Tudo', icone: 'tudo' }, ...CATEGORIAS];

  document.getElementById('categorias-inicio').innerHTML = lista.map(c => {
    const ativo = estado.categoria === c.id;
    return `<button type="button" class="cat ${ativo ? 'ativo' : ''}" data-categoria="${c.id}" aria-pressed="${ativo}">
      <span class="cat-icone">${icone(c.icone)}</span><span class="cat-nome">${c.nome}</span></button>`;
  }).join('');

  document.getElementById('categorias-mapa').innerHTML = lista.map(c => {
    const ativo = estado.categoria === c.id;
    return `<button type="button" class="chip ${ativo ? 'ativo' : ''}" data-categoria="${c.id}" aria-pressed="${ativo}">
      ${icone(c.icone, 'icone-sm')}${c.nome}</button>`;
  }).join('');
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
  document.getElementById('datas-mapa').innerHTML = html;
}

function renderLista() {
  const lista = document.getElementById('lista-eventos');
  const contador = document.getElementById('contador');

  if (erroAoCarregar) {
    contador.textContent = '';
    lista.innerHTML = '<p class="vazio">Não foi possível carregar os eventos. Tenta recarregar a página.</p>';
    return;
  }

  contador.textContent = `(${filtrados.length})`;

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="vazio">
        <p>Não encontrámos eventos com estes filtros.</p>
        <button type="button" class="botao botao-sec" data-limpar>Limpar filtros</button>
      </div>`;
    return;
  }

  lista.innerHTML = filtrados.map(cartaoEvento).join('');
}

/* ---------- 7. MAPA (Leaflet) ---------- */
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
        <li>${icone('pino')}<span>${esc(e.local_nome)}<br><small>${esc(e.endereco)}</small></span></li>
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

  if (vista === 'mapa') {
    iniciarMapa();
    requestAnimationFrame(ajustarMapa);
  }
}

/* ---------- 10. ATUALIZAR TUDO QUANDO UM FILTRO MUDA ---------- */
function atualizar() {
  filtrados = filtrar();
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
  try {
    // Envia para o Google Apps Script, que grava uma linha na aba "Leads".
    // mode 'no-cors': o Google não deixa ler a resposta, mas o envio chega.
    await fetch(CONFIG.LEADS_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: new URLSearchParams(dados),
    });
    form.reset();
    mostrarMensagem(msg, form.dataset.sucesso, 'ok');
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(msg, 'Ups, algo correu mal. Tenta novamente daqui a pouco.', 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = botao.dataset.texto;
  }
}

function mostrarMensagem(el, texto, tipo) {
  el.textContent = texto;
  el.className = 'form-msg ' + tipo;
}

/* ---------- 12. CLIQUES E EVENTOS ---------- */
document.addEventListener('click', ev => {
  const alvo = ev.target.closest('[data-id], [data-categoria], [data-quando], [data-limpar], [data-fechar], [data-ver-mapa], .input-data');
  if (!alvo) return;

  if (alvo.matches('.input-data')) {
    try { alvo.showPicker(); } catch (_) { /* navegadores antigos abrem sozinhos */ }
    return;
  }
  if (alvo.hasAttribute('data-fechar')) { fecharEvento(); return; }

  if (alvo.dataset.verMapa) {
    eventoParaFocar = alvo.dataset.verMapa;
    fecharEvento();
    if (location.hash === '#mapa') mostrarVista(); else location.hash = 'mapa';
    return;
  }
  if (alvo.dataset.id) { abrirEvento(alvo.dataset.id); return; }

  if (alvo.dataset.categoria) {
    const escolhida = alvo.dataset.categoria;
    // tocar de novo na categoria ativa volta para "Tudo"
    estado.categoria = (estado.categoria === escolhida) ? 'todas' : escolhida;
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
    atualizar();
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

  mostrarVista();
  await carregarEventos();
  renderHero();
  atualizar();
}

iniciar();
