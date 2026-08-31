import { useEffect, useState } from 'react';
import { ArrowRightLeft, Minus, Plus, Printer, Receipt, ShoppingCart, Trash2, Wallet, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { precoEfetivo } from '../utils/promocoes';
import Pdv from './Pdv';

const STATUS_LABEL = { livre: 'Disponível', ocupada: 'Ocupada' };
const LIMITE_SEM_PEDIDO_MS = 20 * 60 * 1000;

export default function Mesas() {
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const [vendaAvulsa, setVendaAvulsa] = useState(false);
  const [mesas, setMesas] = useState(null);
  const [ultimoPedidoPorMesa, setUltimoPedidoPorMesa] = useState(new Map());
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function carregar() {
    const [mesasResp, pedidosResp] = await Promise.all([
      supabase.from('mesas').select('*').order('nome'),
      supabase.from('pedidos').select('mesa_id, aberto_em, pedido_rodadas(criado_em)').eq('status', 'aberto'),
    ]);
    setMesas(
      (mesasResp.data || []).sort((a, b) => {
        const na = Number(a.nome.match(/\d+/)?.[0]);
        const nb = Number(b.nome.match(/\d+/)?.[0]);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.nome.localeCompare(b.nome);
      })
    );

    const mapa = new Map();
    for (const p of pedidosResp.data || []) {
      const horarios = (p.pedido_rodadas || []).map((r) => new Date(r.criado_em).getTime());
      const ultimo = horarios.length ? Math.max(...horarios) : new Date(p.aberto_em).getTime();
      mapa.set(p.mesa_id, ultimo);
    }
    setUltimoPedidoPorMesa(mapa);
  }

  if (mesaSelecionada) {
    return (
      <Comanda
        mesa={mesaSelecionada}
        mesas={mesas || []}
        onVoltar={() => {
          setMesaSelecionada(null);
          carregar();
        }}
      />
    );
  }

  if (vendaAvulsa) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setVendaAvulsa(false)}>
          <X size={14} /> Voltar ao mapa
        </button>
        <Pdv />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-block" onClick={() => setVendaAvulsa(true)}>
        <ShoppingCart size={15} /> Venda avulsa (sem mesa)
      </button>
      <MapaMesas mesas={mesas} ultimoPedidoPorMesa={ultimoPedidoPorMesa} agora={agora} onAbrirMesa={setMesaSelecionada} />
    </div>
  );
}

function corMesa(mesa, ultimoPedidoPorMesa, agora) {
  if (mesa.status === 'livre') return { cor: 'var(--success)', label: 'Disponível' };
  const ultimo = ultimoPedidoPorMesa.get(mesa.id);
  if (ultimo && agora - ultimo > LIMITE_SEM_PEDIDO_MS) {
    return { cor: 'var(--atencao)', label: `Sem pedido há ${Math.floor((agora - ultimo) / 60000)}min` };
  }
  return { cor: 'var(--danger)', label: 'Ocupada' };
}

function MapaMesas({ mesas, ultimoPedidoPorMesa, agora, onAbrirMesa }) {
  if (mesas === null) return <p className="muted">Carregando…</p>;
  if (mesas.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa cadastrada ainda. Peça pro admin cadastrar em Pós-pago.</p>;
  }

  return (
    <div className="mesa-grid">
      {mesas.map((m) => {
        const { cor, label } = corMesa(m, ultimoPedidoPorMesa, agora);
        const numero = (m.nome.match(/\d+/) || [m.nome])[0];
        return (
          <button key={m.id} type="button" className="mesa-card" onClick={() => onAbrirMesa(m)}>
            <span className="table-wrap">
              <span className="table-chair table-chair--top" style={{ background: cor }} />
              <span className="table-chair table-chair--bottom" style={{ background: cor }} />
              <span className="table-chair table-chair--left" style={{ background: cor }} />
              <span className="table-chair table-chair--right" style={{ background: cor }} />
              <span className="table-top" style={{ background: cor }}>{numero}</span>
            </span>
            <span className="mesa-card__status" style={{ color: cor }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Comanda({ mesa, mesas, onVoltar }) {
  const [pedido, setPedido] = useState(undefined);
  const [precisaCliente, setPrecisaCliente] = useState(false);
  const [rodadas, setRodadas] = useState([]);
  const [pagamentosParciais, setPagamentosParciais] = useState([]);
  const [lancando, setLancando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [vendoConta, setVendoConta] = useState(false);
  const [transferindoMesa, setTransferindoMesa] = useState(false);
  const [transferindoItem, setTransferindoItem] = useState(null);
  const [pagamentoParcialAberto, setPagamentoParcialAberto] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    verificarPedido();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function avisar(msg, kind) {
    setToast({ msg, kind, key: Date.now() });
  }

  async function verificarPedido() {
    const { data: existente } = await supabase
      .from('pedidos')
      .select('*, clientes(nome)')
      .eq('mesa_id', mesa.id)
      .in('status', ['aberto', 'fechado', 'pago'])
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente && existente.status !== 'pago') {
      setPedido(existente);
      carregarRodadas(existente.id);
      carregarPagamentosParciais(existente.id);
      return;
    }

    setPrecisaCliente(true);
  }

  async function abrirComCliente(nomeCliente, telefone) {
    const { data: cliente, error: erroCliente } = await supabase
      .from('clientes')
      .insert({ nome: nomeCliente, telefone: telefone || null })
      .select()
      .single();
    if (erroCliente) {
      avisar(erroCliente.message, 'danger');
      return false;
    }

    const { data: novo, error } = await supabase
      .from('pedidos')
      .insert({ mesa_id: mesa.id, cliente_id: cliente.id })
      .select('*, clientes(nome)')
      .single();
    if (error) {
      avisar(error.message, 'danger');
      return false;
    }

    setPrecisaCliente(false);
    setPedido(novo);
    setRodadas([]);
    return true;
  }

  async function carregarRodadas(pedidoId) {
    const { data } = await supabase
      .from('pedido_rodadas')
      .select('*, pedido_itens(*), usuarios(nome)')
      .eq('pedido_id', pedidoId)
      .order('criado_em');
    setRodadas(data || []);
  }

  async function carregarPagamentosParciais(pedidoId) {
    const { data } = await supabase
      .from('pedido_pagamentos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('criado_em');
    setPagamentosParciais(data || []);
  }

  async function cancelarItem(itemId) {
    if (!window.confirm('Cancelar esse item da comanda? O estoque volta a subir.')) return;
    const { error } = await supabase.rpc('cancelar_item_pedido', { p_item_id: itemId });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    avisar('Item cancelado.', 'success');
    carregarRodadas(pedido.id);
  }

  async function transferirMesaPara(mesaDestinoId) {
    const { error } = await supabase.rpc('transferir_mesa', { p_pedido_id: pedido.id, p_mesa_destino_id: mesaDestinoId });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    setTransferindoMesa(false);
    onVoltar();
  }

  async function transferirItemPara(itemId, mesaDestinoId) {
    const { error } = await supabase.rpc('transferir_item_pedido', { p_item_id: itemId, p_mesa_destino_id: mesaDestinoId });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    setTransferindoItem(null);
    avisar('Item transferido.', 'success');
    carregarRodadas(pedido.id);
  }

  async function registrarPagamentoParcial(forma, valor) {
    const { error } = await supabase.rpc('registrar_pagamento_parcial', { p_pedido_id: pedido.id, p_forma: forma, p_valor: valor });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return false;
    }
    setPagamentoParcialAberto(false);
    avisar('Pagamento parcial registrado.', 'success');
    carregarPagamentosParciais(pedido.id);
    return true;
  }

  async function fecharComanda() {
    await supabase.from('pedidos').update({ status: 'fechado', fechado_em: new Date().toISOString() }).eq('id', pedido.id);
    setPedido((p) => ({ ...p, status: 'fechado' }));
    avisar('Comanda fechada. Escolha a forma de pagamento.', 'success');
  }

  async function irParaPagamento() {
    if (pedido.status === 'aberto') await fecharComanda();
    setPagando(true);
  }

  if (precisaCliente) {
    return <FormAbrirMesa mesa={mesa} onAbrir={abrirComCliente} onVoltar={onVoltar} />;
  }

  if (pedido === undefined) return <p className="muted">Carregando…</p>;
  if (pedido === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="muted">Não foi possível abrir essa mesa.</p>
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
          <X size={14} /> Voltar ao mapa
        </button>
      </div>
    );
  }

  const total = rodadas.reduce(
    (s, r) => s + r.pedido_itens.filter((i) => !i.cancelado).reduce((si, i) => si + i.quantidade * i.preco_unitario, 0),
    0
  );
  const valorPago = pagamentosParciais.reduce((s, p) => s + Number(p.valor), 0);
  const restante = Math.max(0, total - valorPago);
  const mesasDestinoTransferirMesa = mesas.filter((m) => m.id !== mesa.id && m.status === 'livre');
  const mesasDestinoTransferirItem = mesas.filter((m) => m.id !== mesa.id);

  if (vendoConta) {
    return (
      <ContaMesa
        mesa={mesa}
        pedido={pedido}
        rodadas={rodadas}
        total={total}
        valorPago={valorPago}
        onVoltar={() => setVendoConta(false)}
      />
    );
  }

  if (transferindoMesa) {
    return (
      <TransferirMesaForm
        mesa={mesa}
        mesasDestino={mesasDestinoTransferirMesa}
        onConfirmar={transferirMesaPara}
        onVoltar={() => setTransferindoMesa(false)}
      />
    );
  }

  if (transferindoItem) {
    return (
      <TransferirItemForm
        item={transferindoItem}
        mesa={mesa}
        mesasDestino={mesasDestinoTransferirItem}
        onConfirmar={(mesaDestinoId) => transferirItemPara(transferindoItem.id, mesaDestinoId)}
        onVoltar={() => setTransferindoItem(null)}
      />
    );
  }

  if (pagamentoParcialAberto) {
    return (
      <PagamentoParcialForm
        restante={restante}
        onConfirmar={registrarPagamentoParcial}
        onVoltar={() => setPagamentoParcialAberto(false)}
      />
    );
  }

  if (lancando) {
    return (
      <LancarItens
        pedido={pedido}
        onVoltar={() => setLancando(false)}
        onLancado={() => {
          setLancando(false);
          carregarRodadas(pedido.id);
          avisar('Itens lançados na cozinha!', 'success');
        }}
      />
    );
  }

  if (pagando) {
    return (
      <FinalizarPedido
        pedido={pedido}
        total={restante}
        onVoltar={() => setPagando(false)}
        onConcluido={() => {
          setPagando(false);
          setPedido((p) => ({ ...p, status: 'pago' }));
          avisar('Comanda paga! Mesa liberada.', 'success');
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar ao mapa
      </button>

      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>{mesa.nome}</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {pedido.clientes?.nome ? `Cliente: ${pedido.clientes.nome} · ` : ''}
          {pedido.status === 'aberto' ? 'Comanda aberta' : pedido.status === 'fechado' ? 'Aguardando pagamento' : 'Paga'}
        </p>
      </div>

      <div className="list">
        {rodadas.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhum item lançado ainda.</p>
        ) : (
          rodadas.map((r) => {
            const hora = new Date(r.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={r.id} className="card">
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className={'chip ' + (r.status === 'pronto' ? 'chip-success' : 'chip-primary')}>
                    {r.status === 'pronto' ? 'Pronto' : 'Na cozinha'}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>{r.usuarios?.nome || 'Operador'} · {hora}</span>
                </div>
                {r.pedido_itens.map((i) => (
                  <div className="row" key={i.id} style={{ fontSize: 13, padding: '2px 0', opacity: i.cancelado ? 0.5 : 1 }}>
                    <span style={{ textDecoration: i.cancelado ? 'line-through' : 'none' }}>
                      {i.quantidade}x {i.nome_produto}{i.cancelado ? ' (cancelado)' : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
                      {pedido.status === 'aberto' && !i.cancelado && (
                        <>
                          <button
                            type="button"
                            title="Transferir item"
                            onClick={() => setTransferindoItem(i)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 2 }}
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                          <button
                            type="button"
                            title="Cancelar item"
                            onClick={() => cancelarItem(i.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="row">
          <span className="muted">Total</span>
          <span className="tabular" style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</span>
        </div>
        {valorPago > 0 && (
          <>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">Valor pago</span>
              <span className="tabular success-text">{money(valorPago)}</span>
            </div>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">Valor a pagar</span>
              <span className="tabular" style={{ fontWeight: 700 }}>{money(restante)}</span>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className={'toast is-visible' + (toast.kind ? ' is-' + toast.kind : '')} key={toast.key}>
          {toast.msg}
        </div>
      )}

      <div className="tab-row">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVendoConta(true)}>
          <Receipt size={14} /> Imprimir conta
        </button>
        {pedido.status === 'aberto' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTransferindoMesa(true)} disabled={rodadas.length === 0}>
            <ArrowRightLeft size={14} /> Transferir mesa
          </button>
        )}
        {pedido.status !== 'pago' && restante > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagamentoParcialAberto(true)}>
            <Wallet size={14} /> Pagamento parcial
          </button>
        )}
      </div>

      {pedido.status === 'aberto' && (
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setLancando(true)}>
            Lançar itens
          </button>
          <button type="button" className="btn btn-primary btn-block" onClick={irParaPagamento} disabled={rodadas.length === 0}>
            Receber pagamento{restante > 0 ? ` (${money(restante)})` : ''}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={fecharComanda} disabled={rodadas.length === 0}>
            Fechar comanda (sem pagar agora)
          </button>
        </>
      )}

      {pedido.status === 'fechado' && (
        <button type="button" className="btn btn-primary btn-block" onClick={irParaPagamento}>
          Receber pagamento{restante > 0 ? ` (${money(restante)})` : ''}
        </button>
      )}

      {pedido.status === 'pago' && (
        <p className="success-text" style={{ textAlign: 'center' }}>Comanda paga — mesa liberada para o próximo grupo.</p>
      )}
    </div>
  );
}

function ContaMesa({ mesa, pedido, rodadas, total, valorPago, onVoltar }) {
  const itens = rodadas.flatMap((r) => r.pedido_itens.filter((i) => !i.cancelado).map((i) => ({ ...i, rodada: r })));
  const [taxaPercentual, setTaxaPercentual] = useState(0);

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('empresas(taxa_servico_percentual)')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTaxaPercentual(Number(data?.empresas?.taxa_servico_percentual) || 0));
  }, []);

  const taxaValor = Math.round(total * (taxaPercentual / 100) * 100) / 100;
  const totalComTaxa = total + taxaValor;
  const restanteComTaxa = Math.max(0, totalComTaxa - valorPago);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{mesa.nome}</h1>
          {pedido.clientes?.nome && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Cliente: {pedido.clientes.nome}</p>}
        </div>

        <div className="list">
          {itens.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Nenhum item lançado.</p>
          ) : (
            itens.map((i) => (
              <div key={i.id} className="row" style={{ fontSize: 13, padding: '3px 0' }}>
                <span>{i.quantidade}x {i.nome_produto}</span>
                <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
              </div>
            ))
          )}
        </div>

        <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 13 }}>
          <span className="muted">Subtotal</span>
          <span className="tabular">{money(total)}</span>
        </div>
        {taxaValor > 0 && (
          <div className="row" style={{ fontSize: 13 }}>
            <span className="muted">Taxa de serviço ({taxaPercentual}%)</span>
            <span className="tabular">{money(taxaValor)}</span>
          </div>
        )}
        <div className="row">
          <span style={{ fontWeight: 700 }}>Total</span>
          <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{money(totalComTaxa)}</span>
        </div>
        {valorPago > 0 && (
          <>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">Já pago</span>
              <span className="tabular success-text">{money(valorPago)}</span>
            </div>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">Restante</span>
              <span className="tabular" style={{ fontWeight: 700 }}>{money(restanteComTaxa)}</span>
            </div>
          </>
        )}
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => window.print()}>
        <Printer size={15} /> Imprimir
      </button>
    </div>
  );
}

function TransferirMesaForm({ mesa, mesasDestino, onConfirmar, onVoltar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Transferir {mesa.nome}</h1>
        <p className="muted" style={{ fontSize: 13 }}>Escolha uma mesa livre para levar toda a comanda.</p>
      </div>
      {mesasDestino.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa livre no momento.</p>
      ) : (
        <div className="list">
          {mesasDestino.map((m) => (
            <button key={m.id} type="button" className="card item" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onConfirmar(m.id)}>
              {m.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransferirItemForm({ item, mesa, mesasDestino, onConfirmar, onVoltar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Transferir item</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {item.quantidade}x {item.nome_produto} · de {mesa.nome} para qual mesa?
        </p>
      </div>
      {mesasDestino.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma outra mesa cadastrada.</p>
      ) : (
        <div className="list">
          {mesasDestino.map((m) => (
            <button key={m.id} type="button" className="card item" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onConfirmar(m.id)}>
              <span style={{ flex: 1 }}>{m.nome}</span>
              <span className={'chip ' + (m.status === 'livre' ? 'chip-success' : 'chip-danger')}>{STATUS_LABEL[m.status] || m.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PagamentoParcialForm({ restante, onConfirmar, onVoltar }) {
  const [forma, setForma] = useState('dinheiro');
  const [valor, setValor] = useState(restante.toFixed(2));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function confirmar(e) {
    e.preventDefault();
    setErro('');
    const num = Number(valor.replace(',', '.'));
    if (!(num > 0)) {
      setErro('Informe um valor válido.');
      return;
    }
    if (num > restante + 0.01) {
      setErro('Esse valor é maior que o restante da comanda.');
      return;
    }
    setEnviando(true);
    const ok = await onConfirmar(forma, num);
    setEnviando(false);
    if (!ok) setErro('Não foi possível registrar o pagamento.');
  }

  return (
    <form onSubmit={confirmar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Pagamento parcial</h1>
        <p className="muted" style={{ fontSize: 13 }}>Restante da comanda: {money(restante)}</p>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="label">Forma de pagamento</span>
        <select value={forma} onChange={(e) => setForma(e.target.value)}>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="outro">Outro</option>
        </select>
        <span className="label">Valor (R$)</span>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
      </div>
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Registrando…' : 'Registrar pagamento'}
      </button>
    </form>
  );
}

function FormAbrirMesa({ mesa, onAbrir, onVoltar }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function abrir(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }
    setEnviando(true);
    const ok = await onAbrir(nome.trim(), telefone.trim());
    setEnviando(false);
    if (!ok) setErro('Não foi possível abrir a mesa. Tente de novo.');
  }

  return (
    <form onSubmit={abrir} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar ao mapa
      </button>

      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>{mesa.nome}</h1>
        <p className="muted" style={{ fontSize: 13 }}>Antes de abrir, informe quem está sentando na mesa.</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="label">Nome do cliente</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ana" autoFocus />
        <span className="label">Telefone (opcional)</span>
        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Ex: (11) 99999-9999" />
      </div>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Abrindo…' : 'Abrir mesa'}
      </button>
    </form>
  );
}

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' rx='10' fill='#f0eafa'/></svg>";
const PLACEHOLDER_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(PLACEHOLDER_SVG);
const CATEGORIA_TODAS = 'Todos';

function LancarItens({ pedido, onVoltar, onLancado }) {
  const [produtos, setProdutos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [promocoes, setPromocoes] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIA_TODAS);
  const [carrinho, setCarrinho] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('ordem').order('nome'),
      supabase.from('promocoes').select('*').eq('ativo', true),
    ]).then(([prodResp, catResp, promoResp]) => {
      setProdutos(prodResp.data || []);
      setCategorias(catResp.data || []);
      setPromocoes(promoResp.data || []);
    });
  }, []);

  function adicionar(p) {
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.produto_id === p.id);
      if (existente) {
        return atual.map((i) => (i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...atual, { produto_id: p.id, nome: p.nome, preco: precoEfetivo(p, promocoes), quantidade: 1 }];
    });
  }

  function alterarQuantidade(produtoId, delta) {
    setCarrinho((atual) =>
      atual.map((i) => (i.produto_id === produtoId ? { ...i, quantidade: i.quantidade + delta } : i)).filter((i) => i.quantidade > 0)
    );
  }

  const categoriasComTodos = [CATEGORIA_TODAS, ...categorias.map((c) => c.nome)];
  const produtosFiltrados =
    produtos === null
      ? []
      : categoriaAtiva === CATEGORIA_TODAS
        ? produtos
        : produtos.filter((p) => categorias.find((c) => c.id === p.categoria_id)?.nome === categoriaAtiva);

  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);

  async function confirmar() {
    setErro('');
    setEnviando(true);
    const { error } = await supabase.rpc('lancar_pedido_itens', {
      p_pedido_id: pedido.id,
      p_itens: carrinho.map((i) => ({ produto_id: i.produto_id, nome_produto: i.nome, quantidade: i.quantidade, preco_unitario: i.preco })),
    });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    onLancado();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="tab-row">
        {categoriasComTodos.map((c) => (
          <button key={c} type="button" className="tab" aria-pressed={categoriaAtiva === c} onClick={() => setCategoriaAtiva(c)}>
            {c}
          </button>
        ))}
      </div>

      {produtos === null ? (
        <p className="muted">Carregando…</p>
      ) : produtosFiltrados.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum produto ativo nessa categoria.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {produtosFiltrados.map((p) => {
            const preco = precoEfetivo(p, promocoes);
            const emPromocao = preco < Number(p.preco);
            return (
              <button
                key={p.id}
                type="button"
                className="card"
                onClick={() => adicionar(p)}
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <img src={p.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: 8, objectFit: 'cover', background: 'var(--panel-2)', marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span className="tabular" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{money(preco)}</span>
                  {emPromocao && <span className="tabular muted" style={{ fontSize: 11, textDecoration: 'line-through' }}>{money(p.preco)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {carrinho.length > 0 && (
        <div className="card" style={{ position: 'sticky', bottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="list">
            {carrinho.map((i) => (
              <div key={i.produto_id} className="item" style={{ alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{i.nome}</span>
                <div className="stepper">
                  <button type="button" className="stepper-btn" onClick={() => alterarQuantidade(i.produto_id, -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="stepper-qty tabular">{i.quantidade}</span>
                  <button type="button" className="stepper-btn" onClick={() => alterarQuantidade(i.produto_id, 1)}>
                    <Plus size={12} />
                  </button>
                </div>
                <span className="tabular" style={{ width: 70, textAlign: 'right' }}>{money(i.preco * i.quantidade)}</span>
              </div>
            ))}
          </div>
          <div className="row">
            <span style={{ fontWeight: 700 }}>Total da rodada</span>
            <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{money(total)}</span>
          </div>
          {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
          <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={confirmar}>
            {enviando ? 'Enviando…' : 'Enviar para a cozinha'}
          </button>
        </div>
      )}
    </div>
  );
}

function FinalizarPedido({ pedido, total, onVoltar, onConcluido }) {
  const [taxaPercentual, setTaxaPercentual] = useState(0);
  const [taxaAtiva, setTaxaAtiva] = useState(true);
  const [pagamentos, setPagamentos] = useState([{ forma: 'dinheiro', valor: total.toFixed(2) }]);
  const [desconto, setDesconto] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('empresas(taxa_servico_percentual)')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const pct = Number(data?.empresas?.taxa_servico_percentual) || 0;
        setTaxaPercentual(pct);
        const taxa = Math.round(total * (pct / 100) * 100) / 100;
        setPagamentos([{ forma: 'dinheiro', valor: (total + taxa).toFixed(2) }]);
      });
  }, []);

  const descontoNum = Number(desconto.replace(',', '.')) || 0;
  const totalComDesconto = Math.max(0, total - descontoNum);
  const taxaValor = taxaAtiva ? Math.round(totalComDesconto * (taxaPercentual / 100) * 100) / 100 : 0;
  const totalFinal = totalComDesconto + taxaValor;
  const somaPagamentos = pagamentos.reduce((s, p) => s + (Number(p.valor.replace(',', '.')) || 0), 0);
  const restante = totalFinal - somaPagamentos;

  function atualizarPagamento(idx, campo, valor) {
    setPagamentos((atual) => atual.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  }

  function adicionarPagamento() {
    setPagamentos((atual) => [...atual, { forma: 'pix', valor: Math.max(0, restante).toFixed(2) }]);
  }

  function removerPagamento(idx) {
    setPagamentos((atual) => atual.filter((_, i) => i !== idx));
  }

  async function confirmar() {
    setErro('');
    if (Math.abs(restante) > 0.01) {
      setErro('A soma das formas de pagamento precisa bater com o total.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.rpc('finalizar_pedido_mesa', {
      p_pedido_id: pedido.id,
      p_pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: Number(p.valor.replace(',', '.')) || 0 })),
      p_desconto: descontoNum,
      p_taxa_servico: taxaValor,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    onConcluido();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="card" style={{ textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: 12 }}>Valor total</p>
        <p className="tabular" style={{ fontSize: 28, fontWeight: 800 }}>{money(totalFinal)}</p>
      </div>

      <div className="card">
        <span className="label">Desconto (R$)</span>
        <input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" />
      </div>

      {taxaPercentual > 0 && (
        <div className="card row">
          <div>
            <span style={{ fontWeight: 600 }}>Taxa de serviço ({taxaPercentual}%)</span>
            <p className="muted tabular" style={{ fontSize: 12, margin: 0 }}>{taxaAtiva ? money(taxaValor) : 'Desativada'}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTaxaAtiva((a) => !a)}>
            {taxaAtiva ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pagamentos.map((p, idx) => (
          <div key={idx} className="card row">
            <select value={p.forma} onChange={(e) => atualizarPagamento(idx, 'forma', e.target.value)} style={{ flex: 1 }}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="outro">Outro</option>
            </select>
            <input value={p.valor} onChange={(e) => atualizarPagamento(idx, 'valor', e.target.value)} inputMode="decimal" style={{ width: 100, textAlign: 'right' }} />
            {pagamentos.length > 1 && (
              <button type="button" onClick={() => removerPagamento(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarPagamento}>
          + Pagamento dividido
        </button>
      </div>

      <div className="row" style={{ fontSize: 13 }}>
        <span className="muted">Restante a pagar</span>
        <span className={'tabular ' + (Math.abs(restante) > 0.01 ? 'danger-text' : 'success-text')}>{money(restante)}</span>
      </div>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={confirmar}>
        {enviando ? 'Finalizando…' : 'Confirmar pagamento'}
      </button>
    </div>
  );
}
