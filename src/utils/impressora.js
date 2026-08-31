// Impressão térmica via Bluetooth (Web Bluetooth), sem precisar de
// computador nenhum: o navegador fala direto com a impressora a partir do
// tablet/celular Android que fica parado do lado dela na cozinha.
//
// Só funciona no Chrome/Edge Android ou desktop — Safari/iOS não implementa
// Web Bluetooth. A impressora precisa ser pareada uma vez (toque manual,
// exigência do navegador); depois disso o app reconecta sozinho.
//
// Impressoras térmicas baratas ("clone" 58mm) variam no service/característica
// Bluetooth que expõem. Tentamos, em ordem, os UUIDs mais comuns nesse tipo de
// aparelho (módulo serial HM-10/BLE genérico e o perfil de impressora mais
// usado pelos clones chineses).
const CANDIDATOS = [
  { servico: '000018f0-0000-1000-8000-00805f9b34fb', caracteristica: '00002af1-0000-1000-8000-00805f9b34fb' },
  { servico: '0000ffe0-0000-1000-8000-00805f9b34fb', caracteristica: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { servico: '49535343-fe7d-4ae5-8fa9-9fafd205e455', caracteristica: '49535343-1e4d-4bd9-ba61-23c647249616' },
];

const CHAVE_STORAGE = 'pdv_impressora_bluetooth_id';

let caracteristicaCache = null;

export function suportaImpressaoBluetooth() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export function impressoraConfigurada() {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem(CHAVE_STORAGE);
}

export function esquecerImpressora() {
  localStorage.removeItem(CHAVE_STORAGE);
  caracteristicaCache = null;
}

export async function parearImpressora() {
  const dispositivo = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATOS.map((c) => c.servico),
  });
  localStorage.setItem(CHAVE_STORAGE, dispositivo.id);
  caracteristicaCache = null;
  // Conecta já de cara pra confirmar que o dispositivo escolhido realmente
  // serve pra imprimir (acha um dos serviços candidatos).
  await obterCaracteristica(dispositivo);
  return dispositivo;
}

async function encontrarDispositivoPareado() {
  const id = localStorage.getItem(CHAVE_STORAGE);
  if (!id) throw new Error('Nenhuma impressora pareada ainda.');
  const dispositivos = await navigator.bluetooth.getDevices();
  const dispositivo = dispositivos.find((d) => d.id === id);
  if (!dispositivo) throw new Error('Impressora pareada não encontrada neste navegador. Pareie de novo.');
  return dispositivo;
}

async function obterCaracteristica(dispositivoJaEscolhido) {
  if (caracteristicaCache) return caracteristicaCache;

  const dispositivo = dispositivoJaEscolhido || (await encontrarDispositivoPareado());
  const servidor = await dispositivo.gatt.connect();

  for (const candidato of CANDIDATOS) {
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

function montarComandos(linhas) {
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

const TAMANHO_PACOTE = 180; // limite comum de MTU do Bluetooth de baixa energia

export async function imprimirTexto(linhas) {
  const caracteristica = await obterCaracteristica();
  const dados = montarComandos(linhas);
  for (let i = 0; i < dados.length; i += TAMANHO_PACOTE) {
    const pedaco = dados.slice(i, i + TAMANHO_PACOTE).buffer;
    if (caracteristica.properties?.writeWithoutResponse) {
      await caracteristica.writeValueWithoutResponse(pedaco);
    } else {
      await caracteristica.writeValue(pedaco);
    }
  }
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
