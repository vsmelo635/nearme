// ===== Fundo animado do Nearme: mapa com ruas, rio e pins a pulsar =====
(function () {
  const canvas = document.getElementById('fundo-mapa');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const COR = '255, 106, 19'; // laranja da marca (#FF6A13)
  const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let L, A, ruas = [], pins = [], rio = [];

  // número "aleatório" que dá sempre o mesmo desenho
  let semente = 7;
  const aleatorio = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };

  function montar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    L = window.innerWidth; A = window.innerHeight;
    canvas.width = L * dpr; canvas.height = A * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    semente = 7;

    // ruas "horizontais" tortas
    ruas = [];
    const linhasH = Math.max(4, Math.round(A / 150));
    for (let i = 0; i < linhasH; i++) {
      const y0 = (A / linhasH) * (i + 0.5);
      const pts = [];
      for (let x = -50; x <= L + 50; x += 160 + aleatorio() * 160) pts.push([x, y0 + (aleatorio() - 0.5) * 90]);
      ruas.push(pts);
    }
    // ruas "verticais" tortas
    const linhasV = Math.max(4, Math.round(L / 220));
    for (let i = 0; i < linhasV; i++) {
      const x0 = (L / linhasV) * (i + 0.5);
      const pts = [];
      for (let y = -50; y <= A + 50; y += 140 + aleatorio() * 160) pts.push([x0 + (aleatorio() - 0.5) * 160, y]);
      ruas.push(pts);
    }
    // ruazinhas curtas na diagonal
    for (let i = 0; i < Math.round((L * A) / 120000); i++) {
      const x = aleatorio() * L, y = aleatorio() * A, ang = aleatorio() * Math.PI, c = 60 + aleatorio() * 90;
      ruas.push([[x, y], [x + Math.cos(ang) * c, y + Math.sin(ang) * c]]);
    }
    // rio (Tejo) em baixo
    rio = [];
    for (let x = -20; x <= L + 20; x += 20) rio.push([x, A - 70 + Math.sin(x / 260) * 28 + Math.sin(x / 90) * 6]);

    // pins
    pins = [];
    const total = Math.max(5, Math.round((L * A) / 110000));
    for (let i = 0; i < total; i++) pins.push({ x: aleatorio() * L, y: aleatorio() * (A - 120), fase: aleatorio() });
  }

  function traco(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  function desenhar(tempo) {
    ctx.clearRect(0, 0, L, A);
    const t = semAnimacao ? 0.3 : (tempo || 0) / 1000;

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${COR}, 0.13)`;
    ruas.forEach(traco);

    ctx.beginPath();
    ctx.moveTo(rio[0][0], rio[0][1]);
    rio.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(L + 20, A + 20); ctx.lineTo(-20, A + 20); ctx.closePath();
    ctx.fillStyle = `rgba(${COR}, 0.05)`; ctx.fill();
    ctx.strokeStyle = `rgba(${COR}, 0.18)`; ctx.stroke();

    pins.forEach(p => {
      const c = (t * 0.45 + p.fase) % 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 + c * 22, 0, Math.PI * 2);
      ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${COR}, ${0.45 * (1 - c)})`; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COR}, 0.85)`; ctx.fill();
    });

    if (!semAnimacao) requestAnimationFrame(desenhar);
  }

  montar();
  requestAnimationFrame(desenhar);
  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(montar, 200); });
})();
