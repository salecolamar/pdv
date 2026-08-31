package br.com.appvia.pdv;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte entre o app (JS/React) e o SDK PlugPag da PagBank, que roda dentro do
 * terminal Moderninha Smart. Isso É UM ESQUELETO — os métodos ainda não
 * chamam o SDK de verdade porque:
 *
 *   1. A biblioteca PlugPag (br.com.uol.pagseguro.client:plugpag) é
 *      distribuída pela PagBank só pra quem já está homologado — não dá
 *      pra baixar/testar sem credencial de parceiro.
 *   2. Só funciona rodando FISICAMENTE dentro de um terminal Moderninha
 *      Smart — não dá pra testar num emulador ou celular comum.
 *
 * Assim que tivermos acesso ao portal de desenvolvedor da PagBank (depois
 * do cadastro no Partner Program), os TODOs abaixo viram chamadas reais
 * pra classe PlugPag deles. A forma de chamar do lado do app (JS) já fica
 * pronta e não muda — só o que acontece aqui dentro.
 */
@CapacitorPlugin(name = "PagBank")
public class PagBankPlugin extends Plugin {

  // TODO: quando a dependência estiver disponível, criar a instância real:
  // private PlugPag plugPag;
  // @Override
  // public void load() {
  //   plugPag = new PlugPag(getContext(), new PlugPagAppIdentification("AppVia PDV", "1.0"));
  // }

  @PluginMethod
  public void activate(PluginCall call) {
    // TODO: chamar plugPag.initializeAndActivatePinpad(new PlugPagActivationData(stoneCode))
    // (o "código do estabelecimento" da PagBank, equivalente ao Stone Code).
    call.reject("PlugPag ainda não está ligado — falta a dependência oficial da PagBank (pós-homologação).");
  }

  @PluginMethod
  public void pay(PluginCall call) {
    Integer valorCentavos = call.getInt("valorCentavos");
    String tipo = call.getString("tipo", "credito"); // credito | debito | voucher
    if (valorCentavos == null || valorCentavos <= 0) {
      call.reject("Informe valorCentavos (inteiro, em centavos).");
      return;
    }

    // TODO:
    // int tipoTransacao = "debito".equals(tipo) ? PlugPag.DEBIT
    //     : "voucher".equals(tipo) ? PlugPag.VOUCHER : PlugPag.CREDIT;
    // PlugPagPaymentData dados = new PlugPagPaymentData(
    //     tipoTransacao, valorCentavos, PlugPag.A_VISTA, null, null, null);
    // PlugPagTransactionResult resultado = plugPag.doPayment(dados);
    // JSObject resposta = new JSObject();
    // resposta.put("sucesso", resultado.getResult() == PlugPag.RET_OK);
    // resposta.put("transacaoId", resultado.getTransactionCode());
    // resposta.put("mensagem", resultado.getMessage());
    // call.resolve(resposta);

    call.reject("PlugPag ainda não está ligado — falta a dependência oficial da PagBank (pós-homologação).");
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    String transacaoId = call.getString("transacaoId");
    if (transacaoId == null || transacaoId.isEmpty()) {
      call.reject("Informe transacaoId.");
      return;
    }

    // TODO: plugPag.voidPayment(new PlugPagVoidData(transacaoId, ...));
    call.reject("PlugPag ainda não está ligado — falta a dependência oficial da PagBank (pós-homologação).");
  }
}
