// Impressão térmica sem precisar de computador — o navegador fala direto
// com a impressora a partir do tablet/celular que fica parado do lado dela
// na cozinha. Dois modos:
//
// - Bluetooth (Web Bluetooth): funciona em qualquer impressora BLE barata,
//   só precisa parear uma vez (toque manual, exigência do navegador).
// - Wi-Fi (ePOS-Print): protocolo HTTP aberto usado pela Epson e por vários
//   clones compatíveis — o app manda a impressão pro IP da impressora na
//   rede local. IMPORTANTE: como este site roda em HTTPS, o navegador
//   bloqueia por padrão chamadas pra endereços http:// da rede local
//   ("mixed content" — não é algo que dá pra contornar no código). Pra
//   funcionar, o Chrome do aparelho fixo na cozinha precisa marcar o IP da
//   impressora como "origem segura" uma vez:
//   chrome://flags/#unsafely-treat-insecure-origin-as-secure
//   → cola http://IP_DA_IMPRESSORA → Enabled → reinicia o Chrome.
//
// Nenhum dos dois modos funciona no Safari/iOS (não implementa Web
// Bluetooth nem permite esse tipo de exceção de rede).
//
// - Maquininha (PagBank/PlugPag): reaproveita a conexão Bluetooth já feita
//   pra pagamento — imprime como imagem, já que o SDK não aceita texto.
import { ticketComoPngBase64 } from './ticketImagem.js';
import { imprimirImagemNaMaquininha } from './pagbank.js';
import { escalaEscPos, larguraEmPixels, obterConfigImpressao } from './impressaoConfig.js';

const CANDIDATOS_BLUETOOTH = [
  { servico: '000018f0-0000-1000-8000-00805f9b34fb', caracteristica: '00002af1-0000-1000-8000-00805f9b34fb' },
  { servico: '0000ffe0-0000-1000-8000-00805f9b34fb', caracteristica: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { servico: '49535343-fe7d-4ae5-8fa9-9fafd205e455', caracteristica: '49535343-1e4d-4bd9-ba61-23c647249616' },
];

const CHAVE_MODO = 'pdv_impressora_modo'; // 'bluetooth' | 'wifi' | 'pagbank'
const CHAVE_BLUETOOTH_ID = 'pdv_impressora_bluetooth_id';
const CHAVE_WIFI_IP = 'pdv_impressora_wifi_ip';
const CHAVE_PAGBANK_DISPOSITIVO = 'pdv_pagbank_dispositivo'; // mesma chave de utils/pagbank.js

let caracteristicaCache = null;

export function suportaImpressaoBluetooth() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export function obterModo() {
  return localStorage.getItem(CHAVE_MODO) || 'bluetooth';
}

export function impressoraConfigurada() {
  if (typeof localStorage === 'undefined') return false;
  const modo = obterModo();
  if (modo === 'wifi') return !!localStorage.getItem(CHAVE_WIFI_IP);
  if (modo === 'pagbank') return !!localStorage.getItem(CHAVE_PAGBANK_DISPOSITIVO);
  return !!localStorage.getItem(CHAVE_BLUETOOTH_ID);
}

// Usa a maquininha PagBank já conectada (configurada em Mapa de Mesas →
// Testar maquininha) como impressora — não precisa parear de novo, o
// SDK já está autenticado com o terminal.
export function usarImpressoraPagBank() {
  if (!localStorage.getItem(CHAVE_PAGBANK_DISPOSITIVO)) {
    throw new Error('Conecte a maquininha primeiro em Mapa de Mesas → Testar maquininha PagBank.');
  }
  localStorage.setItem(CHAVE_MODO, 'pagbank');
}

export function esquecerImpressora() {
  localStorage.removeItem(CHAVE_BLUETOOTH_ID);
  localStorage.removeItem(CHAVE_WIFI_IP);
  caracteristicaCache = null;
}

// --- Bluetooth ---------------------------------------------------------

export async function parearImpressoraBluetooth() {
  const dispositivo = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATOS_BLUETOOTH.map((c) => c.servico),
  });
  localStorage.setItem(CHAVE_MODO, 'bluetooth');
  localStorage.setItem(CHAVE_BLUETOOTH_ID, dispositivo.id);
  caracteristicaCache = null;
  // Conecta já de cara pra confirmar que o dispositivo escolhido realmente
  // serve pra imprimir (acha um dos serviços candidatos).
  await obterCaracteristica(dispositivo);
  return dispositivo;
}

async function encontrarDispositivoPareado() {
  const id = localStorage.getItem(CHAVE_BLUETOOTH_ID);
  if (!id) throw new Error('Nenhuma impressora Bluetooth pareada ainda.');
  const dispositivos = await navigator.bluetooth.getDevices();
  const dispositivo = dispositivos.find((d) => d.id === id);
  if (!dispositivo) throw new Error('Impressora pareada não encontrada neste navegador. Pareie de novo.');
  return dispositivo;
}

async function obterCaracteristica(dispositivoJaEscolhido) {
  if (caracteristicaCache) return caracteristicaCache;

  const dispositivo = dispositivoJaEscolhido || (await encontrarDispositivoPareado());
  const servidor = await dispositivo.gatt.connect();

  for (const candidato of CANDIDATOS_BLUETOOTH) {
    try {
      const servico = await servidor.getPrimaryService(candidato.servico);
      const caracteristica = await servico.getCharacteristic(candidato.caracteristica);
      caracteristicaCache = caracteristica;
      return caracteristica;
    } catch {
      // Esse candidato não bateu com o que a impressora expõe — tenta o próximo.
    }
  }

  throw new Error('Não achei um serviço de impressão compatível nesse aparelho pareado.');
}

const TAMANHO_PACOTE = 180; // limite comum de MTU do Bluetooth de baixa energia

async function imprimirViaBluetooth(dados) {
  const caracteristica = await obterCaracteristica();
  for (let i = 0; i < dados.length; i += TAMANHO_PACOTE) {
    const pedaco = dados.slice(i, i + TAMANHO_PACOTE).buffer;
    if (caracteristica.properties?.writeWithoutResponse) {
      await caracteristica.writeValueWithoutResponse(pedaco);
    } else {
      await caracteristica.writeValue(pedaco);
    }
  }
}

// --- Wi-Fi (ePOS-Print) -------------------------------------------------

export function impressoraWifiIp() {
  return localStorage.getItem(CHAVE_WIFI_IP) || '';
}

export function configurarImpressoraWifi(ip) {
  const limpo = ip.trim();
  if (!limpo) throw new Error('Informe o IP da impressora.');
  localStorage.setItem(CHAVE_MODO, 'wifi');
  localStorage.setItem(CHAVE_WIFI_IP, limpo);
}

function escaparXml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Tamanho de cada linha, em "vezes o normal" (width/height do ePOS-Print
// e multiplicador do GS ! do ESC/POS) — produto sempre destaca mais que o
// resto (é a linha que não pode ser lida errado), categoria fica menor.
function tamanhoLinha(linha, tamanhoFonteGlobal) {
  const dobradoGlobal = tamanhoFonteGlobal === 'grande';
  if (linha.estilo === 'produto') return dobradoGlobal ? 2 : { largura: 1, altura: 2 };
  if (linha.estilo === 'categoria') return 1;
  return dobradoGlobal ? 2 : 1;
}

function montarXmlEpos(linhas) {
  const tamanhoFonte = obterConfigImpressao().tamanhoFonte;
  const comandos = linhas
    .map((linha) => {
      const align = linha.centralizado ? 'center' : 'left';
      const negrito = linha.negrito || linha.estilo === 'produto';
      const atributos = `align="${align}"` + (negrito ? ' lang="en"' : '');
      const peso = negrito ? '<text em="true"/>' : '';
      const fimPeso = negrito ? '<text em="false"/>' : '';
      const tam = tamanhoLinha(linha, tamanhoFonte);
      const { largura, altura } = typeof tam === 'number' ? { largura: tam, altura: tam } : tam;
      const tamanho = `<text width="${largura}" height="${altura}"/>`;
      // "espaco" antes de cada produto (exceto se for a primeira linha do
      // ticket) — separa visualmente um item do outro.
      const espaco = linha.estilo === 'produto' ? '<feed unit="20"/>' : '';
      return `${espaco}<text ${atributos}/>${peso}${tamanho}<text>${escaparXml(semAcento(linha.texto ?? ''))}&#10;</text>${fimPeso}`;
    })
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
 <soap:Body>
  <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
   ${comandos}
   <feed unit="60"/>
   <cut type="feed"/>
  </epos-print>
 </soap:Body>
</soap:Envelope>`;
}

async function imprimirViaWifi(linhas) {
  const ip = impressoraWifiIp();
  if (!ip) throw new Error('Nenhuma impressora Wi-Fi configurada.');

  const resposta = await fetch(`http://${ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
    body: montarXmlEpos(linhas),
  }).catch(() => {
    throw new Error(
      'Não consegui falar com a impressora em ' +
        ip +
        '. Confira o IP, se ela está ligada na mesma rede, e se o Chrome está com a exceção de origem insegura ativada pra esse endereço.'
    );
  });

  if (!resposta.ok) throw new Error('Impressora respondeu com erro (HTTP ' + resposta.status + ').');
}

export async function testarImpressoraWifi(ip) {
  const resposta = await fetch(`http://${ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=5000`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
    body: montarXmlEpos([{ texto: 'Teste de impressao OK', centralizado: true, negrito: true }]),
  }).catch(() => {
    throw new Error('Não consegui conectar em ' + ip + '.');
  });
  if (!resposta.ok) throw new Error('Impressora respondeu com erro (HTTP ' + resposta.status + ').');
}

// --- Comum ---------------------------------------------------------------

function semAcento(texto) {
  return Array.from(String(texto).normalize('NFD'))
    .filter((ch) => {
      const codigo = ch.codePointAt(0);
      return codigo < 0x300 || codigo > 0x36f;
    })
    .join('');
}

const ESC = 0x1b;
const GS = 0x1d;

// GS ! n: bits 4-6 = largura-1, bits 0-2 = altura-1 (0x11 = dobro nos
// dois). Produto sempre imprime maior que o resto (pelo menos altura
// dobrada) — categoria nunca aumenta, fica sempre no tamanho normal.
function escalaEscPosLinha(linha, tamanhoFonte) {
  if (linha.estilo === 'categoria') return 0x00;
  if (linha.estilo === 'produto') return tamanhoFonte === 'grande' ? 0x11 : 0x01;
  return escalaEscPos(tamanhoFonte);
}

function montarComandosEscPos(linhas) {
  const tamanhoFonte = obterConfigImpressao().tamanhoFonte;
  const bytes = [ESC, 0x40]; // inicializa a impressora

  for (const linha of linhas) {
    bytes.push(ESC, 0x61, linha.centralizado ? 1 : 0);
    bytes.push(GS, 0x21, escalaEscPosLinha(linha, tamanhoFonte));
    if (linha.negrito || linha.estilo === 'produto') bytes.push(ESC, 0x45, 1);

    // Espaço extra antes de cada produto — separa um item do outro pra
    // não confundir na hora de montar o pedido.
    if (linha.estilo === 'produto') bytes.push('\n'.charCodeAt(0));

    const texto = semAcento(linha.texto ?? '') + '\n';
    for (let i = 0; i < texto.length; i++) bytes.push(texto.charCodeAt(i) & 0xff);

    if (linha.negrito || linha.estilo === 'produto') bytes.push(ESC, 0x45, 0);
  }

  bytes.push('\n'.charCodeAt(0), '\n'.charCodeAt(0));
  bytes.push(GS, 0x21, 0x00); // volta o tamanho ao normal
  bytes.push(GS, 0x56, 0x42, 0x00); // corta o papel (ignorado silenciosamente por quem não tem guilhotina)
  return new Uint8Array(bytes);
}

async function imprimirViaPagBank(linhas) {
  const config = obterConfigImpressao();
  const imagem = ticketComoPngBase64(linhas, larguraEmPixels(config.larguraPapel), config.tamanhoFonte);
  const resultado = await imprimirImagemNaMaquininha(imagem);
  if (!resultado.sucesso) throw new Error(resultado.mensagem || 'A maquininha não conseguiu imprimir.');
}

export async function imprimirTexto(linhas) {
  const modo = obterModo();
  if (modo === 'wifi') {
    await imprimirViaWifi(linhas);
    return;
  }
  if (modo === 'pagbank') {
    await imprimirViaPagBank(linhas);
    return;
  }
  await imprimirViaBluetooth(montarComandosEscPos(linhas));
}

export function ticketRodada({ tituloMesa, cliente, operador, horario, grupos }) {
  const config = obterConfigImpressao();
  const linhas = [{ texto: tituloMesa, centralizado: true, negrito: true }];

  const mostrarOperador = config.mostrarOperador && operador;
  linhas.push({ texto: horario + (mostrarOperador ? ' - ' + operador : ''), centralizado: true });

  if (config.mostrarCliente && cliente) linhas.push({ texto: 'Cliente: ' + cliente, centralizado: true });
  linhas.push({ texto: '--------------------------------', centralizado: true });

  // "produto" imprime bem maior e em negrito — é a linha que o pessoal da
  // cozinha realmente precisa ler rápido e sem errar; "categoria" é só uma
  // referência, então fica pequena; espaçamento extra entre itens ajuda a
  // não confundir onde um item termina e o outro começa.
  const itensFn = (i) => {
    linhas.push({ texto: `${i.quantidade}x ${i.nome_produto}`, estilo: 'produto' });
    for (const c of i.complementos || []) {
      linhas.push({ texto: `+ ${c.nome}`, estilo: 'detalhe' });
    }
    for (const g of i.observacoes || []) {
      linhas.push({ texto: `${g.titulo}: ${g.opcoes.join(', ')}`, estilo: 'detalhe', negrito: true });
    }
  };

  if (config.agruparCategoria) {
    for (const [categoria, itens] of grupos) {
      linhas.push({ texto: categoria.toUpperCase(), estilo: 'categoria' });
      for (const i of itens) itensFn(i);
    }
  } else {
    for (const [, itens] of grupos) {
      for (const i of itens) itensFn(i);
    }
  }

  return linhas;
}
