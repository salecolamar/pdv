import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { precoEfetivo } from '../utils/promocoes';

const STATUS_LABEL = { livre: 'Livre', ocupada: 'Ocupada' };

export default function Mesas() {
  const [aba, setAba] = useState('mapa');
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const [mesas, setMesas] = useState(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase.from('mesas').select('*').order('nome');
    setMesas(
      (data || []).sort((a, b) => {
        const na = Number(a.nome.match(/\d+/)?.[0]);
        const nb = Number(b.nome.match(/\d+/)?.[0]);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.nome.localeCompare(b.nome);
      })
    );
  }

  if (mesaSelecionada) {
    return (
      <Comanda
        mesa={mesaSelecionada}
        onVoltar={() => {
          setMesaSelecionada(null);
          carregar();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tab-row">
        <button type="button" className="tab" aria-pressed={aba === 'mapa'} onClick={() => setAba('mapa')}>
          Mapa
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'configurar'} onClick={() => setAba('configurar')}>
          Configurar mesas
        </button>
      </div>

      {aba === 'mapa' ? (
        <MapaMesas mesas={mesas} onAbrirMesa={setMesaSelecionada} />
      ) : (
        <ConfigurarMesas mesas={mesas} onAtualizado={carregar} />
      )}
    </div>
  );
}

function MapaMesas({ mesas, onAbrirMesa }) {
  if (mesas === null) return <p className="muted">Carregando…</p>;
  if (mesas.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa cadastrada. Use "Configurar mesas" pra criar.</p>;
  }

  return (
    <>
      <p className="muted" style={{ fontSize: 13 }}>Azul = livre, vermelho = ocupada. Toque numa mesa pra ver a comanda.</p>
      <div className="mesa-grid">
        {mesas.map((m) => {
          const livre = m.status === 'livre';
          const cor = livre ? 'var(--info)' : 'var(--danger)';
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
              <span className="mesa-card__status" style={{ color: cor }}>{STATUS_LABEL[m.status] || m.status}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ConfigurarMesas({ mesas, onAtualizado }) {
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setEnviando(true);
    setErro('');
    const { error } = await supabase.from('mesas').insert({ nome: nome.trim() });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNome('');
    onAtualizado();
  }

  async function criarVarias(e) {
    e.preventDefault();
    const qtd = Number(quantidade);
    if (!(qtd > 0)) return;
    setEnviando(true);
    setErro('');
    const maiorNumero = (mesas || []).reduce((max, m) => {
      const n = Number(m.nome.match(/\d+/)?.[0]);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const novas = Array.from({ length: qtd }, (_, i) => ({ nome: `Mesa ${maiorNumero + i + 1}` }));
    const { error } = await supabase.from('mesas').insert(novas);
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setQuantidade('');
    onAtualizado();
  }

  async function remover(id) {
    await supabase.from('mesas').delete().eq('id', id);
    onAtualizado();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={adicionar} className="card row">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mesa 7" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>Adicionar</button>
      </form>
      <form onSubmit={criarVarias} className="card row">
        <input
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="Quantidade de mesas"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={enviando}>Criar várias</button>
      </form>
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      {mesas === null ? (
        <p className="muted">Carregando…</p>
      ) : mesas.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa cadastrada ainda.</p>
      ) : (
        <div className="list">
          {mesas.map((m) => (
            <div key={m.id} className="item" style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{m.nome}</span>
              <span className={'chip ' + (m.status === 'livre' ? 'chip-success' : 'chip-danger')}>{STATUS_LABEL[m.status] || m.status}</span>
              <button
                type="button"
                onClick={() => remover(m.id)}
                disabled={m.status !== 'livre'}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: m.status === 'livre' ? 'pointer' : 'not-allowed', opacity: m.status === 'livre' ? 1 : 0.35, padding: 4, marginLeft: 8 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Comanda({ mesa, onVoltar }) {
  const [pedido, setPedido] = useState(undefined);
  const [precisaCliente, setPrecisaCliente] = useState(false);
  const [rodadas, setRodadas] = useState([]);
  const [lancando, setLancando] = useState(false);
  const [pagando, setPagando] = useState(false);
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
      .select('*, pedido_itens(*)')
      .eq('pedido_id', pedidoId)
      .order('criado_em');
    setRodadas(data || []);
  }

  async function fecharComanda() {
    await supabase.from('pedidos').update({ status: 'fechado', fechado_em: new Date().toISOString() }).eq('id', pedido.id);
    setPedido((p) => ({ ...p, status: 'fechado' }));
    avisar('Comanda fechada. Escolha a forma de pagamento.', 'success');
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

  const total = rodadas.reduce((s, r) => s + r.pedido_itens.reduce((si, i) => si + i.quantidade * i.preco_unitario, 0), 0);

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
        total={total}
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
          rodadas.map((r) => (
            <div key={r.id} className="card">
              <div className="row" style={{ marginBottom: 6 }}>
                <span className={'chip ' + (r.status === 'pronto' ? 'chip-success' : 'chip-primary')}>
                  {r.status === 'pronto' ? 'Pronto' : 'Na cozinha'}
                </span>
              </div>
              {r.pedido_itens.map((i) => (
                <div className="row" key={i.id} style={{ fontSize: 13, padding: '2px 0' }}>
                  <span>{i.quantidade}x {i.nome_produto}</span>
                  <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="card row">
        <span className="muted">Total</span>
        <span className="tabular" style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</span>
      </div>

      {toast && (
        <div className={'toast is-visible' + (toast.kind ? ' is-' + toast.kind : '')} key={toast.key}>
          {toast.msg}
        </div>
      )}

      {pedido.status === 'aberto' && (
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setLancando(true)}>
            Lançar itens
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={fecharComanda} disabled={rodadas.length === 0}>
            Fechar comanda
          </button>
        </>
      )}

      {pedido.status === 'fechado' && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => setPagando(true)}>
          Receber pagamento
        </button>
      )}

      {pedido.status === 'pago' && (
        <p className="success-text" style={{ textAlign: 'center' }}>Comanda paga — mesa liberada para o próximo grupo.</p>
      )}
    </div>
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
  const [pagamentos, setPagamentos] = useState([{ forma: 'dinheiro', valor: total.toFixed(2) }]);
  const [desconto, setDesconto] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const descontoNum = Number(desconto.replace(',', '.')) || 0;
  const totalComDesconto = Math.max(0, total - descontoNum);
  const somaPagamentos = pagamentos.reduce((s, p) => s + (Number(p.valor.replace(',', '.')) || 0), 0);
  const restante = totalComDesconto - somaPagamentos;

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
        <p className="tabular" style={{ fontSize: 28, fontWeight: 800 }}>{money(totalComDesconto)}</p>
      </div>

      <div className="card">
        <span className="label">Desconto (R$)</span>
        <input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" />
      </div>

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
