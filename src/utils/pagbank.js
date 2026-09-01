// Ponte com a Moderninha Pro/Wifi via PlugPag (Bluetooth), pelo plugin
// nativo do Capacitor (android/app/src/main/java/br/com/appvia/pdv/PagBankPlugin.java).
//
// Só funciona quando o app está rodando DENTRO do app Android empacotado
// (Capacitor) — no navegador comum (dev, produção web) essas funções não
// existem, então tratamos isso como "pagamento pela maquininha indisponível
// aqui".
import { registerPlugin } from '@capacitor/core';

const PagBank = registerPlugin('PagBank');

const CHAVE_DISPOSITIVO = 'pdv_pagbank_dispositivo';

export function suportaPagamentoPagBank() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

export function dispositivoSalvo() {
  return localStorage.getItem(CHAVE_DISPOSITIVO) || '';
}

// dispositivo: o código impresso/mostrado na maquininha (ex: "PRO-12345678")
// ou o endereço MAC do Bluetooth já pareado no aparelho.
export async function conectarMaquininha(dispositivo) {
  const resultado = await PagBank.activate({ dispositivo });
  if (resultado.sucesso) localStorage.setItem(CHAVE_DISPOSITIVO, dispositivo);
  return resultado;
}

// valor em reais (ex: 45.90); tipo: 'credito' | 'debito' | 'voucher'
export async function pagarNaMaquininha(valor, tipo = 'credito', referencia = 'VENDA') {
  const valorCentavos = Math.round(Number(valor) * 100);
  return PagBank.pay({ valorCentavos, tipo, referencia });
}

// Estorna a última transação feita no terminal conectado.
export async function estornarUltimaTransacao() {
  return PagBank.cancel();
}
