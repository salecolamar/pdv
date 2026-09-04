import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Cardapios() {
  const [cardapios, setCardapios] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [selecionados, setSelecionados] = useState([]);

  useEffect(() => {
    carregar();
    supabase.from('produtos').select('id, nome').order('nome').then(({ data }) => setProdutos(data || []));
  }, []);

  async function carregar() {
    const { data } = await supabase.from('cardapios').select('*, cardapio_produtos(produto_id)').order('nome');
    setCardapios(data || []);
  }

  async function criar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    await supabase.from('cardapios').insert({ nome: nome.trim() });
    setNome('');
    setSalvando(false);
    carregar();
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esse cardápio?')) return;
    await supabase.from('cardapios').delete().eq('id', id);
    carregar();
  }

  async function alternarAtivo(c) {
    await supabase.from('cardapios').update({ ativo: !c.ativo }).eq('id', c.id);
    carregar();
  }

  function editar(c) {
    setEditandoId(c.id);
    setSelecionados((c.cardapio_produtos || []).map((cp) => cp.produto_id));
  }

  function alternarProduto(produtoId) {
    setSelecionados((atual) => (atual.includes(produtoId) ? atual.filter((id) => id !== produtoId) : [...atual, produtoId]));
  }

  async function salvarSelecao(cardapioId) {
    setSalvando(true);
    await supabase.from('cardapio_produtos').delete().eq('cardapio_id', cardapioId);
    if (selecionados.length > 0) {
      await supabase.from('cardapio_produtos').insert(selecionados.map((produto_id) => ({ cardapio_id: cardapioId, produto_id })));
    }
    setSalvando(false);
    setEditandoId(null);
    carregar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Monte subconjuntos do cardápio (ex: "Cardápio de eventos", "Happy hour") pra usar na hora de lançar itens.
      </p>

      <form onSubmit={criar} className="card row">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Novo cardápio (ex: Happy hour)" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
          Adicionar
        </button>
      </form>

      {cardapios === null ? (
        <p className="muted">Carregando…</p>
      ) : cardapios.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum cardápio criado ainda.</p>
      ) : (
        <div className="list">
          {cardapios.map((c) =>
            editandoId === c.id ? (
              <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{c.nome}</div>
                <span className="label">Produtos incluídos</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {produtos.map((p) => (
                    <label
                      key={p.id}
                      className="chip"
                      style={{
                        cursor: 'pointer',
                        border: selecionados.includes(p.id) ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                        background: selecionados.includes(p.id) ? 'var(--primary-soft, rgba(74,95,232,0.1))' : 'transparent',
                      }}
                    >
                      <input type="checkbox" checked={selecionados.includes(p.id)} onChange={() => alternarProduto(p.id)} style={{ marginRight: 4 }} />
                      {p.nome}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={salvando} onClick={() => salvarSelecao(c.id)}>
                    {salvando ? 'Salvando…' : 'Salvar produtos'}
                  </button>
                </div>
              </div>
            ) : (
              <div key={c.id} className="card row">
                <div>
                  <div style={{ fontWeight: 600 }}>{c.nome}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{(c.cardapio_produtos || []).length} produto(s) {c.ativo ? '' : '· inativo'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alternarAtivo(c)}>
                    {c.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => editar(c)}>
                    Editar produtos
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => excluir(c.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
