package br.com.appvia.pdv;

import br.com.uol.pagseguro.plugpag.PlugPag;
import br.com.uol.pagseguro.plugpag.PlugPagAppIdentification;
import br.com.uol.pagseguro.plugpag.PlugPagDevice;
import br.com.uol.pagseguro.plugpag.PlugPagPaymentData;
import br.com.uol.pagseguro.plugpag.PlugPagTransactionResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte entre o app (JS/React) e a Moderninha Pro/Wifi via PlugPag —
 * conexão Bluetooth, sem precisar de homologação (isso só é exigido pro
 * SmartPOS, que roda o app DENTRO da maquininha; aqui é o oposto: o app
 * roda no celular/tablet e só "conversa" por Bluetooth com o terminal).
 *
 * Referência oficial: manual "PlugPag Android Integradores" (PagBank),
 * seção Terminais (Moderninha Pro/Wifi).
 */
@CapacitorPlugin(name = "PagBank")
public class PagBankPlugin extends Plugin {

  private PlugPag plugPag;

  private PlugPag obterInstancia() {
    if (plugPag == null) {
      PlugPagAppIdentification identificacao = new PlugPagAppIdentification("AppVia PDV", "1.0.0");
      plugPag = new PlugPag(getContext(), identificacao);
    }
    return plugPag;
  }

  // Conecta por Bluetooth com o terminal. "dispositivo" é o identificador
  // impresso/mostrado na maquininha, ex: "PRO-12345678" (Moderninha Pro) ou
  // o endereço MAC do Bluetooth pareado.
  @PluginMethod
  public void activate(PluginCall call) {
    String dispositivo = call.getString("dispositivo");
    if (dispositivo == null || dispositivo.isEmpty()) {
      call.reject("Informe \"dispositivo\" (ex: PRO-12345678, o código mostrado na maquininha).");
      return;
    }

    new Thread(() -> {
      try {
        PlugPagDevice device = new PlugPagDevice(dispositivo);
        int resultado = obterInstancia().initBTConnection(device);
        JSObject resposta = new JSObject();
        resposta.put("sucesso", resultado == PlugPag.RET_OK);
        resposta.put("codigo", resultado);
        call.resolve(resposta);
      } catch (Exception e) {
        call.reject("Falha ao conectar com a maquininha: " + e.getMessage(), e);
      }
    }).start();
  }

  // valorCentavos: valor em centavos (ex: 4590 = R$45,90).
  // tipo: 'credito' | 'debito' | 'voucher'.
  // parcelas / parcelamentoLoja (true = parcelado pelo vendedor) são opcionais.
  @PluginMethod
  public void pay(PluginCall call) {
    Integer valorCentavos = call.getInt("valorCentavos");
    String tipo = call.getString("tipo", "credito");
    Integer parcelas = call.getInt("parcelas", 1);
    Boolean parceladoLoja = call.getBoolean("parcelamentoLoja", false);
    String referencia = call.getString("referencia", "VENDA");

    if (valorCentavos == null || valorCentavos <= 0) {
      call.reject("Informe valorCentavos (inteiro, em centavos).");
      return;
    }

    new Thread(() -> {
      try {
        int tipoTransacao =
          "debito".equals(tipo) ? PlugPag.TYPE_DEBITO
            : "voucher".equals(tipo) ? PlugPag.TYPE_VOUCHER
            : PlugPag.TYPE_CREDITO;
        int tipoParcelamento = (parcelas != null && parcelas > 1 && Boolean.TRUE.equals(parceladoLoja))
          ? PlugPag.INSTALLMENT_TYPE_PARC_VENDEDOR
          : PlugPag.INSTALLMENT_TYPE_A_VISTA;

        // userReference precisa ter menos de 10 caracteres.
        String referenciaCurta = referencia.length() > 9 ? referencia.substring(0, 9) : referencia;

        PlugPagPaymentData dados = new PlugPagPaymentData(
          tipoTransacao,
          valorCentavos,
          tipoParcelamento,
          parcelas == null || parcelas < 1 ? 1 : parcelas,
          referenciaCurta
        );

        PlugPagTransactionResult resultado = obterInstancia().doPayment(dados);

        JSObject resposta = new JSObject();
        resposta.put("sucesso", resultado.getResult() == PlugPag.RET_OK);
        resposta.put("codigo", resultado.getResult());
        resposta.put("mensagem", resultado.getMessage());
        resposta.put("transacaoId", resultado.getTransactionCode());
        call.resolve(resposta);
      } catch (Exception e) {
        call.reject("Falha ao processar o pagamento: " + e.getMessage(), e);
      }
    }).start();
  }

  // Estorna a última transação feita nesse terminal (é assim que funciona
  // pra Moderninha Pro/Wifi — não precisa informar qual transação).
  @PluginMethod
  public void cancel(PluginCall call) {
    new Thread(() -> {
      try {
        PlugPagTransactionResult resultado = obterInstancia().voidPayment();
        JSObject resposta = new JSObject();
        resposta.put("sucesso", resultado.getResult() == PlugPag.RET_OK);
        resposta.put("codigo", resultado.getResult());
        resposta.put("mensagem", resultado.getMessage());
        call.resolve(resposta);
      } catch (Exception e) {
        call.reject("Falha ao estornar: " + e.getMessage(), e);
      }
    }).start();
  }
}
