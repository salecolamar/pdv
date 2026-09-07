// Desenha o mesmo "layout de linhas" já usado pela impressora térmica
// (ver ticketRodada em impressora.js) como uma imagem PNG — é o formato
// que a impressora da maquininha PagBank aceita (printImageBluetooth só
// imprime imagem, não manda texto formatado direto).
const LARGURA_PADRAO = 384; // pixels — impressora térmica de 58mm típica
const FONTE = '22px monospace';
const FONTE_NEGRITO = 'bold 22px monospace';
const ALTURA_LINHA = 30;
const MARGEM = 12;

// Quebra uma linha longa em várias, palavra por palavra, pra nunca
// estourar a largura do papel (senão o texto sai cortado na imagem).
function quebrarLinha(ctx, texto, larguraMaxima) {
  const palavras = texto.split(' ');
  const linhasQuebradas = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? atual + ' ' + palavra : palavra;
    if (ctx.measureText(tentativa).width > larguraMaxima && atual) {
      linhasQuebradas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhasQuebradas.push(atual);
  return linhasQuebradas;
}

export function ticketComoPngBase64(linhas, largura = LARGURA_PADRAO) {
  const larguraUtil = largura - MARGEM * 2;
  const canvasMedidor = document.createElement('canvas');
  const ctxMedidor = canvasMedidor.getContext('2d');

  // Primeira passada: só pra saber quantas linhas de imagem cada linha de
  // texto vai ocupar depois de quebrada (a altura do canvas final depende
  // disso, e canvas não redimensiona depois de já ter desenhado).
  const linhasParaDesenhar = [];
  for (const linha of linhas) {
    ctxMedidor.font = linha.negrito ? FONTE_NEGRITO : FONTE;
    const texto = String(linha.texto ?? '');
    const partes = ctxMedidor.measureText(texto).width > larguraUtil ? quebrarLinha(ctxMedidor, texto, larguraUtil) : [texto];
    for (const parte of partes) {
      linhasParaDesenhar.push({ ...linha, texto: parte });
    }
  }

  const canvas = document.createElement('canvas');
  const alturaTotal = linhasParaDesenhar.length * ALTURA_LINHA + MARGEM * 2;
  canvas.width = largura;
  canvas.height = alturaTotal;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, largura, alturaTotal);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  let y = MARGEM;
  for (const linha of linhasParaDesenhar) {
    ctx.font = linha.negrito ? FONTE_NEGRITO : FONTE;
    const larguraTexto = ctx.measureText(linha.texto).width;
    let x = MARGEM;
    if (linha.centralizado) x = Math.max(MARGEM, (largura - larguraTexto) / 2);
    ctx.fillText(linha.texto, x, y);
    y += ALTURA_LINHA;
  }

  return canvas.toDataURL('image/png').split(',')[1];
}
