// Acha, entre as promoções ativas aplicáveis a um produto (por id direto ou
// pela categoria dele), a que dá o maior desconto agora — comparando
// dia da semana, horário e período de vigência com o instante informado.
export function promocaoAtiva(produto, promocoes, agora = new Date()) {
  const diaSemana = agora.getDay();
  const hora = agora.toTimeString().slice(0, 8);
  const hoje = agora.toISOString().slice(0, 10);

  const aplicaveis = promocoes.filter((p) => {
    if (!p.ativo) return false;
    if (p.produto_id !== produto.id && p.categoria_id !== produto.categoria_id) return false;
    if (p.dias_semana && !p.dias_semana.includes(diaSemana)) return false;
    if (p.hora_inicio && hora < p.hora_inicio) return false;
    if (p.hora_fim && hora > p.hora_fim) return false;
    if (p.data_inicio && hoje < p.data_inicio) return false;
    if (p.data_fim && hoje > p.data_fim) return false;
    return true;
  });

  let melhor = null;
  let melhorPreco = Number(produto.preco);
  for (const promo of aplicaveis) {
    const preco = promo.tipo === 'percentual' ? Number(produto.preco) * (1 - Number(promo.valor) / 100) : Math.max(0, Number(produto.preco) - Number(promo.valor));
    if (preco < melhorPreco) {
      melhorPreco = preco;
      melhor = promo;
    }
  }
  return melhor ? { promocao: melhor, preco: melhorPreco } : null;
}

// Preço de venda de um produto agora: promoção automática > preço
// promocional manual (produtos.preco_promocional) > preço normal.
export function precoEfetivo(produto, promocoes, agora = new Date()) {
  const promo = promocaoAtiva(produto, promocoes, agora);
  if (promo) return promo.preco;
  return Number(produto.preco_promocional ?? produto.preco);
}
