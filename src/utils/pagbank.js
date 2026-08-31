// Ponte com a maquininha PagBank (PlugPag), via plugin nativo do Capacitor
// (android/app/src/main/java/br/com/appvia/pdv/PagBankPlugin.java).
//
// Só funciona quando o app está rodando DENTRO do terminal Moderninha
// Smart, empacotado como app Android — no navegador comum (dev, produção
// web) essas funções simplesmente não existem, então tratamos isso como
// "pagamento pela maquininha indisponível aqui".
import { registerPlugin } from '@capacitor/core';

const PagBank = registerPlugin('PagBank');

export function suportaPagamentoPagBank() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

export async function ativarMaquininha() {
  return PagBank.activate();
}

// valor em reais (ex: 45.90); tipo: 'credito' | 'debito' | 'voucher'
export async function pagarNaMaquininha(valor, tipo = 'credito') {
  const valorCentavos = Math.round(Number(valor) * 100);
  return PagBank.pay({ valorCentavos, tipo });
}

export async function cancelarPagamentoMaquininha(transacaoId) {
  return PagBank.cancel({ transacaoId });
}
