// Configurações de como o ticket sai impresso — valem pros dois canais
// (impressora térmica e maquininha), já que os dois desenham o mesmo
// conteúdo, só muda o jeito de mandar pra impressora física.
const CHAVE_CONFIG = 'pdv_impressao_config';

const PADRAO = {
  mostrarCliente: true,
  mostrarOperador: true,
  agruparCategoria: true,
  tamanhoFonte: 'media', // 'pequena' | 'media' | 'grande'
  larguraPapel: 58, // 58 | 80 (mm)
};

export function obterConfigImpressao() {
  try {
    const bruto = localStorage.getItem(CHAVE_CONFIG);
    return bruto ? { ...PADRAO, ...JSON.parse(bruto) } : { ...PADRAO };
  } catch {
    return { ...PADRAO };
  }
}

export function salvarConfigImpressao(config) {
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
}

// px por mm aproximado pra impressora térmica (203dpi é o padrão da
// maioria — 8 pontos/mm), usado pra gerar a imagem da maquininha.
export function larguraEmPixels(larguraPapel) {
  return larguraPapel === 80 ? 576 : 384;
}

export function tamanhoFontePx(tamanhoFonte) {
  if (tamanhoFonte === 'pequena') return 18;
  if (tamanhoFonte === 'grande') return 28;
  return 22;
}

// Fator de escala do ESC/POS (GS ! n) — 0x00 normal, 0x11 dobro de
// largura+altura. É "tudo ou nada" no protocolo (não tem meio-termo),
// então "pequena" e "média" imprimem no tamanho normal da impressora e
// só "grande" dobra.
export function escalaEscPos(tamanhoFonte) {
  return tamanhoFonte === 'grande' ? 0x11 : 0x00;
}
