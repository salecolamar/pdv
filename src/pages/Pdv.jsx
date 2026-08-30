import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' rx='10' fill='#10131a'/></svg>";
const PLACEHOLDER_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(PLACEHOLDER_SVG);
const CATEGORIA_TODAS = 'Todos';

export default function Pdv() {
  const [produtos, setProdutos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIA_TODAS);
  const [carrinho, setCarrinho] = useState([]); // [{produto_id, nome, preco, quantidade, estoque}]
  const [desconto, setDesconto] = useState('0');
  const [finalizando, setFinalizando] = useState(false);
  const [toast, setToast] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function carregar() {
    const [prodResp, catResp, cliResp] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('ordem').order('nome'),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);
    setProdutos(prodResp.data || []);
    setCategorias(catResp.data || []);
    setClientes(cliResp.data || []);
  }

  function avisar(msg, kind) {
    setToast({ msg, kind, key: Date.now() });
  }

  function adicionarAoCarrinho(p) {
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.produto_id === p.id);
      const qtdAtual = existente?.quantidade || 0;
      if (p.estoque !== null && qtdAtual >= p.estoque) {
        avisar(`Estoque insuficiente de "${p.nome}".`, 'danger');
        return atual;
      }
      if (existente) {
        return atual.map((i) => (i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      const preco = p.preco_promocional ?? p.preco;
      return [...atual, { produto_id: p.id, nome: p.nome, preco: Number(preco), quantidade: 1, estoque: p.estoque }];
    });
  }

  function alterarQuantidade(produtoId, delta) {
    setCarrinho((atual) =>
      atual
        .map((i) => (i.produto_id === produtoId ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0)
    );
  }

  function removerItem(produtoId) {
    setCarrinho((atual) => atual.filter((i) => i.produto_id !== produtoId));
  }

  function cancelarVenda() {
    setCarrinho([]);
    setDesconto('0');
    setClienteId('');
  }

  const subtotal = useMemo(() => carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0), [carrinho]);
  const descontoNum = Number(desconto.replace(',', '.')) || 0;
  const total = Math.max(0, subtotal - descontoNum);

  const categoriasComTodos = [CATEGORIA_TODAS, ...categorias.map((c) => c.nome)];
  const produtosFiltrados =
    produtos === null
      ? []
      : categoriaAtiva === CATEGORIA_TODAS
        ? produtos
        : produtos.filter((p) => categorias.find((c) => c.id === p.categoria_id)?.nome === categoriaAtiva);

  if (finalizando) {
    return (
      <FinalizarVenda
        itens={carrinho}
        subtotal={subtotal}
        desconto={descontoNum}
        total={total}
        clienteId={clienteId || null}
        onVoltar={() => setFinalizando(false)}
        onConcluida={() => {
          cancelarVenda();
          setFinalizando(false);
          avisar('Venda registrada com sucesso!', 'success');
          carregar();
        }}
        avisar={avisar}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
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
            const esgotado = p.estoque !== null && p.estoque <= 0;
            return (
              <button
                key={p.id}
                type="button"
                className="card"
                disabled={esgotado}
                onClick={() => adicionarAoCarrinho(p)}
                style={{ textAlign: 'left', cursor: esgotado ? 'not-allowed' : 'pointer', opacity: esgotado ? 0.5 : 1 }}
              >
                <img src={p.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: 8, objectFit: 'cover', background: 'var(--panel-2)', marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                <div className="tabular" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>
                  {money(p.preco_promocional ?? p.preco)}
                </div>
                {esgotado && <div className="danger-text" style={{ fontSize: 11 }}>Esgotado</div>}
              </button>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={'toast is-visible' + (toast.kind ? ' is-' + toast.kind : '')} key={toast.key}>
          {toast.msg}
        </div>
      )}

      {carrinho.length > 0 && (
        <div className="card" style={{ position: 'sticky', bottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShoppingCart size={16} /> Carrinho
          </div>
          <div className="list">
            {carrinho.map((i) => (
              <div key={i.produto_id} className="item" style={{ alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{i.nome}</span>
                <div className="stepper">
                  <button type="button" className="stepper-btn" onClick={() => alterarQuantidade(i.produto_id, -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="stepper-qty tabular">{i.quantidade}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    disabled={i.estoque !== null && i.quantidade >= i.estoque}
                    onClick={() => alterarQuantidade(i.produto_id, 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <span className="tabular" style={{ width: 70, textAlign: 'right' }}>{money(i.preco * i.quantidade)}</span>
                <button type="button" onClick={() => removerItem(i.produto_id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="row">
            <span className="label" style={{ margin: 0 }}>Cliente (opcional)</span>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ width: 180 }}>
              <option value="">Não identificado</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <span className="label" style={{ margin: 0 }}>Desconto (R$)</span>
            <input
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              inputMode="decimal"
              style={{ width: 100, textAlign: 'right' }}
            />
          </div>
          <div className="row" style={{ fontSize: 13 }}>
            <span className="muted">Subtotal</span>
            <span className="tabular">{money(subtotal)}</span>
          </div>
          <div className="row">
            <span style={{ fontWeight: 700 }}>Total</span>
            <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{money(total)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={cancelarVenda}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => setFinalizando(true)}>
              Finalizar venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FinalizarVenda({ itens, subtotal, desconto, total, clienteId, onVoltar, onConcluida, avisar }) {
  const [pagamentos, setPagamentos] = useState([{ forma: 'dinheiro', valor: total.toFixed(2) }]);
  const [recebido, setRecebido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const somaPagamentos = pagamentos.reduce((s, p) => s + (Number(p.valor.replace(',', '.')) || 0), 0);
  const restante = total - somaPagamentos;
  const troco = pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro' && recebido
    ? Number(recebido.replace(',', '.')) - total
    : null;

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
    const { error } = await supabase.rpc('finalizar_venda', {
      p_itens: itens.map((i) => ({ produto_id: i.produto_id, nome_produto: i.nome, quantidade: i.quantidade, preco_unitario: i.preco })),
      p_pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: Number(p.valor.replace(',', '.')) || 0 })),
      p_desconto: desconto,
      p_cliente_id: clienteId,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    onConcluida();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="card" style={{ textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: 12 }}>Valor total</p>
        <p className="tabular" style={{ fontSize: 28, fontWeight: 800 }}>{money(total)}</p>
        {desconto > 0 && (
          <p className="muted" style={{ fontSize: 12 }}>Subtotal {money(subtotal)} · Desconto {money(desconto)}</p>
        )}
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
            <input
              value={p.valor}
              onChange={(e) => atualizarPagamento(idx, 'valor', e.target.value)}
              inputMode="decimal"
              style={{ width: 100, textAlign: 'right' }}
            />
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

      {pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro' && (
        <div className="card">
          <span className="label">Valor recebido</span>
          <input value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder={total.toFixed(2)} />
          {troco !== null && troco >= 0 && (
            <p className="success-text" style={{ marginTop: 8 }}>Troco: {money(troco)}</p>
          )}
        </div>
      )}

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
