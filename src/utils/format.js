const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function money(n) {
  return fmt.format(n || 0);
}

export function metodoLabel(m) {
  return { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', outro: 'Outro' }[m] || m;
}
