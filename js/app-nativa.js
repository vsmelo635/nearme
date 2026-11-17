/* =========================================================
   App iOS (Capacitor)
   Este ficheiro corre no site E na app, mas só faz alguma coisa na app.
   - Põe a classe "app" no <html>: o css/style.css usa-a para mostrar a barra de abas
     estilo iPhone (no site nearme.pt fica tudo como está).
   - Esconde o ecrã de abertura (splash) quando a página já está pronta.
   Fica no <head> (sem "defer") para a classe entrar antes de a página aparecer.
   ========================================================= */
(function () {
  // Na app, o Capacitor cria o window.Capacitor antes de a página carregar. No site não existe.
  const cap = window.Capacitor;
  const naApp = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  if (!naApp) return;

  document.documentElement.classList.add('app');

  // O splash esconde-se sozinho ao fim de 3 s (capacitor.config.json); aqui escondemo-lo
  // mais cedo, logo que a página carregou, com um pequeno atraso para não "piscar".
  window.addEventListener('load', function () {
    setTimeout(function () {
      const splash = cap.Plugins && cap.Plugins.SplashScreen;
      if (splash) splash.hide({ fadeOutDuration: 300 }).catch(function () {});
    }, 400);
  });
})();
