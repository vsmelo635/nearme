// Copia os ficheiros do site para a pasta www/, que é a que vai DENTRO da app iOS.
// Usa-se com "npm run app" (copia + "npx cap sync ios"). Corre sempre que o site mudar.
//
// O que vai para a app: index.html, css/, js/, img/, fonts/, data/eventos.json e o Leaflet (vendor/leaflet/)
// (o eventos.json é a reserva para quando não há internet; com internet a app lê a planilha).
// Só vão estas pastas: a pasta prototipos/ (referência dos protótipos) nunca entra na app.

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

// Leaflet (o mapa) vai DENTRO da app, para o Mapa abrir sem internet e sem depender do unpkg.com.
// Vem do node_modules/ (npm install); são exatamente os mesmos ficheiros que o site usa do unpkg.com.
const LEAFLET_DESTINO = path.join(DESTINO, 'vendor', 'leaflet');
const LEAFLET_FICHEIROS = [
  ['leaflet/dist/leaflet.css', 'leaflet.css'],
  ['leaflet/dist/leaflet.js', 'leaflet.js'],
  ['leaflet/dist/images', 'images'],
  ['leaflet.markercluster/dist/MarkerCluster.css', 'MarkerCluster.css'],
  ['leaflet.markercluster/dist/leaflet.markercluster.js', 'leaflet.markercluster.js'],
];
for (const [origem, destino] of LEAFLET_FICHEIROS) {
  const de = path.join(RAIZ, 'node_modules', origem);
  if (!fs.existsSync(de)) {
    console.error(`Falta ${origem}. Corre primeiro "npm install".`);
    process.exit(1);
  }
  fs.cpSync(de, path.join(LEAFLET_DESTINO, destino), { recursive: true });
}

// index.html: tira o Vercel Web Analytics, que só existe no site publicado (na app daria erro 404)
let html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
html = html.replace(/[ \t]*<!-- Vercel Web Analytics[^\n]*\n[ \t]*<script[^>]*\/_vercel\/insights\/[^>]*><\/script>\r?\n/, '');
if (html.includes('/_vercel/insights/')) {
  console.error('Não consegui tirar o Vercel Web Analytics do index.html (o texto mudou?). Revê scripts/app-copiar.js.');
  process.exit(1);
}
fs.writeFileSync(path.join(DESTINO, 'index.html'), html);

// garantia: nada dos protótipos dentro da app
if (fs.existsSync(path.join(DESTINO, 'prototipos'))) {
  console.error('A pasta prototipos/ foi parar a www/. Revê scripts/app-copiar.js.');
  process.exit(1);
}

console.log('Site copiado para www/. A seguir: npx cap sync ios');
