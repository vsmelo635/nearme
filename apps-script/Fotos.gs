/**
 * Nearme — Adicionar foto a um evento (menu "Nearme" na planilha)
 *
 * Onde colar: na planilha, Extensões → Apps Script → "+" ao lado de Arquivos → Script → nome "Fotos".
 * Cole este código todo, salve e recarregue a planilha. Aparece o menu "Nearme" no topo.
 *
 * Como usar: clicar numa célula da linha do evento (aba Eventos) → Nearme → Adicionar foto ao evento.
 * A foto é reduzida (máx. 1600 px), guardada na pasta "Nearme - Fotos dos eventos" do Drive,
 * partilhada como "qualquer pessoa com o link" e o link vai sozinho para a coluna imagem_url.
 */

const ABA_EVENTOS = 'Eventos';
const COLUNA_IMAGEM = 'imagem_url';
const PASTA_FOTOS = 'Nearme - Fotos dos eventos';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Nearme')
    .addItem('Adicionar foto ao evento', 'abrirFoto')
    .addToUi();
}

function abrirFoto() {
  const ui = SpreadsheetApp.getUi();
  const aba = SpreadsheetApp.getActiveSheet();
  const linha = aba.getActiveCell().getRow();

  if (aba.getName() !== ABA_EVENTOS || linha < 2) {
    ui.alert('Clica primeiro numa célula da linha do evento, na aba "' + ABA_EVENTOS + '".');
    return;
  }

  const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  const colNome = cabecalho.indexOf('nome') + 1;
  const nomeEvento = colNome ? String(aba.getRange(linha, colNome).getValue() || '') : '';
  if (!nomeEvento) {
    ui.alert('Esta linha ainda não tem o nome do evento. Preenche o nome primeiro.');
    return;
  }

  const modelo = HtmlService.createTemplate(JANELA_HTML);
  modelo.linha = linha;
  modelo.nomeEvento = nomeEvento;
  const janela = modelo.evaluate().setWidth(420).setHeight(430);
  ui.showModalDialog(janela, 'Adicionar foto');
}

/** Recebe a foto (já reduzida) da janela, guarda no Drive e escreve o link na planilha. */
function guardarFoto(base64, tipo, nomeArquivo, linha) {
  const aba = SpreadsheetApp.getActive().getSheetByName(ABA_EVENTOS);
  const cabecalho = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  const coluna = cabecalho.indexOf(COLUNA_IMAGEM) + 1;
  if (!coluna) throw new Error('Não encontrei a coluna "' + COLUNA_IMAGEM + '" na aba ' + ABA_EVENTOS + '.');

  const pastas = DriveApp.getFoldersByName(PASTA_FOTOS);
  const pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(PASTA_FOTOS);

  const blob = Utilities.newBlob(Utilities.base64Decode(base64), tipo, nomeArquivo);
  const arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const link = 'https://lh3.googleusercontent.com/d/' + arquivo.getId();
  aba.getRange(linha, coluna).setValue(link);
  return link;
}

/* Janela que abre na planilha (HTML + JavaScript que corre no navegador) */
const JANELA_HTML = `
<!DOCTYPE html>
<html>
<head>
<base target="_top">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #202124; }
  p { margin: 0 0 12px; font-size: 14px; }
  .evento { font-weight: bold; }
  label.escolher {
    display: block; padding: 18px; border: 2px dashed #FF6A13; border-radius: 12px;
    text-align: center; cursor: pointer; color: #F04A0C; font-weight: bold;
  }
  input[type=file] { display: none; }
  #previa { display: none; width: 100%; height: 180px; object-fit: cover; border-radius: 12px; margin-top: 12px; }
  button {
    margin-top: 14px; width: 100%; padding: 12px; border: 0; border-radius: 999px;
    background: #FF6A13; color: #fff; font-size: 15px; font-weight: bold; cursor: pointer;
  }
  button:disabled { background: #ccc; cursor: default; }
  #estado { margin-top: 10px; font-size: 13px; min-height: 18px; text-align: center; }
  .erro { color: #d93025; } .ok { color: #188038; }
</style>
</head>
<body>
  <p>Foto para: <span class="evento"><?= nomeEvento ?></span></p>
  <label class="escolher">Escolher foto do computador
    <input type="file" id="arquivo" accept="image/*">
  </label>
  <img id="previa" alt="">
  <button id="enviar" disabled>Guardar foto</button>
  <div id="estado"></div>

<script>
  const LINHA = <?= linha ?>;
  const LADO_MAX = 1600;   // reduz fotos grandes: o site abre mais rápido
  let fotoBase64 = null;

  const campo = document.getElementById('arquivo');
  const previa = document.getElementById('previa');
  const botao = document.getElementById('enviar');
  const estado = document.getElementById('estado');

  function mostrar(texto, tipo) { estado.textContent = texto; estado.className = tipo || ''; }

  campo.addEventListener('change', () => {
    const arquivo = campo.files[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { mostrar('Escolhe um arquivo de imagem (JPG, PNG…).', 'erro'); return; }
    mostrar('A preparar a foto…');
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
      const tela = document.createElement('canvas');
      tela.width = Math.round(img.width * escala);
      tela.height = Math.round(img.height * escala);
      const ctx = tela.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tela.width, tela.height);
      ctx.drawImage(img, 0, 0, tela.width, tela.height);
      const dataUrl = tela.toDataURL('image/jpeg', 0.85);
      fotoBase64 = dataUrl.split(',')[1];
      previa.src = dataUrl;
      previa.style.display = 'block';
      botao.disabled = false;
      mostrar('');
    };
    img.onerror = () => mostrar('Não consegui abrir esta imagem. Tenta outra.', 'erro');
    img.src = URL.createObjectURL(arquivo);
  });

  botao.addEventListener('click', () => {
    if (!fotoBase64) return;
    botao.disabled = true;
    mostrar('A guardar…');
    const nome = 'evento-linha-' + LINHA + '-' + Date.now() + '.jpg';
    google.script.run
      .withSuccessHandler(() => {
        mostrar('Foto guardada! O site mostra-a em até 5 minutos.', 'ok');
        setTimeout(() => google.script.host.close(), 1800);
      })
      .withFailureHandler(erro => {
        mostrar('Erro: ' + erro.message, 'erro');
        botao.disabled = false;
      })
      .guardarFoto(fotoBase64, 'image/jpeg', nome, LINHA);
  });
</script>
</body>
</html>`;
