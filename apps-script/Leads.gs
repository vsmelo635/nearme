/**
 * Nearme — recebe os leads do site (formulários "Novidades" e "Divulgar")
 * e grava-os na planilha PRIVADA "Nearme — Leads" (separada da planilha de eventos, que é publicada).
 *
 * Como instalar:
 *   1. Cria a planilha "Nearme — Leads" no Google Drive (NÃO a publiques na web).
 *   2. Copia o ID dela (o pedaço do link entre /d/ e /edit) e cola em LEADS_PLANILHA_ID, logo abaixo.
 *   3. No Apps Script da planilha de eventos, substitui o código antigo do doPost por este arquivo.
 *   4. Corre uma vez a função copiarLeadsAntigos() para trazer os leads da aba "Leads" antiga.
 *   5. Implementar → Gerir implementações → editar → Versão: "Nova versão" → Implementar.
 *      (Assim o link do site, LEADS_URL em js/app.js, continua igual.)
 */

// ID da planilha "Nearme — Leads" (ex.: 1AbCdEf...). Ver o passo 2 acima.
const LEADS_PLANILHA_ID = '1p9j5dPJWNVLESewcgHA3ds7VfvzZQGLBf2i4zOL62W0';
const LEADS_ABA = 'Leads';

// Ordem das colunas na planilha nova. As 5 primeiras servem para os dois formulários;
// as outras só vêm do formulário de organizadores (telefone, nome do espaço, link).
const LEADS_COLUNAS = ['nome', 'email', 'cidade', 'tipo', 'data_cadastro',
                       'telefone', 'local_nome', 'link', 'consentimento'];

const LIMITE_CARACTERES = 200;   // cada campo é cortado neste tamanho
const LIMITE_ENVIOS_HORA = 5;    // envios do mesmo e-mail por hora
const EMAIL_VALIDO = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i;

/* Quem abre o link no navegador só vê isto: nenhum lead é devolvido. */
function doGet() {
  return resposta({ ok: true, status: 'online' });
}

/* O site envia aqui cada formulário. Respostas:
   {ok:true}                  → gravou (ou era um robô, que ignoramos em silêncio)
   {ok:false, erro:'email'}   → e-mail inválido (o site avisa a pessoa e não volta a tentar)
   {ok:false, erro:'limite'}  → mais de 5 envios deste e-mail na última hora
   {ok:false}                 → falha nossa (o site guarda o lead e volta a tentar depois) */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Campo armadilha: as pessoas não o veem, por isso só um robô o preenche.
    // Respondemos "ok" para o robô não perceber que foi apanhado.
    if (p._gotcha || p.website) return resposta({ ok: true });

    const lead = limparLead(p);
    if (!EMAIL_VALIDO.test(lead.email)) return resposta({ ok: false, erro: 'email' });
    if (excedeuLimite(lead.email)) return resposta({ ok: false, erro: 'limite' });

    gravarLead(lead);
    return resposta({ ok: true });
  } catch (erro) {
    console.error('Erro ao gravar lead:', erro);
    return resposta({ ok: false });
  }
}

/* Fica só com as colunas conhecidas, tira espaços, corta em 200 caracteres
   e usa a hora do Google (não a do telemóvel da pessoa). */
function limparLead(p) {
  const lead = {};
  LEADS_COLUNAS.forEach(function (coluna) {
    lead[coluna] = String(p[coluna] || '').trim().slice(0, LIMITE_CARACTERES);
  });
  lead.email = lead.email.toLowerCase();
  if (lead.tipo !== 'utilizador' && lead.tipo !== 'organizador') lead.tipo = 'outro';
  lead.data_cadastro = new Date();
  return lead;
}

/* Um texto que começa com = + - ou @ seria lido pela planilha como fórmula.
   O apóstrofo à frente obriga a planilha a tratá-lo como texto (e não aparece na célula). */
function semFormula(valor) {
  return typeof valor === 'string' && /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}

/* Conta os envios de cada e-mail na memória temporária do Google (CacheService).
   A contagem apaga-se sozinha 1 hora depois do último envio. */
function excedeuLimite(email) {
  const cache = CacheService.getScriptCache();
  const chave = 'envios:' + email;
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    const envios = Number(cache.get(chave) || 0);
    if (envios >= LIMITE_ENVIOS_HORA) return true;
    cache.put(chave, String(envios + 1), 60 * 60);
    return false;
  } finally {
    trava.releaseLock();
  }
}

function gravarLead(lead) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    abaLeads().appendRow(LEADS_COLUNAS.map(function (coluna) { return semFormula(lead[coluna]); }));
  } finally {
    trava.releaseLock();
  }
}

/* Abre a aba "Leads" da planilha privada. Se estiver vazia, escreve os títulos das colunas. */
function abaLeads() {
  if (!LEADS_PLANILHA_ID || LEADS_PLANILHA_ID.indexOf('COLE_AQUI') === 0) {
    throw new Error('Falta colar o ID da planilha "Nearme — Leads" em LEADS_PLANILHA_ID.');
  }
  const planilha = SpreadsheetApp.openById(LEADS_PLANILHA_ID);
  const aba = planilha.getSheetByName(LEADS_ABA) || planilha.getSheets()[0];
  if (aba.getLastRow() === 0) aba.appendRow(LEADS_COLUNAS);
  return aba;
}

function resposta(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Corre UMA vez, no editor do Apps Script: copia os leads da aba "Leads" da planilha de eventos
   para a planilha nova. As colunas são encontradas pelo título (nome, email, cidade...).
   Não faz nada se a planilha nova já tiver leads, para não duplicar. */
function copiarLeadsAntigos() {
  const antiga = SpreadsheetApp.getActive().getSheetByName('Leads');
  if (!antiga) throw new Error('Não encontrei a aba "Leads" na planilha de eventos.');

  const destino = abaLeads();
  if (destino.getLastRow() > 1) {
    throw new Error('A planilha nova já tem leads. Para não duplicar, não copiei nada.');
  }

  const linhas = antiga.getDataRange().getValues();
  const titulos = linhas.shift().map(function (t) { return String(t).trim().toLowerCase(); });
  const posicao = {};
  LEADS_COLUNAS.forEach(function (coluna) { posicao[coluna] = titulos.indexOf(coluna); });

  const ignoradas = titulos.filter(function (t) { return t && LEADS_COLUNAS.indexOf(t) === -1; });
  if (ignoradas.length) console.warn('Colunas da aba antiga que NÃO foram copiadas: ' + ignoradas.join(', '));

  const novas = linhas
    .filter(function (linha) { return linha.join('') !== ''; })     // salta linhas vazias
    .map(function (linha) {
      return LEADS_COLUNAS.map(function (coluna) {
        const valor = posicao[coluna] === -1 ? '' : linha[posicao[coluna]];
        return typeof valor === 'string' ? semFormula(valor.trim().slice(0, LIMITE_CARACTERES)) : valor;
      });
    });

  if (novas.length) {
    destino.getRange(2, 1, novas.length, LEADS_COLUNAS.length).setValues(novas);
  }
  console.log('Copiei ' + novas.length + ' leads para a planilha "Nearme — Leads".');
}
