/* =========================================================
   Nearme — gerador de páginas de eventos (para o Google)
   Arquivo: scripts/gerar-paginas.js

   Como usar (no terminal, dentro da pasta do projeto):
     node scripts/gerar-paginas.js

   O que faz:
     1. Lê os eventos da planilha publicada (o mesmo link PLANILHA_CSV_URL do js/app.js).
        Se a planilha falhar, usa o data/eventos.json como reserva e avisa no terminal.
     2. Apaga as páginas antigas da pasta eventos/ e cria uma página por evento (eventos/<slug>-<data>.html)
     3. Cria eventos/paginas.json (id e nome do evento -> página), usado pelo site para o link "Abrir página do evento"
     4. Cria o sitemap.xml na raiz com a página inicial e as páginas dos eventos que ainda não acabaram

   Só usa o que já vem com o Node 18+ (fs, path e fetch): não precisa de "npm install".
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

/* ---------- 1. CONFIGURAÇÃO ---------- */
const SITE = 'https://www.nearme.pt';
const RAIZ = path.resolve(__dirname, '..');                 // pasta do projeto (Goout)
const ARQUIVO_EVENTOS = path.join(RAIZ, 'data', 'eventos.json');   // reserva, se a planilha falhar
const ARQUIVO_APP = path.join(RAIZ, 'js', 'app.js');                 // de onde vem o link da planilha
const PASTA_PAGINAS = path.join(RAIZ, 'eventos');
const ARQUIVO_INDICE = path.join(PASTA_PAGINAS, 'paginas.json');
const ARQUIVO_SITEMAP = path.join(RAIZ, 'sitemap.xml');
const IMAGEM_PADRAO = `${SITE}/img/marca/nearme-partilha.jpg`;
const FUSO = 'Europe/Lisbon';                                // as datas da planilha estão na hora de Portugal

// Iguais às de js/app.js (o "id" é o valor da coluna categoria)
const CATEGORIAS = {
  'música':      { nome: 'Música',      icone: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  'festa':       { nome: 'Festa',       icone: '<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>' },
  'cultura':     { nome: 'Cultura',     icone: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/>' },
  'gastronomia': { nome: 'Gastronomia', icone: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>' },
  'desporto':    { nome: 'Desporto',    icone: '<circle cx="12" cy="12" r="10"/><path d="m12 7 4 3-1.5 5h-5L8 10z"/>' },
  'outros':      { nome: 'Outros',      icone: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>' },
};

const ICONES = {
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pino: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
  navegar: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  mapa: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
};

function icone(desenho, classe = '') {
  return `<svg class="${`icone ${classe}`.trim()}" viewBox="0 0 24 24" aria-hidden="true">${desenho}</svg>`;
}

/* ---------- 2. FUNÇÕES DE APOIO ---------- */

// Evita que textos do JSON quebrem o HTML (proteção contra XSS)
function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Só aceita links que começam com http:// ou https:// (bloqueia "javascript:" e afins)
function linkSeguro(url) {
  const texto = String(url || '').trim();
  return /^https?:\/\//i.test(texto) ? texto : '';
}

// Links do Google Drive viram link direto da imagem (igual ao js/app.js)
function urlImagem(link) {
  const texto = String(link || '').trim();
  const drive = texto.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/);
  return drive ? `https://lh3.googleusercontent.com/d/${drive[1]}` : texto;
}

// "Pura Loucura!" -> "pura-loucura"
function criarSlug(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                       // tudo o que não é letra/número vira hífen
    .replace(/^-+|-+$/g, '')                           // tira hífens das pontas
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function sem(texto) { return String(texto ?? '').trim(); }

// Remove acentos e deixa em minúsculas ("Música " -> "musica"), igual ao js/app.js
function normalizar(texto) {
  return sem(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Lê números escritos com ponto ou vírgula ("38.71" ou "38,71"); vazio = NaN (e não 0)
function lerNumero(valor) {
  if (valor === null || valor === undefined || sem(valor) === '') return NaN;
  return Number(sem(valor).replace(',', '.'));
}

// Devolve { lat, lng } só se as coordenadas forem válidas; senão null
function coordenadas(e) {
  const lat = lerNumero(e.latitude), lng = lerNumero(e.longitude);
  const valido = Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  return valido ? { lat, lng } : null;
}

// Id da categoria igual ao do site ("Musica" -> "música"); desconhecida = "outros"
function idCategoria(texto) {
  return Object.keys(CATEGORIAS).find(id => normalizar(id) === normalizar(texto)) || 'outros';
}
function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

/* ---------- 2b. LER OS EVENTOS (planilha ou reserva) ---------- */

// Transforma o texto CSV da planilha numa lista de objetos { nome: ..., cidade: ... }
// (cópia da função lerCSV do js/app.js, para os dois lerem a planilha da mesma forma)
function lerCSV(texto) {
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);   // tira a "marca" invisível do início, se houver
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

// Vai buscar o link da planilha ao js/app.js (assim só existe num sítio)
function linkDaPlanilha() {
  const m = fs.readFileSync(ARQUIVO_APP, 'utf8').match(/PLANILHA_CSV_URL:\s*'([^']*)'/);
  return m ? m[1].trim() : '';
}

// Primeiro tenta a planilha; se falhar, usa o data/eventos.json (igual ao site)
async function obterDados(avisos) {
  const link = linkDaPlanilha();
  if (!link) {
    avisos.push('PLANILHA_CSV_URL está vazio no js/app.js: usei o data/eventos.json.');
  } else {
    try {
      const url = new URL(link);
      if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
        throw new Error('o link da planilha devia começar por https://docs.google.com/');
      }
      url.searchParams.set('_', Date.now());   // evita receber uma versão antiga guardada
      const resposta = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
      const dados = lerCSV(await resposta.text());
      // se a planilha deixar de estar publicada, o Google devolve uma página HTML em vez do CSV
      if (!dados.length || !('nome' in dados[0]) || !('data_inicio' in dados[0])) {
        throw new Error('a resposta não parece o CSV da aba Eventos (faltam as colunas nome/data_inicio)');
      }
      return { dados, origem: 'planilha' };
    } catch (erro) {
      avisos.push(`Não consegui ler a planilha (${erro.message}). Usei o data/eventos.json como reserva.`);
    }
  }
  const dados = JSON.parse(fs.readFileSync(ARQUIVO_EVENTOS, 'utf8'));
  if (!Array.isArray(dados)) throw new Error('data/eventos.json devia ser uma lista [ ... ] de eventos.');
  return { dados, origem: 'data/eventos.json (reserva)' };
}

/* ---------- 3. DATAS ----------
   A planilha guarda a hora de Portugal ("2026-11-14 21:00"), sem fuso.
   Guardamos esses números como se fossem UTC só para formatar o texto (fica igual ao que está escrito),
   e calculamos à parte o desvio de Lisboa (+00:00 no inverno, +01:00 no verão) para o Google. */
function lerData(texto) {
  const t = sem(texto);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);   // 14/11/2026 21:00
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)));
  return null;
}

// Desvio de Lisboa naquele dia, em minutos (0 ou 60)
function desvioLisboa(dataFalsaUTC) {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, timeZoneName: 'longOffset' })
    .formatToParts(dataFalsaUTC).find(p => p.type === 'timeZoneName').value;   // "GMT" ou "GMT+01:00"
  const m = nome.match(/([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
}

// "2026-11-14T21:00:00+00:00" (formato que o Google entende)
function dataISO(d) {
  const desvio = desvioLisboa(d);
  const p = n => String(n).padStart(2, '0');
  const sinal = desvio < 0 ? '-' : '+';
  const abs = Math.abs(desvio);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00${sinal}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
}

// Momento real (para comparar com "agora")
function momentoReal(d) { return new Date(d.getTime() - desvioLisboa(d) * 60000); }

// Fim do evento; sem data_fim, 3 horas de duração (mesma regra do site)
function fimDoEvento(e) {
  const ini = lerData(e.data_inicio);
  return lerData(e.data_fim) || (ini ? new Date(ini.getTime() + 3 * 36e5) : null);
}

function jaAcabou(e, agora) {
  const fim = fimDoEvento(e);
  return Boolean(fim && momentoReal(fim) < agora);
}

const fmt = opcoes => new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', ...opcoes });
const fmtDiaLongo = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtDiaMes   = fmt({ day: 'numeric', month: 'long' });
const fmtDiaMesAno = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const fmtCurto    = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const fmtCurtoSemAno = fmt({ day: 'numeric', month: 'short' });
const fmtHora     = fmt({ hour: '2-digit', minute: '2-digit' });

function mesmoDia(a, b) { return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10); }

// Texto completo, ex.: "Sábado, 14 de novembro de 2026 · 21:00 – 23:30"
function textoData(ini, fim) {
  if (!fim || (fim - ini) / 36e5 <= 24) {
    const horas = fim ? `${fmtHora.format(ini)} – ${fmtHora.format(fim)}` : fmtHora.format(ini);
    return `${maiuscula(fmtDiaLongo.format(ini))} · ${horas}`;
  }
  // vários dias: cada hora fica junto do seu dia, ex.: "De 29 de outubro (21:00) a 29 de novembro de 2026 (19:00)"
  return `De ${fmtDiaMes.format(ini)} (${fmtHora.format(ini)}) a ${fmtDiaMesAno.format(fim)} (${fmtHora.format(fim)})`;
}

// Texto curto para o título, ex.: "14/11/2026" ou "29/10 – 29/11/2026"
function textoDataCurta(ini, fim) {
  if (!fim || mesmoDia(ini, fim) || (fim - ini) / 36e5 <= 24) return fmtCurto.format(ini);
  return `${fmtCurtoSemAno.format(ini)} – ${fmtCurto.format(fim)}`;
}

/* ---------- 4. TEXTOS PARA O GOOGLE ---------- */

// Corta um texto no último espaço antes do limite e põe "…"
function cortar(texto, max, min = 0) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max - 1);
  const espaco = corte.lastIndexOf(' ');
  const bonito = (espaco > max * 0.8 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:–—-]+$/, '') + '…';
  // se cortar no fim da palavra deixar o texto curto demais, corta a meio da palavra
  return bonito.length >= min ? bonito : corte.trimEnd() + '…';
}

// Meta description entre 150 e 160 caracteres (se o evento tiver dados suficientes)
function criarDescricao(e, dataCurta) {
  const onde = [sem(e.local_nome), sem(e.cidade)].filter(Boolean).join(', ');
  const cabeca = [sem(e.nome), [dataCurta, onde].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
  let texto = [cabeca, sem(e.descricao)].filter(Boolean).join('. ').replace(/\.\.+/g, '.');
  if (!/[.!?…]$/.test(texto)) texto += '.';
  if (texto.length < 150) texto += ' Vê no mapa e descobre mais eventos perto de ti no Nearme.';
  return cortar(texto, 160, 150);
}

// Dados estruturados schema.org/Event (só com campos que existem no JSON)
function criarJsonLd(e, url, ini, fim, imagem) {
  const morada = { '@type': 'PostalAddress', addressCountry: 'PT' };
  if (sem(e.endereco)) morada.streetAddress = sem(e.endereco);
  if (sem(e.cidade)) morada.addressLocality = sem(e.cidade);

  const local = { '@type': 'Place', name: sem(e.local_nome) || sem(e.cidade), address: morada };
  const coord = coordenadas(e);
  if (coord) local.geo = { '@type': 'GeoCoordinates', latitude: coord.lat, longitude: coord.lng };

  const dados = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: sem(e.nome),
    startDate: dataISO(ini),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: local,
    url,
  };
  if (fim) dados.endDate = dataISO(fim);
  if (sem(e.descricao)) dados.description = sem(e.descricao);
  if (imagem) dados.image = [imagem];

  // "<" vira \u003c: assim nenhum texto do evento consegue fechar a tag <script>
  return JSON.stringify(dados, null, 2).replace(/</g, '\\u003c');
}

/* ---------- 5. HTML DE UMA PÁGINA ---------- */
function paginaEvento(e, slug, agora) {
  const url = `${SITE}/eventos/${slug}.html`;
  const ini = lerData(e.data_inicio);
  const fim = fimDoEvento(e);
  const idCat = idCategoria(e.categoria);
  const cat = CATEGORIAS[idCat];
  const imagem = linkSeguro(urlImagem(e.imagem_url));
  const link = linkSeguro(e.link_externo);
  const coord = coordenadas(e);
  const jaPassou = jaAcabou(e, agora);

  const dataCurta = ini ? textoDataCurta(ini, fim) : '';
  const titulo = [sem(e.nome), dataCurta, sem(e.cidade)].filter(Boolean).join(' — ') + ' | Nearme';
  const descricao = criarDescricao(e, dataCurta);
  const comoChegar = coord
    ? `https://www.google.com/maps/dir/?api=1&destination=${coord.lat},${coord.lng}`
    : (sem(e.endereco) ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sem(e.endereco))}` : '');
  const ano = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descricao)}">
  <meta name="theme-color" content="#FF6A13">
  <link rel="canonical" href="${esc(url)}">
  <link rel="icon" href="/img/marca/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/img/marca/nearme-icone-180.png">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Nearme">
  <meta property="og:locale" content="pt_PT">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:image" content="${esc(imagem || IMAGEM_PADRAO)}">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="preload" href="/fonts/plus-jakarta-sans.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/evento.css">

  <script type="application/ld+json">
${criarJsonLd(e, url, ini, fim, imagem)}
  </script>
</head>
<body class="pagina-evento">
  <header class="topo">
    <a href="/" class="logo" aria-label="Nearme — página inicial">
      <picture>
        <source srcset="/img/marca/nearme-logo-horizontal-escuro.svg?v=2" media="(prefers-color-scheme: dark)">
        <img src="/img/marca/nearme-logo-horizontal-claro.svg?v=2" alt="Nearme" class="logo-img" width="362" height="100">
      </picture>
    </a>
  </header>

  <main>
    <article class="evento">
      <div class="folha-capa">
        <div class="capa" data-cat="${esc(idCat)}">${icone(cat.icone, 'capa-icone')}${imagem ? `<img src="${esc(imagem)}" alt="" width="1200" height="750">` : ''}</div>
      </div>
      <div class="folha-corpo">
        ${jaPassou ? '<p class="aviso-passado" role="note">Este evento já aconteceu.</p>' : ''}
        <span class="tag">${icone(cat.icone, 'icone-sm')} ${esc(cat.nome)}</span>
        <h1>${esc(e.nome)}</h1>
        <ul class="detalhes">
          ${ini ? `<li>${icone(ICONES.calendario)}<span>${esc(textoData(ini, fim))}</span></li>` : ''}
          <li>${icone(ICONES.pino)}<span>${esc(sem(e.local_nome) || sem(e.cidade))}${sem(e.endereco) ? `<br><small>${esc(e.endereco)}</small>` : ''}</span></li>
          <li>${icone(ICONES.euro)}<span>${esc(sem(e.preco) || 'Preço a confirmar')}</span></li>
        </ul>
        ${sem(e.descricao) ? `<p class="descricao">${esc(e.descricao)}</p>` : ''}
        <div class="acoes">
          <a class="botao" href="/#mapa">${icone(ICONES.mapa)} Ver no mapa</a>
          ${link ? `<a class="botao botao-sec" href="${esc(link)}" target="_blank" rel="noopener">${icone(ICONES.externo)} Site ou Instagram do evento</a>` : ''}
          ${comoChegar && !jaPassou ? `<a class="botao botao-texto" href="${esc(comoChegar)}" target="_blank" rel="noopener">${icone(ICONES.navegar)} Como chegar</a>` : ''}
        </div>
      </div>
    </article>
  </main>

  <footer class="rodape">
    <p><a href="/">Ver todos os eventos no Nearme</a></p>
    <p><a href="/#divulgar">Organizas eventos? Divulga aqui</a></p>
    <p><a href="/#privacidade">Política de Privacidade</a></p>
    <p>© ${ano} Nearme</p>
  </footer>
</body>
</html>
`;
}

/* ---------- 6. SITEMAP ---------- */
function criarSitemap(urls, hoje) {
  const linhas = urls.map(u => `  <url>\n    <loc>${esc(u)}</loc>\n    <lastmod>${hoje}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${linhas.join('\n')}\n</urlset>\n`;
}

/* ---------- 7. PROGRAMA PRINCIPAL ---------- */
async function principal() {
  const avisos = [];
  const { dados, origem } = await obterDados(avisos);

  // Mesmos ids que o site usa (js/app.js, prepararEventos): sem id -> "linha-" + número
  const eventos = dados
    .filter(e => e && sem(e.nome))   // linha sem nome = ignorada (como no site)
    .map((e, i) => ({ ...e, id: sem(e.id) || 'linha-' + (i + 2) }));

  // Só eventos com data de início válida (o resto também não aparece no site)
  const validos = eventos.filter(e => {
    if (!lerData(e.data_inicio)) { avisos.push(`"${sem(e.nome)}" ignorado: data_inicio inválida (${sem(e.data_inicio) || 'vazia'}).`); return false; }
    if (!coordenadas(e)) avisos.push(`"${sem(e.nome)}" sem latitude/longitude válidas: a página é criada, mas o evento não aparece no mapa do site.`);
    return true;
  });
  // Proteção: sem nenhum evento válido não apagamos as páginas que já existem
  if (!validos.length) throw new Error(`Nenhum evento válido em ${origem}. Nada foi apagado nem criado.`);

  // Slugs = nome + dia de início, ex.: "pura-loucura-2026-10-29".
  // Assim o endereço de um evento não depende dos outros (sessões repetidas com o mesmo nome
  // ficam separadas pela data) e não muda quando outro evento entra ou sai da lista.
  // Se mesmo assim houver dois iguais (mesmo nome no mesmo dia), entra o id no fim.
  const usados = new Set();
  const slugs = validos.map(e => {
    const base = `${criarSlug(e.nome) || criarSlug(e.id) || 'evento'}-${lerData(e.data_inicio).toISOString().slice(0, 10)}`;
    let slug = base;
    if (usados.has(slug) && criarSlug(e.id)) slug = `${base}-${criarSlug(e.id)}`;
    for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;   // segurança extra (ids repetidos)
    usados.add(slug);
    return slug;
  });

  // Recria a pasta eventos/: apaga só os .html antigos (de eventos que saíram da lista).
  // Com a reserva NÃO apaga nada: o eventos.json pode estar desatualizado e levaria páginas boas.
  const daPlanilha = origem === 'planilha';
  fs.mkdirSync(PASTA_PAGINAS, { recursive: true });
  if (daPlanilha) {
    for (const arquivo of fs.readdirSync(PASTA_PAGINAS)) {
      if (arquivo.endsWith('.html')) fs.unlinkSync(path.join(PASTA_PAGINAS, arquivo));
    }
  }

  const agora = new Date();
  // eventos/paginas.json: { "id-do-evento": { pagina: "slug", nome: "Nome" } }
  // O nome vai junto porque os ids "linha-N" (linhas sem id na planilha) mudam quando se apaga uma linha:
  // o site só mostra o link se o id E o nome baterem certo.
  const indice = Object.create(null);   // objeto "limpo": um id como "__proto__" também fica guardado
  const urlsFuturos = [];   // só os eventos que ainda não acabaram vão para o sitemap
  validos.forEach((e, i) => {
    fs.writeFileSync(path.join(PASTA_PAGINAS, `${slugs[i]}.html`), paginaEvento(e, slugs[i], agora), 'utf8');
    // id repetido: fica o primeiro, porque o site também abre o primeiro (eventos.find)
    if (Object.prototype.hasOwnProperty.call(indice, e.id)) avisos.push(`Id repetido na planilha: "${e.id}" ("${sem(e.nome)}"). Dá a cada evento um id diferente.`);
    else indice[e.id] = { pagina: slugs[i], nome: sem(e.nome) };
    if (!jaAcabou(e, agora)) urlsFuturos.push(`${SITE}/eventos/${slugs[i]}.html`);
  });
  fs.writeFileSync(ARQUIVO_INDICE, JSON.stringify(indice, null, 2) + '\n', 'utf8');

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);   // AAAA-MM-DD
  const urls = [`${SITE}/`, ...urlsFuturos];
  fs.writeFileSync(ARQUIVO_SITEMAP, criarSitemap(urls, hoje), 'utf8');

  console.log(`Origem dos eventos: ${origem} (${eventos.length} eventos com nome)`);
  console.log(`Páginas criadas: ${validos.length} (em ${path.relative(RAIZ, PASTA_PAGINAS)}${path.sep}), das quais ${validos.length - urlsFuturos.length} de eventos que já aconteceram`);
  console.log(`Índice para o site: ${ARQUIVO_INDICE}`);
  console.log(`Sitemap: ${ARQUIVO_SITEMAP} (${urls.length} endereços: página inicial + ${urlsFuturos.length} eventos futuros)`);
  avisos.forEach(a => console.warn('Aviso: ' + a));
  if (!daPlanilha) {
    console.warn('');
    console.warn('ATENÇÃO: as páginas foram geradas a partir da RESERVA (data/eventos.json), não da planilha.');
    console.warn('Nenhuma página antiga foi apagada, mas o sitemap e o paginas.json podem estar incompletos.');
    console.warn('Antes de fazer commit, corre o script de novo quando a planilha estiver disponível.');
    process.exitCode = 2;
  }
}

principal().catch(erro => {
  console.error('Erro: ' + erro.message);
  process.exitCode = 1;
});
