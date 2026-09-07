// Desenha o mesmo "layout de linhas" já usado pela impressora térmica
// (ver ticketRodada em impressora.js) como uma imagem PNG — é o formato
// que a impressora da maquininha PagBank aceita (printImageBluetooth só
// imprime imagem, não manda texto formatado direto), e também serve pra
// mostrar uma pré-visualização de como o ticket vai sair impresso.
import { tamanhoFontePx } from './impressaoConfig.js';

const LARGURA_PADRAO = 384; // pixels — impressora térmica de 58mm típica
const MARGEM = 12;
const ESPACO_ENTRE_ITENS = 10; // px extra antes de cada produto — separa um item do outro

// O "produto" é a linha que a cozinha não pode ler errado — sai bem
// maior e sempre em negrito. "categoria" é só uma referência de seção,
// então fica pequena. O resto (título, complemento, observação) usa o
// tamanho normal escolhido em Layout do ticket.
function estiloDaLinha(linha, tamanhoPxBase) {
  if (linha.estilo === 'produto') return { px: Math.round(tamanhoPxBase * 1.35), negrito: true };
  if (linha.estilo === 'categoria') return { px: Math.round(tamanhoPxBase * 0.7), negrito: !!linha.negrito };
  return { px: tamanhoPxBase, negrito: !!linha.negrito };
}

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

function fonteCss(px, negrito) {
  return `${negrito ? 'bold ' : ''}${px}px monospace`;
}

export function ticketComoPngBase64(linhas, largura = LARGURA_PADRAO, tamanhoFonte = 'media') {
  const tamanhoPxBase = tamanhoFontePx(tamanhoFonte);
  const larguraUtil = largura - MARGEM * 2;
  const canvasMedidor = document.createElement('canvas');
  const ctxMedidor = canvasMedidor.getContext('2d');

  // Primeira passada: descobre quantas linhas de imagem cada linha de
  // texto ocupa depois de quebrada, e a altura de cada uma (varia por
  // estilo) — a altura total do canvas depende disso, e canvas não
  // redimensiona depois de já ter desenhado.
  const linhasParaDesenhar = [];
  for (const linha of linhas) {
    const { px, negrito } = estiloDaLinha(linha, tamanhoPxBase);
    ctxMedidor.font = fonteCss(px, negrito);
    const texto = String(linha.texto ?? '');
    const partes = ctxMedidor.measureText(texto).width > larguraUtil ? quebrarLinha(ctxMedidor, texto, larguraUtil) : [texto];
    partes.forEach((parte, idx) => {
      linhasParaDesenhar.push({
        ...linha,
        texto: parte,
        _px: px,
        _negrito: negrito,
        _alturaLinha: Math.round(px * 1.35),
        _espacoAntes: idx === 0 && linha.estilo === 'produto' ? ESPACO_ENTRE_ITENS : 0,
      });
    });
  }

  const canvas = document.createElement('canvas');
  const alturaTotal =
    linhasParaDesenhar.reduce((soma, l) => soma + l._alturaLinha + l._espacoAntes, 0) + MARGEM * 2;
  canvas.width = largura;
  canvas.height = alturaTotal;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, largura, alturaTotal);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  let y = MARGEM;
  for (const linha of linhasParaDesenhar) {
    y += linha._espacoAntes;
    ctx.font = fonteCss(linha._px, linha._negrito);
    const larguraTexto = ctx.measureText(linha.texto).width;
    let x = MARGEM;
    if (linha.centralizado) x = Math.max(MARGEM, (largura - larguraTexto) / 2);
    ctx.fillText(linha.texto, x, y);
    y += linha._alturaLinha;
  }

  return canvas.toDataURL('image/png').split(',')[1];
}
