// Gera o ícone e o ecrã de abertura (splash) da app iOS a partir dos ficheiros de img/marca/.
// Usa-se com "npm run app:icones". Só é preciso correr de novo se o logótipo mudar.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const MARCA = path.join(RAIZ, 'img', 'marca');
const ASSETS = path.join(RAIZ, 'ios', 'App', 'App', 'Assets.xcassets');

async function gerarIcone() {
  // O iPhone arredonda os cantos sozinho e não aceita transparência:
  // usamos o ícone laranja, mas com o quadrado inteiro (sem os cantos redondos do SVG).
  const svg = fs.readFileSync(path.join(MARCA, 'nearme-icone-laranja.svg'), 'utf8')
    .replace(/\s+rx="[\d.]+"/, '');
  await sharp(Buffer.from(svg), { density: 72 * 1024 / 512 })
    .resize(1024, 1024)
    .flatten({ background: '#F04A0C' })
    .png()
    .toFile(path.join(ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'));
}

async function gerarSplash() {
  // Logótipo vertical (para fundo escuro) no meio de um quadrado preto de 2732 px.
  // O iPhone corta as laterais do quadrado, por isso o logótipo fica pequeno e bem ao centro.
  const LADO = 2732;
  const LARGURA_LOGO = 700;
  const logo = await sharp(path.join(MARCA, 'nearme-logo-vertical-escuro.svg'), { density: 72 * LARGURA_LOGO / 520 })
    .resize({ width: LARGURA_LOGO })
    .png()
    .toBuffer();
  const imagem = await sharp({ create: { width: LADO, height: LADO, channels: 3, background: '#000000' } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
  // o projeto do Xcode tem 3 cópias (1x, 2x, 3x) com o mesmo conteúdo
  for (const nome of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    fs.writeFileSync(path.join(ASSETS, 'Splash.imageset', nome), imagem);
  }
}

Promise.all([gerarIcone(), gerarSplash()])
  .then(() => console.log('Ícone e splash da app atualizados em ios/App/App/Assets.xcassets/'))
  .catch(erro => { console.error(erro); process.exit(1); });
