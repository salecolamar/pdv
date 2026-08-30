// CSV puro (sem dependência) — abre direto no Excel/Sheets. Escapa aspas e
// só coloca aspas em campos que precisam (têm vírgula, aspas ou quebra de linha).
function campoCsv(valor) {
  const texto = String(valor ?? '');
  if (/[",\n]/.test(texto)) return '"' + texto.replace(/"/g, '""') + '"';
  return texto;
}

export function baixarCsv(nomeArquivo, cabecalho, linhas) {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
