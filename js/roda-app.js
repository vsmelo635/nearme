/* =========================================================
   App iOS — Início em carrossel giratório infinito (protótipo aprovado: prototipos/v6.1/index.html)
   Só é carregado dentro da app (js/app-nativa.js); o site nearme.pt não usa este ficheiro.
   Usa os dados e as funções do js/app.js (eventos, abrirEvento, lerGuardados, abrirLeads...),
   que são globais. As funções desenhar(), irParaPainel(), animarDestaque() e vibrar() são as
   do protótipo, com os eventos reais da planilha no lugar dos eventos de exemplo.
   ========================================================= */
(function () {
  'use strict';

  const MIN_HOJE = 5;        // filtro "Hoje" com menos de 5 eventos: completa com os próximos
  const VAGAS = 6;           // com muitos eventos, a roda tem 6 lugares, como no protótipo (senão fica plana demais)
  const MAX_BARRAS = 12;     // acima disto, em vez das barrinhas aparece "3 / 40"
  const CHAVE_GOSTOS = 'nearme-gostos-v1';
  const LEADS = null;        // item especial: painel "Não percas o que vem aí"

  const SVG = {
    logo: '<path d="M57.42 82.15A33 33 0 1 1 82.75 45.98" fill="none" stroke="#FF6A13" stroke-width="15" stroke-linecap="round"/><circle cx="77.03" cy="68.93" r="9.3" fill="#FF6A13"/>',
    lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    setas: '<path d="M18 8l4 4-4 4"/><path d="M6 8l-4 4 4 4"/><path d="M2 12h20"/>',
    pino: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    coracao: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    guardar: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    mapa: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
  };
  const ic = (d, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

  let roda, car, palco, pista, barras, aviso;
  let modo = 'todos';
  let itens = [];      // { e: evento, etq: 'Hoje' | categoria | 'Amanhã' | 'Sáb 22' } ou LEADS
  let paineis = [];
  let chave = '';      // o que está desenhado (para não refazer a roda sem necessidade)
  let p = 0, anim = null, ultimoInteiro = 0, raio = 260, barraAtual = -1;
  const arrastar = { ativo: false };

  /* ---------- vibração: Capacitor Haptics (vibração real do iPhone) + tremida no ecrã ---------- */
  const haptics = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
  function impacto(estilo) {
    if (!haptics) return;
    try { haptics.impact({ style: estilo }).catch(() => {}); } catch (_) { /* plugin em falta */ }
  }
  function vibrar(forte) {
    impacto(forte ? 'MEDIUM' : 'LIGHT');   // médio ao encaixar, leve a cada evento que passa
    if (forte) {
      roda.classList.remove('vibra'); void roda.offsetWidth; roda.classList.add('vibra');
      animarDestaque(1, 460);
    } else {
      pista.classList.remove('tique'); void pista.offsetWidth; pista.classList.add('tique');
    }
  }

  /* destaque: o painel que encaixa no centro cresce um pouco (com um pequeno pulo) e fica maior */
  let destaque = 0, animDest = null;
  function animarDestaque(alvo, dur) {
    if (animDest) cancelAnimationFrame(animDest);
    const de = destaque, t0 = performance.now();
    function ease(t) { if (alvo < de) return 1 - Math.pow(1 - t, 3); const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function passo(agora) {
      const t = Math.min(1, (agora - t0) / dur);
      destaque = de + (alvo - de) * ease(t);
      desenhar();
      animDest = t < 1 ? requestAnimationFrame(passo) : null;
    }
    animDest = requestAnimationFrame(passo);
  }

  const modulo = (a, n) => ((a % n) + n) % n;
  const atual = () => modulo(Math.round(p), itens.length);

  /* ---------- gostos (ficam só no telemóvel, como os guardados) ---------- */
  function lerGostos() {
    try { const l = JSON.parse(localStorage.getItem(CHAVE_GOSTOS)); return Array.isArray(l) ? l.map(String) : []; }
    catch (_) { return []; }
  }
  function gravarGostos(l) { try { localStorage.setItem(CHAVE_GOSTOS, JSON.stringify(l)); } catch (_) { /* sem espaço */ } }

  function pulsar(b) { b.classList.remove('pulsa'); void b.offsetWidth; b.classList.add('pulsa'); }
  function marcarGosto(b, on) {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Já não gosto' : 'Gosto');
  }
  function marcarGuardar(b, on) {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Guardado' : 'Guardar');
  }
  // alternar = false: só liga (dois toques nunca tiram o gosto)
  function alternarGosto(id, b, alternar) {
    const l = lerGostos(), tinha = l.includes(id);
    const on = tinha ? !alternar : true;
    if (on !== tinha) gravarGostos(on ? [...l, id] : l.filter(x => x !== id));
    if (b) { marcarGosto(b, on); pulsar(b); }
  }
  function alternarGuardadoRoda(id, b) {
    const l = lerGuardados(), tinha = l.includes(id);
    if (!gravarGuardados(tinha ? l.filter(x => x !== id) : [...l, id])) { avisar('Não foi possível guardar o evento.'); return; }
    marcarGuardar(b, !tinha);
    if (!tinha) pulsar(b);
    renderGuardados(); // número na aba Guardados
  }

  /* ---------- quais eventos vão para a roda ---------- */
  function etiquetaDia(e) {
    const amanha = inicioDoDia(new Date()); amanha.setDate(amanha.getDate() + 1);
    if (inicioDoDia(e.inicio).getTime() === amanha.getTime()) return 'Amanhã';
    // "Sáb 22" (há navegadores que escrevem o dia da semana por extenso: fica-se pelas 3 primeiras letras)
    return `${maiuscula(semPonto(fmtSemana.format(e.inicio)).slice(0, 3))} ${e.inicio.getDate()}`;
  }
  function escolherItens() {
    const agora = new Date(), fimHoje = fimDoDia(agora);
    const eHoje = e => e.inicio <= fimHoje && e.fim >= agora;
    const lista = eventos.filter(e => e.fim >= agora && passaNaBusca(e));
    const normal = e => ({ e, etq: eHoje(e) ? 'Hoje' : categoriaDe(e.categoria).nome });

    if (modo === 'hoje') {
      const deHoje = lista.filter(eHoje);
      const proximos = lista.filter(e => !eHoje(e)).slice(0, Math.max(0, MIN_HOJE - deHoje.length));
      return [...deHoje.map(e => ({ e, etq: 'Hoje' })), ...proximos.map(e => ({ e, etq: etiquetaDia(e) }))];
    }
    if (modo === 'semana') {
      const domingo = new Date(agora); domingo.setDate(domingo.getDate() + (7 - agora.getDay()) % 7);
      const fimSemana = fimDoDia(domingo);
      return lista.filter(e => e.inicio <= fimSemana).map(normal);
    }
    return lista.map(normal);
  }

  /* ---------- painéis ---------- */
  function criarPainel(it, k) {
    const d = document.createElement('article');
    if (it === LEADS) {
      d.className = 'painel leads';
      d.innerHTML =
        '<div class="leads-p">' +
          `<svg class="logo-l" viewBox="0 0 100 100" aria-hidden="true">${SVG.logo}</svg>` +
          '<h2>Não percas o que vem aí</h2>' +
          '<p>Recebe os melhores eventos perto de ti, ou divulga o teu evento no Nearme. É grátis.</p>' +
          '<button type="button" class="bt-enviar" data-r-leads="novidades">Quero novidades</button>' +
          '<button type="button" class="bt-sec" data-r-leads="divulgar">Divulgar o meu evento</button>' +
        '</div><div class="p-sombra"></div>';
      d.querySelectorAll('[data-r-leads]').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        if (eCentro(d)) abrirLeads(b.dataset.rLeads);
      }));
      return d;
    }

    const e = it.e, cat = categoriaDe(e.categoria);
    d.className = 'painel';
    d.setAttribute('aria-label', e.nome);
    const fundo = document.createElement('div');
    fundo.className = 'p-fundo capa';         // sem foto (ou se a foto falhar): fica a cor da categoria
    fundo.dataset.cat = e.categoria;
    fundo.innerHTML = icone(cat.icone, 'capa-icone');
    const url = linkSeguro(urlImagem(e.imagem_url));
    if (url) {
      const img = document.createElement('img');
      img.alt = ''; img.decoding = 'async'; img.draggable = false;
      img.dataset.src = url;   // a foto só é descarregada quando o painel chega perto do centro (ver desenhar)
      fundo.appendChild(img);
    }
    d.appendChild(fundo);

    const selo = dataDoSelo(e);
    d.insertAdjacentHTML('beforeend',
      '<div class="p-veu"></div><div class="p-brilho"></div>' +
      '<div class="p-topo"><span class="p-etq"></span><span class="p-dia"><b></b><small></small></span></div>' +
      '<div class="p-base"><h2></h2>' +
        `<p class="p-linha">${ic(SVG.pino)}<span data-r-local></span></p>` +
        `<p class="p-linha">${ic(SVG.relogio)}<span data-r-quando></span></p>` +
        '<p class="p-preco"></p>' +
        '<div class="p-accoes">' +
          `<button type="button" class="p-bt" data-r-gosto aria-pressed="false" aria-label="Gosto">${ic(SVG.coracao)}</button>` +
          `<button type="button" class="p-bt" data-r-guardar aria-pressed="false" aria-label="Guardar">${ic(SVG.guardar)}</button>` +
          `<button type="button" class="p-bt mapa" data-r-mapa>${ic(SVG.mapa)}Mapa</button>` +
        '</div></div>' +
      `<div class="coracao"><svg viewBox="0 0 24 24" aria-hidden="true">${SVG.coracao}</svg></div><div class="p-sombra"></div>`);
    d.querySelector('.p-etq').textContent = it.etq;
    d.querySelector('.p-dia b').textContent = selo.getDate();
    d.querySelector('.p-dia small').textContent = semPonto(fmtMes.format(selo)).toUpperCase();
    d.querySelector('h2').textContent = e.nome;
    d.querySelector('[data-r-local]').textContent = [e.local_nome, e.cidade].filter(Boolean).join(' · ');
    d.querySelector('[data-r-quando]').textContent = textoDataCurta(e);
    d.querySelector('.p-preco').textContent = e.preco || 'Preço a confirmar';

    // os botões só funcionam no painel do centro
    const bG = d.querySelector('[data-r-gosto]');
    bG.addEventListener('click', ev => { ev.stopPropagation(); if (eCentro(d)) alternarGosto(e.id, bG, true); });
    const bS = d.querySelector('[data-r-guardar]');
    bS.addEventListener('click', ev => { ev.stopPropagation(); if (eCentro(d)) alternarGuardadoRoda(e.id, bS); });
    d.querySelector('[data-r-mapa]').addEventListener('click', ev => {
      ev.stopPropagation();
      if (!eCentro(d)) return;
      eventoParaFocar = e.id;   // o Mapa abre já com zoom neste evento (js/app.js → ajustarMapa)
      location.hash = 'mapa';
    });
    return d;
  }
  const eCentro = d => d.classList.contains('centro');

  // gostos e guardados nos botões (também quando se guarda no detalhe do evento)
  function marcarEstados() {
    const gostos = lerGostos(), guardados = lerGuardados();
    paineis.forEach((d, k) => {
      const it = itens[k];
      if (it === LEADS) return;
      marcarGosto(d.querySelector('[data-r-gosto]'), gostos.includes(it.e.id));
      marcarGuardar(d.querySelector('[data-r-guardar]'), guardados.includes(it.e.id));
    });
  }

  function mostrarAviso() {
    const temEventos = itens.length > 1;
    let texto = '';
    if (!temEventos) {
      if (erroAoCarregar) texto = 'Não foi possível carregar os eventos.';
      else if (!eventosProntos && !eventos.length) texto = 'A carregar eventos…';
      else if (estado.busca) texto = `Nenhum evento encontrado para “${estado.busca}”.`;
      else texto = modo === 'semana' ? 'Não há eventos esta semana.' : 'Não há eventos para mostrar.';
    }
    aviso.textContent = texto;
    aviso.hidden = !texto;
  }

  function montar() {
    const novos = [...escolherItens(), LEADS];
    const novaChave = modo + '|' + novos.map(it => (it === LEADS ? '*' : it.e.id + ':' + it.etq + ':' + it.e.nome + ':' + it.e.imagem_url)).join('|');
    if (novaChave === chave) { marcarEstados(); mostrarAviso(); return; }

    // dados novos (ex.: a planilha chegou): mantém o evento que estava no centro, se ainda existir
    const antes = chave && itens.length ? itens[atual()] : undefined;
    const idAntes = antes && antes !== LEADS ? antes.e.id : '';
    const mesmoModo = chave.split('|')[0] === modo;
    chave = novaChave;
    itens = novos;

    pista.textContent = '';
    paineis = itens.map((it, k) => { const d = criarPainel(it, k); pista.appendChild(d); return d; });
    marcarEstados();
    mostrarAviso();
    barraAtual = -1;
    barras.textContent = '';
    if (itens.length <= MAX_BARRAS) itens.forEach(() => barras.appendChild(document.createElement('i')));
    else barras.innerHTML = '<span class="barras-num"></span>';

    if (anim) { cancelAnimationFrame(anim); anim = null; }
    const k = mesmoModo && idAntes ? itens.findIndex(it => it !== LEADS && it.e.id === idAntes) : -1;
    if (k >= 0) {
      p = k; ultimoInteiro = k; destaque = 1;   // continua onde estava, sem pulo
      desenhar();
    } else {
      p = 0; ultimoInteiro = 0; destaque = 0;
      desenhar();
      setTimeout(() => animarDestaque(1, 460), 120);
    }
  }

  /* carrossel giratório: os painéis estão à volta de um cilindro e a roda gira */
  function desenhar() {
    const n = itens.length;
    const vagas = Math.min(Math.max(n, 3), VAGAS);
    const ang = 360 / vagas;
    raio = Math.max(250, Math.round((262 / 2 + 18) / Math.tan(Math.PI / vagas)));
    pista.style.setProperty('--raio-neg', (-raio) + 'px');
    paineis.forEach((el, k) => {
      let d = k - p;
      d -= n * Math.round(d / n);              // infinito: dá a volta
      const a = d * ang, ad = Math.abs(d);
      const frente = Math.cos(Math.min(Math.abs(a), 180) * Math.PI / 180);   // 1 = de frente, -1 = atrás
      if (frente < -0.3) {                     // escondido: não mexe mais nele (poupa o telemóvel)
        // display:none: sai da página e liberta a memória (com 100+ eventos, faz diferença no iPhone)
        if (!el._oculto) { el._oculto = true; el.style.display = 'none'; el.classList.remove('centro'); }
        return;
      }
      if (el._oculto !== false) {
        el._oculto = false;
        el.style.display = '';
        const im = el.querySelector('img[data-src]');
        if (im) { im.src = im.dataset.src; im.removeAttribute('data-src'); }
      }
      const cresce = 1 + 0.14 * destaque * Math.max(0, 1 - ad * 2);
      el.style.transform = `rotateY(${a.toFixed(2)}deg) translateZ(${raio}px) scale(${cresce.toFixed(4)})`;
      el.style.opacity = frente < -0.2 ? 0 : 1;
      el.style.visibility = 'visible';
      el.lastChild.style.opacity = Math.min(0.82, (1 - frente) * 0.75).toFixed(2);   // .p-sombra: os de trás mais escuros
      el.classList.toggle('centro', ad < 0.5);
    });
    const inteiro = Math.round(p);
    if (inteiro !== ultimoInteiro) { ultimoInteiro = inteiro; if (arrastar.ativo) vibrar(false); }
    const a = atual();
    if (a !== barraAtual) {
      barraAtual = a;
      if (n <= MAX_BARRAS) Array.prototype.forEach.call(barras.children, (b, k) => b.classList.toggle('on', k === a));
      else barras.firstChild.textContent = itens[a] === LEADS ? 'Novidades' : `${a + 1} / ${n - 1}`;
    }
  }

  /* animação até um painel, com um pequeno ressalto no fim (como um "clique") */
  function irParaPainel(alvo, dur) {
    if (anim) cancelAnimationFrame(anim);
    const de = p, t0 = performance.now(), D = dur || 560;
    if (Math.abs(alvo - de) > 0.3 && destaque > 0) animarDestaque(0, 160);
    let passou = Math.round(de);
    function easeOutBack(t) { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function passo(agora) {
      const t = Math.min(1, (agora - t0) / D);
      p = de + (alvo - de) * easeOutBack(t);
      const r = Math.round(p);
      if (r !== passou && Math.abs(alvo - de) > 1) { passou = r; vibrar(false); }
      desenhar();
      if (t < 1) anim = requestAnimationFrame(passo);
      else { p = alvo; desenhar(); anim = null; vibrar(true); }
    }
    anim = requestAnimationFrame(passo);
  }
  const avancar = n => irParaPainel(Math.round(p) + n);

  // Em ecrãs baixos (iPhone SE) o palco encolhe para o painel do centro caber inteiro
  function ajustarEscala() {
    const alt = car.clientHeight;
    if (!alt) return;
    const s = Math.min(1, (alt - 24) / (440 * 1.14), (window.innerWidth - 20) / (262 * 1.14));
    palco.style.transform = s < 1 ? `scale(${s.toFixed(3)})` : '';
  }

  /* ---------- gestos: arrastar, tocar, dois toques, roda do rato e setas ---------- */
  function ligarGestos() {
    let x0, y0, p0, mov, hist = [], ultimoToque = 0, temporiz = null, idPonteiro = null, suprimirClique = false;
    const botaoAtivo = t => { const b = t.closest('button'); return b && eCentro(b.closest('.painel') || car) ? b : null; };

    car.addEventListener('pointerdown', ev => {
      if (ev.button > 0) return;
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      if (destaque > 0) animarDestaque(0, 160);
      arrastar.ativo = true; mov = false; suprimirClique = false;
      x0 = ev.clientX; y0 = ev.clientY; p0 = p; idPonteiro = ev.pointerId;
      hist = [{ t: performance.now(), p }];
    });
    car.addEventListener('pointermove', ev => {
      if (!arrastar.ativo || ev.pointerId !== idPonteiro) return;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!mov && (Math.abs(dx) > 7 || Math.abs(dy) > 10)) {
        mov = true;
        clearTimeout(temporiz); ultimoToque = 0;   // tocar e logo arrastar não abre o evento
        car.classList.add('agarrado');
        // só "agarra" o dedo depois de mexer: assim um toque num botão continua a ser um clique normal
        try { car.setPointerCapture(ev.pointerId); } catch (_) { /* ignora */ }
      }
      p = p0 - dx / 250;
      hist.push({ t: performance.now(), p }); if (hist.length > 6) hist.shift();
      desenhar();
    });
    function largar(ev) {
      if (!arrastar.ativo || ev.pointerId !== idPonteiro) return;
      arrastar.ativo = false; car.classList.remove('agarrado');
      if (!mov) {
        if (ev.type === 'pointercancel') { irParaPainel(Math.round(p)); return; }
        if (botaoAtivo(ev.target)) { animarDestaque(1, 300); return; }   // o botão trata do clique
        toque(ev);
        return;
      }
      suprimirClique = true;
      const a = hist[0], b = hist[hist.length - 1];
      const v = (b.p - a.p) / Math.max(16, b.t - a.t) * 1000;   // painéis por segundo
      let alvo = Math.round(p + Math.max(-2.5, Math.min(2.5, v * 0.18)));
      if (alvo === Math.round(p0) && Math.abs(p - p0) > 0.18) alvo = Math.round(p0) + (p > p0 ? 1 : -1);
      irParaPainel(alvo, 520);
    }
    // na janela: se o dedo sair do carrossel antes de o "agarrar", o fim do gesto chega na mesma
    window.addEventListener('pointerup', largar);
    window.addEventListener('pointercancel', largar);
    // depois de arrastar, o dedo levantado em cima de um botão não conta como clique
    car.addEventListener('click', ev => {
      if (suprimirClique) { ev.stopPropagation(); ev.preventDefault(); suprimirClique = false; }
    }, true);

    function toque(ev) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const pn = el && el.closest('.painel');
      if (!pn) { irParaPainel(Math.round(p)); return; }
      const k = paineis.indexOf(pn), n = itens.length;
      let d = k - p; d -= n * Math.round(d / n);
      if (Math.abs(d) > 0.5) { irParaPainel(Math.round(p + d)); return; }   // painel do lado: traz para o centro
      if (itens[k] === LEADS) { animarDestaque(1, 300); return; }
      const e = itens[k].e, agora = Date.now();
      if (agora - ultimoToque < 320) {         // dois toques: gosto + coração
        clearTimeout(temporiz); ultimoToque = 0;
        alternarGosto(e.id, pn.querySelector('[data-r-gosto]'), false);
        const c = pn.querySelector('.coracao'); c.classList.remove('mostra'); void c.offsetWidth; c.classList.add('mostra');
        vibrar(true);
      } else {                                 // um toque: abre o detalhe
        ultimoToque = agora;
        if (destaque < 1) animarDestaque(1, 300);
        temporiz = setTimeout(() => abrirEvento(e.id), 330);
      }
    }

    // roda do rato / trackpad
    let acum = 0, bloqueio = 0;
    car.addEventListener('wheel', ev => {
      ev.preventDefault();
      acum += Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      const agora = Date.now();
      if (Math.abs(acum) > 40 && agora > bloqueio) { avancar(acum > 0 ? 1 : -1); acum = 0; bloqueio = agora + 380; }
    }, { passive: false });
    car.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); avancar(1); }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); avancar(-1); }
      if (ev.key === 'Enter') {
        const it = itens[atual()];
        if (it && it !== LEADS) abrirEvento(it.e.id); else if (it === LEADS) abrirLeads('novidades');
      }
    });
  }

  /* ---------- arranque ---------- */
  function arrancar() {
    if (!document.documentElement.classList.contains('app') || typeof eventos === 'undefined') return;

    roda = document.createElement('section');
    roda.className = 'roda';
    roda.setAttribute('aria-label', 'Eventos');
    roda.innerHTML = `
      <div class="carrossel" tabindex="0" aria-roledescription="carrossel" aria-label="Eventos">
        <div class="palco3d"><div class="pista"></div></div>
      </div>
      <p class="conta-feed" role="status" hidden></p>
      <div class="topo-feed">
        <div class="linha-logo">
          <div class="logotipo"><svg viewBox="0 0 100 100" aria-hidden="true">${SVG.logo}</svg><span>nearme</span></div>
          <button type="button" class="bt-lupa" aria-label="Procurar eventos">${ic(SVG.lupa, 'ic ic-sm')}</button>
        </div>
        <div class="roda-chips" role="group" aria-label="Quando">
          <button type="button" class="roda-chip on" data-modo="todos" aria-pressed="true">Tudo</button>
          <button type="button" class="roda-chip" data-modo="hoje" aria-pressed="false">Hoje</button>
          <button type="button" class="roda-chip" data-modo="semana" aria-pressed="false">Esta semana</button>
        </div>
      </div>
      <div class="rodape-car">
        <div class="barras" aria-hidden="true"></div>
        <span class="dica-car">${ic(SVG.setas)}Arrasta para o lado</span>
      </div>`;
    // fica logo a seguir ao fundo animado (o canvas), antes do topo e do resto da página
    document.getElementById('fundo-mapa').after(roda);

    car = roda.querySelector('.carrossel');
    palco = roda.querySelector('.palco3d');
    pista = roda.querySelector('.pista');
    barras = roda.querySelector('.barras');
    aviso = roda.querySelector('.conta-feed');

    roda.querySelectorAll('.roda-chip').forEach(c => c.addEventListener('click', () => {
      if (c.dataset.modo === modo) return;
      modo = c.dataset.modo;
      roda.querySelectorAll('.roda-chip').forEach(o => {
        o.classList.toggle('on', o === c);
        o.setAttribute('aria-pressed', String(o === c));
      });
      montar();
    }));

    // Lupa: mostra a barra de pesquisa da app; fecha-se sozinha se a pessoa sair sem escrever nada
    const busca = document.getElementById('busca');
    roda.querySelector('.bt-lupa').addEventListener('click', () => {
      document.body.classList.add('pesquisa-aberta');
      busca.focus();
    });
    busca.addEventListener('blur', () => {
      if (!busca.value.trim()) document.body.classList.remove('pesquisa-aberta');
    });

    ligarGestos();
    if (window.ResizeObserver) new ResizeObserver(ajustarEscala).observe(car);
    else window.addEventListener('resize', ajustarEscala);

    montar();
    // só agora se esconde o Início do site (css/style.css): se este ficheiro falhar, a app mostra-o
    document.documentElement.classList.add('com-roda');
  }

  // chamado pelo js/app.js quando os eventos ou os filtros mudam
  window.RodaApp = {
    atualizar() { if (roda) montar(); },
    marcarEstados() { if (roda) marcarEstados(); },
  };

  // espera que o js/app.js tenha corrido (ele está no fim do <body>)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
