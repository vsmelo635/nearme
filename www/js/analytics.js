/* =========================================================
   Nearme — Google Analytics 4 com consentimento (RGPD + ePrivacy)
   Arquivo: js/analytics.js

   Como funciona:
   - Na primeira visita mostra um banner com "Recusar" e "Aceitar" (iguais em tamanho e destaque).
   - A escolha fica guardada no navegador (localStorage, chave "nearme-consentimento": "sim" ou "nao").
   - O script do Google SÓ é descarregado depois de "Aceitar". Com "Recusar" não sai nenhum pedido para a Google.
   - Qualquer botão/link com o atributo data-definicoes-cookies volta a abrir o banner (mudar de ideias).
   - Se o navegador não deixar guardar a escolha (ex.: alguns modos privados), o Analytics não é carregado.

   Fica num arquivo próprio (e não dentro do HTML) porque a política de segurança (CSP do vercel.json)
   bloqueia código JavaScript escrito diretamente no HTML.
   ========================================================= */
(function () {
  'use strict';

  const ID_MEDICAO = 'G-3Z9J7S8B1R';
  const CHAVE = 'nearme-consentimento';             // "sim" ou "nao"
  const CHAVE_DATA = 'nearme-consentimento-data';   // quando a pessoa escolheu (milissegundos)
  const VALIDADE_MS = 182 * 24 * 60 * 60 * 1000;   // a escolha vale ~6 meses; depois o banner volta a perguntar

  /* ---------- Guardar e ler a escolha (com proteção para modo privado) ---------- */
  function lerEscolha() {
    try {
      const valor = localStorage.getItem(CHAVE);
      const data = Number(localStorage.getItem(CHAVE_DATA));
      if (valor !== 'sim' && valor !== 'nao') return '';
      if (!data || Date.now() - data > VALIDADE_MS) return '';   // escolha antiga: perguntar de novo
      return valor;
    } catch (_) {
      return '';   // não conseguimos ler: tratamos como "ainda não escolheu"
    }
  }

  // Devolve true se conseguiu guardar
  function guardarEscolha(valor) {
    try {
      localStorage.setItem(CHAVE, valor);
      localStorage.setItem(CHAVE_DATA, String(Date.now()));
      return localStorage.getItem(CHAVE) === valor;
    } catch (_) {
      return false;
    }
  }

  /* ---------- Google Analytics ---------- */
  let analyticsCarregado = false;

  function carregarAnalytics() {
    if (analyticsCarregado) {
      // já estava carregado nesta visita (a pessoa recusou e depois aceitou de novo): volta a ligar
      window['ga-disable-' + ID_MEDICAO] = false;
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
      window.gtag('event', 'page_view');   // conta a página atual, que não foi contada enquanto estava desligado
      return;
    }
    analyticsCarregado = true;
    window['ga-disable-' + ID_MEDICAO] = false;

    // Equivalente ao código que a Google manda colar no HTML, mas aqui dentro do arquivo
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',   // a pessoa aceitou as estatísticas
      ad_storage: 'denied',           // nada de publicidade
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', ID_MEDICAO, {
      allow_google_signals: false,              // sem cruzar com contas Google / publicidade
      allow_ad_personalization_signals: false,
      cookie_expires: 13 * 30 * 24 * 60 * 60,   // cookies duram no máximo ~13 meses (o padrão da Google é 2 anos)
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID_MEDICAO);
    document.head.appendChild(script);
  }

  // A pessoa mudou de ideias para "Recusar": desliga o Analytics e apaga os cookies dele
  function desligarAnalytics() {
    window['ga-disable-' + ID_MEDICAO] = true;
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    apagarCookiesAnalytics();
  }

  // Apaga os cookies _ga e _ga_XXXX no domínio atual e nos domínios "pai" (ex.: www.nearme.pt e .nearme.pt)
  function apagarCookiesAnalytics() {
    const nomes = document.cookie.split(';')
      .map(c => c.split('=')[0].trim())
      .filter(n => n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid' || n === '_gat');
    if (!nomes.length) return;
    const partes = location.hostname.split('.');
    const dominios = [''];
    for (let i = 0; i < partes.length - 1; i++) dominios.push('.' + partes.slice(i).join('.'));
    nomes.forEach(nome => {
      dominios.forEach(dominio => {
        document.cookie = nome + '=; Max-Age=0; path=/' + (dominio ? '; domain=' + dominio : '');
      });
    });
  }

  /* ---------- Banner ---------- */
  let banner = null;
  let elementoAnterior = null;   // botão que reabriu o banner (o foco volta para ele no fim)

  function criarBanner() {
    banner = document.createElement('div');
    banner.className = 'banner-cookies';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Consentimento de cookies');
    banner.innerHTML =
      '<p class="banner-cookies-texto">Usamos cookies de estatística (Google Analytics) para perceber como o site é usado. ' +
      'Só os ativamos se aceitares e podes mudar de ideias quando quiseres. ' +
      '<a href="/#privacidade">Política de Privacidade</a></p>' +
      '<div class="banner-cookies-botoes">' +
        '<button type="button" class="botao-cookies" data-escolha="nao">Recusar</button>' +
        '<button type="button" class="botao-cookies" data-escolha="sim">Aceitar</button>' +
      '</div>';
    banner.addEventListener('click', ev => {
      const botao = ev.target.closest('[data-escolha]');
      if (botao) escolher(botao.dataset.escolha);
    });
    document.body.appendChild(banner);
  }

  function mostrarBanner() {
    if (!banner) criarBanner();
    banner.hidden = false;
    document.body.classList.add('com-banner-cookies');
    // altura do banner, para o CSS subir os botões de zoom do mapa e não ficarem tapados
    document.documentElement.style.setProperty('--altura-banner', banner.offsetHeight + 'px');
  }

  function esconderBanner() {
    if (banner) banner.hidden = true;
    document.body.classList.remove('com-banner-cookies');
    if (elementoAnterior && document.contains(elementoAnterior)) elementoAnterior.focus();
    elementoAnterior = null;
  }

  function escolher(valor) {
    const guardou = guardarEscolha(valor);
    esconderBanner();
    if (valor === 'sim' && guardou) carregarAnalytics();   // sem conseguir guardar, não carregamos
    else desligarAnalytics();
  }

  /* ---------- Início ---------- */
  function iniciar() {
    const escolha = lerEscolha();
    if (escolha === 'sim') carregarAnalytics();
    else if (escolha === 'nao') apagarCookiesAnalytics();   // limpa restos de visitas antigas
    else mostrarBanner();

    // "Definições de cookies" (rodapé e Política de Privacidade): volta a abrir o banner
    document.addEventListener('click', ev => {
      const link = ev.target.closest('[data-definicoes-cookies]');
      if (!link) return;
      ev.preventDefault();
      elementoAnterior = link;
      mostrarBanner();
      const primeiro = banner.querySelector('[data-escolha]');
      if (primeiro) primeiro.focus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
