const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function money(n) {
  return fmt.format(n || 0);
}

export function metodoLabel(m) {
  return { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', outro: 'Outro' }[m] || m;
}

// Máscaras leves pra input de texto comum (não usam libs externas) —
// sempre a partir dos dígitos puros, então funcionam mesmo se o usuário
// apagar no meio ou colar o valor já formatado.
export function mascararTelefone(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`));
  if (d.length > 6) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`));
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,4})/, (_, a, b) => `(${a}) ${b}`);
  if (d.length > 0) return `(${d}`;
  return d;
}

export function mascararCpf(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascararDataBr(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2');
}

// "15/03/1995" -> "1995-03-15" (formato aceito pela coluna date do banco).
// Retorna null se a data ainda não está completa/válida.
export function dataBrParaIso(dataBr) {
  const m = (dataBr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  return `${ano}-${mes}-${dia}`;
}
