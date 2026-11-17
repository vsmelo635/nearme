// Copia os ficheiros do site para a pasta www/, que é a que vai DENTRO da app iOS.
// Usa-se com "npm run app" (copia + "npx cap sync ios"). Corre sempre que o site mudar.
//
// O que vai para a app: index.html, css/, js/, img/, fonts/ e data/eventos.json
// (o eventos.json é a reserva para quando não há internet; com internet a app lê a planilha).

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'www');

const PASTAS = ['css', 'js', 'img', 'fonts'];
// pré-visualizações do logótipo: não são usadas no site, não vale a pena pô-las na app
const IGNORAR = ['nearme-logo-preview.png'];

// começa do zero, para não ficarem ficheiros antigos que já foram apagados do site
fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(path.join(DESTINO, 'data'), { recursive: true });

for (const pasta of PASTAS) {
  fs.cpSync(path.join(RAIZ, pasta), path.join(DESTINO, pasta), {
    recursive: true,
    filter: origem => !IGNORAR.includes(path.basename(origem)),
  });
}
fs.copyFileSync(path.join(RAIZ, 'data', 'eventos.json'), path.join(DESTINO, 'data', 'eventos.json'));

// index.html: tira o Vercel Web Analytics, que só existe no site publicado (na app daria erro 404)
let html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
html = html.replace(/[ \t]*<!-- Vercel Web Analytics[^\n]*\n[ \t]*<script[^>]*\/_vercel\/insights\/[^>]*><\/script>\r?\n/, '');
if (html.includes('/_vercel/insights/')) {
  console.error('Não consegui tirar o Vercel Web Analytics do index.html (o texto mudou?). Revê scripts/app-copiar.js.');
  process.exit(1);
}
fs.writeFileSync(path.join(DESTINO, 'index.html'), html);

console.log('Site copiado para www/. A seguir: npx cap sync ios');
