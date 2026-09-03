import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { precoEfetivo } from '../utils/promocoes';
import Switch from '../components/Switch';
import FormasPagamento from '../components/FormasPagamento';

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' rx='10' fill='#f0eafa'/></svg>";
const PLACEHOLDER_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(PLACEHOLDER_SVG);
const CATEGORIA_TODAS = 'Todos';

export default function Pdv() {
  const [produtos, setProdutos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIA_TODAS);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]); // [{produto_id, nome, preco, quantidade, estoque}]
  const [desconto, setDesconto] = useState('0');
  const [finalizando, setFinalizando] = useState(false);
  const [toast, setToast] = useState(null);
  const [promocoes, setPromocoes] = useState([]);

  useEffect(() => {
    carregar();
    // Estoque é compartilhado entre todos os garçons — qualquer venda em
    // outro celular deve atualizar a quantidade aqui em tempo real.
    const canal = supabase
      .channel('estoque-produtos-pdv')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'produtos' }, carregarProdutos)
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
    setProdutos(data || []);
  }

  async function carregar() {
    const [prodResp, catResp, promoResp] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('ordem').order('nome'),
      supabase.from('promocoes').select('*').eq('ativo', true),
    ]);
    setProdutos(prodResp.data || []);
    setCategorias(catResp.data || []);
    setPromocoes(promoResp.data || []);
  }

  function avisar(msg, kind) {
    setToast({ msg, kind, key: Date.now() });
  }

  function adicionarAoCarrinho(p, delta = 1) {
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.produto_id === p.id);
      const qtdAtual = existente?.quantidade || 0;
      if (delta > 0 && p.estoque !== null && qtdAtual >= p.estoque) {
        avisar(`Estoque insuficiente de "${p.nome}".`, 'danger');
        return atual;
      }
      if (existente) {
        return atual.map((i) => (i.produto_id === p.id ? { ...i, quantidade: i.quantidade + delta } : i)).filter((i) => i.quantidade > 0);
      }
      if (delta <= 0) return atual;
      return [...atual, { produto_id: p.id, nome: p.nome, preco: precoEfetivo(p, promocoes), quantidade: 1, estoque: p.estoque }];
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
  }

  const subtotal = useMemo(() => carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0), [carrinho]);
  const descontoNum = Number(desconto.replace(',', '.')) || 0;
  const total = Math.max(0, subtotal - descontoNum);

  function quantidadeNoCarrinho(produtoId) {
    return carrinho.find((i) => i.produto_id === produtoId)?.quantidade || 0;
  }

  const categoriasComTodos = [CATEGORIA_TODAS, ...categorias.map((c) => c.nome)];
  const indiceCategoria = categoriasComTodos.indexOf(categoriaAtiva);

  function trocarCategoria(direcao) {
    const proximo = indiceCategoria + direcao;
    if (proximo >= 0 && proximo < categoriasComTodos.length) setCategoriaAtiva(categoriasComTodos[proximo]);
  }

  const toqueInicioX = useRef(null);
  function onTouchStart(e) {
    toqueInicioX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (toqueInicioX.current === null) return;
    const delta = e.changedTouches[0].clientX - toqueInicioX.current;
    if (Math.abs(delta) > 60) trocarCategoria(delta < 0 ? 1 : -1);
    toqueInicioX.current = null;
  }

  const produtosFiltrados = (produtos === null ? [] : produtos)
    .filter((p) => categoriaAtiva === CATEGORIA_TODAS || categorias.find((c) => c.id === p.categoria_id)?.nome === categoriaAtiva)
    .filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  if (finalizando) {
    return (
      <FinalizarVenda
        itens={carrinho}
        subtotal={subtotal}
        desconto={descontoNum}
        total={total}
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
      <div className="search-input-wrap">
        <Search size={15} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." />
      </div>

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
        <p className="muted" style={{ fontSize: 13 }}>Nenhum produto encontrado.</p>
      ) : (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}
        >
          {produtosFiltrados.map((p) => {
            const esgotado = p.estoque !== null && p.estoque <= 0;
            const preco = precoEfetivo(p, promocoes);
            const emPromocao = preco < Number(p.preco);
            const qtd = quantidadeNoCarrinho(p.id);
            return (
              <div key={p.id} className="card" style={{ opacity: esgotado ? 0.5 : 1 }}>
                <img src={p.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: 8, objectFit: 'cover', background: 'var(--panel-2)', marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span className="tabular" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{money(preco)}</span>
                  {emPromocao && <span className="tabular muted" style={{ fontSize: 11, textDecoration: 'line-through' }}>{money(p.preco)}</span>}
                </div>
                {p.estoque !== null && (
                  <div className="muted tabular" style={{ fontSize: 11, marginTop: 2 }}>
                    {esgotado ? 'Esgotado' : `Estoque: ${p.estoque}`}
                  </div>
                )}
                <div className="stepper-mini" style={{ marginTop: 6, justifyContent: 'center', width: '100%' }}>
                  <button type="button" className="stepper-mini-btn" disabled={qtd === 0} onClick={() => adicionarAoCarrinho(p, -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="stepper-qty tabular">{qtd}</span>
                  <button type="button" className="stepper-mini-btn" disabled={esgotado || (p.estoque !== null && qtd >= p.estoque)} onClick={() => adicionarAoCarrinho(p, 1)}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>
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

function FinalizarVenda({ itens, subtotal, desconto, total, onVoltar, onConcluida, avisar }) {
  const [taxaPercentual, setTaxaPercentual] = useState(0);
  const [taxaAtiva, setTaxaAtiva] = useState(true);
  // pagamentos[i].auto = true enquanto o valor ainda não foi editado à mão —
  // nesse caso ele sempre reflete o total mais recente (desconto/taxa).
  const [pagamentos, setPagamentos] = useState([{ forma: 'dinheiro', valor: total.toFixed(2), auto: true }]);
  const [recebido, setRecebido] = useState('');
  const [dividirPor, setDividirPor] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('empresas(taxa_servico_percentual)')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTaxaPercentual(Number(data?.empresas?.taxa_servico_percentual) || 0));
  }, []);

  const taxaValor = taxaAtiva ? Math.round(total * (taxaPercentual / 100) * 100) / 100 : 0;
  const totalFinal = total + taxaValor;

  function valorEfetivo(p) {
    return p.auto ? totalFinal.toFixed(2) : p.valor;
  }

  const somaPagamentos = pagamentos.reduce((s, p) => s + (Number(valorEfetivo(p).replace(',', '.')) || 0), 0);
  const restante = totalFinal - somaPagamentos;
  const troco = pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro' && recebido
    ? Number(recebido.replace(',', '.')) - totalFinal
    : null;

  function atualizarPagamento(idx, campo, valor) {
    setPagamentos((atual) => atual.map((p, i) => (i === idx ? { ...p, [campo]: valor, auto: campo === 'valor' ? false : p.auto } : p)));
  }

  function adicionarPagamento() {
    setPagamentos((atual) => [
      ...atual.map((p) => (p.auto ? { ...p, valor: totalFinal.toFixed(2), auto: false } : p)),
      { forma: 'pix', valor: Math.max(0, restante).toFixed(2), auto: false },
    ]);
    setDividirPor((n) => n + 1);
  }

  function removerPagamento(idx) {
    setPagamentos((atual) => atual.filter((_, i) => i !== idx));
    setDividirPor((n) => Math.max(1, n - 1));
  }

  function mudarDivisao(delta) {
    const n = Math.max(1, dividirPor + delta);
    setDividirPor(n);
    if (n === 1) {
      setPagamentos([{ forma: pagamentos[0]?.forma || 'dinheiro', valor: totalFinal.toFixed(2), auto: true }]);
      return;
    }
    const base = Math.floor((totalFinal / n) * 100) / 100;
    const ultimoValor = Math.round((totalFinal - base * (n - 1)) * 100) / 100;
    setPagamentos(
      Array.from({ length: n }, (_, i) => ({
        forma: 'dinheiro',
        valor: (i === n - 1 ? ultimoValor : base).toFixed(2),
        auto: false,
      }))
    );
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
      p_pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: Number(valorEfetivo(p).replace(',', '.')) || 0 })),
      p_desconto: desconto,
      p_cliente_id: null,
      p_taxa_servico: taxaValor,
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

      <div className="pay-stats-grid">
        <div className="pay-stat">
          <span className="pay-stat__label">Subtotal</span>
          <span className="pay-stat__value">{money(subtotal)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">Desconto</span>
          <span className="pay-stat__value">{money(desconto)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">Total</span>
          <span className="pay-stat__value">{money(totalFinal)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">Restante</span>
          <span className={'pay-stat__value' + (Math.abs(restante) > 0.01 ? ' is-danger' : ' is-success')}>{money(restante)}</span>
        </div>
      </div>

      {taxaPercentual > 0 && (
        <div className="card row" style={{ padding: '8px 12px' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>Taxa de serviço ({taxaPercentual}%) {taxaAtiva ? money(taxaValor) : money(0)}</span>
          <Switch checked={taxaAtiva} onChange={setTaxaAtiva} />
        </div>
      )}

      <div className="pay-divider-row">
        <span style={{ fontWeight: 700, fontSize: 13 }}>Dividir por</span>
        <div className="pay-divider-stepper">
          <button type="button" className="pay-divider-btn" onClick={() => mudarDivisao(-1)} disabled={dividirPor <= 1}>
            <Minus size={14} />
          </button>
          <span className="pay-divider-count">{dividirPor}</span>
          <button type="button" className="pay-divider-btn" onClick={() => mudarDivisao(1)}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      {pagamentos.length === 1 ? (
        <>
          <div className="pay-big-value">
            <div className="pay-big-value__amount tabular">{money(Number(valorEfetivo(pagamentos[0]).replace(',', '.')) || 0)}</div>
          </div>
          <FormasPagamento value={pagamentos[0].forma} onChange={(f) => atualizarPagamento(0, 'forma', f)} />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagamentos.map((p, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row">
                <span className="muted tabular" style={{ fontSize: 11 }}>Pessoa {idx + 1}</span>
                <input
                  value={valorEfetivo(p)}
                  onChange={(e) => atualizarPagamento(idx, 'valor', e.target.value)}
                  inputMode="decimal"
                  style={{ width: 100, textAlign: 'right', marginLeft: 'auto' }}
                />
                <button type="button" onClick={() => removerPagamento(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <FormasPagamento value={p.forma} onChange={(f) => atualizarPagamento(idx, 'forma', f)} />
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarPagamento}>
            + Adicionar pessoa
          </button>
        </div>
      )}

      {pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro' && (
        <div className="card">
          <span className="label">Valor recebido</span>
          <input value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder={totalFinal.toFixed(2)} />
          {troco !== null && troco >= 0 && (
            <p className="success-text" style={{ marginTop: 8 }}>Troco: {money(troco)}</p>
          )}
        </div>
      )}

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={confirmar}>
        {enviando ? 'Finalizando…' : 'Confirmar pagamento'}
      </button>
    </div>
  );
}
