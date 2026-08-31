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
const CANDIDATOS_BLUETOOTH = [
  { servico: '000018f0-0000-1000-8000-00805f9b34fb', caracteristica: '00002af1-0000-1000-8000-00805f9b34fb' },
  { servico: '0000ffe0-0000-1000-8000-00805f9b34fb', caracteristica: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { servico: '49535343-fe7d-4ae5-8fa9-9fafd205e455', caracteristica: '49535343-1e4d-4bd9-ba61-23c647249616' },
];

const CHAVE_MODO = 'pdv_impressora_modo'; // 'bluetooth' | 'wifi'
const CHAVE_BLUETOOTH_ID = 'pdv_impressora_bluetooth_id';
const CHAVE_WIFI_IP = 'pdv_impressora_wifi_ip';

let caracteristicaCache = null;

export function suportaImpressaoBluetooth() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export function obterModo() {
  return localStorage.getItem(CHAVE_MODO) || 'bluetooth';
}

export function impressoraConfigurada() {
  if (typeof localStorage === 'undefined') return false;
  return obterModo() === 'wifi' ? !!localStorage.getItem(CHAVE_WIFI_IP) : !!localStorage.getItem(CHAVE_BLUETOOTH_ID);
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

function montarXmlEpos(linhas) {
  const comandos = linhas
    .map((linha) => {
      const align = linha.centralizado ? 'center' : 'left';
      const atributos = `align="${align}"` + (linha.negrito ? ' lang="en"' : '');
      const peso = linha.negrito ? '<text em="true"/>' : '';
      const fimPeso = linha.negrito ? '<text em="false"/>' : '';
      return `<text ${atributos}/>${peso}<text>${escaparXml(semAcento(linha.texto ?? ''))}&#10;</text>${fimPeso}`;
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

function montarComandosEscPos(linhas) {
  const bytes = [ESC, 0x40]; // inicializa a impressora

  for (const linha of linhas) {
    bytes.push(ESC, 0x61, linha.centralizado ? 1 : 0);
    if (linha.negrito) bytes.push(ESC, 0x45, 1);

    const texto = semAcento(linha.texto ?? '') + '\n';
    for (let i = 0; i < texto.length; i++) bytes.push(texto.charCodeAt(i) & 0xff);

    if (linha.negrito) bytes.push(ESC, 0x45, 0);
  }

  bytes.push('\n'.charCodeAt(0), '\n'.charCodeAt(0));
  bytes.push(GS, 0x56, 0x42, 0x00); // corta o papel (ignorado silenciosamente por quem não tem guilhotina)
  return new Uint8Array(bytes);
}

export async function imprimirTexto(linhas) {
  if (obterModo() === 'wifi') {
    await imprimirViaWifi(linhas);
    return;
  }
  await imprimirViaBluetooth(montarComandosEscPos(linhas));
}

export function ticketRodada({ tituloMesa, cliente, operador, horario, grupos }) {
  const linhas = [
    { texto: tituloMesa, centralizado: true, negrito: true },
    { texto: horario + (operador ? ' - ' + operador : ''), centralizado: true },
  ];
  if (cliente) linhas.push({ texto: 'Cliente: ' + cliente, centralizado: true });
  linhas.push({ texto: '--------------------------------', centralizado: true });

  for (const [categoria, itens] of grupos) {
    linhas.push({ texto: categoria.toUpperCase(), negrito: true });
    for (const i of itens) {
      linhas.push({ texto: `${i.quantidade}x ${i.nome_produto}` });
    }
  }

  return linhas;
}
