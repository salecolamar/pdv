import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { money } from '../utils/format';

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' rx='10' fill='#f0eafa'/></svg>";
const PLACEHOLDER_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(PLACEHOLDER_SVG);

export default function Produtos() {
  const [aba, setAba] = useState('produtos');
  const [categorias, setCategorias] = useState(null);

  useEffect(() => {
    carregarCategorias();
  }, []);

  async function carregarCategorias() {
    const { data } = await supabase.from('categorias').select('*').order('ordem').order('nome');
    setCategorias(data || []);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tab-row">
        <button type="button" className="tab" aria-pressed={aba === 'produtos'} onClick={() => setAba('produtos')}>
          Produtos
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'categorias'} onClick={() => setAba('categorias')}>
          Categorias
        </button>
      </div>
      {aba === 'categorias' ? (
        <Categorias categorias={categorias} onMudou={carregarCategorias} />
      ) : (
        <ProdutosLista categorias={categorias || []} />
      )}
    </div>
  );
}

function Categorias({ categorias, onMudou }) {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    await supabase.from('categorias').insert({ nome: nome.trim(), ordem: categorias?.length || 0 });
    setNome('');
    setSalvando(false);
    onMudou();
  }

  async function excluir(id) {
    await supabase.from('categorias').delete().eq('id', id);
    onMudou();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={adicionar} className="card row">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova categoria" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
          Adicionar
        </button>
      </form>
      {categorias === null ? (
        <p className="muted">Carregando…</p>
      ) : categorias.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <div className="list">
          {categorias.map((c) => (
            <div key={c.id} className="item">
              <span>{c.nome}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => excluir(c.id)}>
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function campoVazio(produto) {
  return {
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    preco: produto ? String(produto.preco) : '',
    preco_promocional: produto?.preco_promocional != null ? String(produto.preco_promocional) : '',
    categoria_id: produto?.categoria_id || '',
    sku: produto?.sku || '',
    estoque: produto?.estoque != null ? String(produto.estoque) : '',
    estoque_minimo: produto?.estoque_minimo != null ? String(produto.estoque_minimo) : '',
    unidade: produto?.unidade || 'un',
    foto_url: produto?.foto_url || '',
    ativo: produto?.ativo ?? true,
  };
}

function validar(campos, avisar) {
  const nome = campos.nome.trim();
  const preco = Number(campos.preco.replace(',', '.'));
  if (!nome || !(preco > 0)) {
    avisar('Preencha nome e um preço válido.');
    return null;
  }
  const precoPromo = campos.preco_promocional.trim() ? Number(campos.preco_promocional.replace(',', '.')) : null;
  const estoque = campos.estoque.trim() ? Number(campos.estoque.replace(',', '.')) : null;
  const estoqueMinimo = campos.estoque_minimo.trim() ? Number(campos.estoque_minimo.replace(',', '.')) : null;
  return {
    nome,
    descricao: campos.descricao.trim() || null,
    preco,
    preco_promocional: precoPromo,
    categoria_id: campos.categoria_id || null,
    sku: campos.sku.trim() || null,
    estoque,
    estoque_minimo: estoqueMinimo,
    unidade: campos.unidade.trim() || 'un',
    foto_url: campos.foto_url.trim() || null,
    ativo: campos.ativo,
  };
}

function CamposProduto({ campos, setCampos, categorias }) {
  return (
    <>
      <span className="label">Nome</span>
      <input value={campos.nome} onChange={(e) => setCampos({ ...campos, nome: e.target.value })} placeholder="Coca Cola Zero Lata" />
      <span className="label">Descrição (opcional)</span>
      <input value={campos.descricao} onChange={(e) => setCampos({ ...campos, descricao: e.target.value })} />
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span className="label">Preço (R$)</span>
          <input value={campos.preco} onChange={(e) => setCampos({ ...campos, preco: e.target.value })} inputMode="decimal" placeholder="8" />
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">Preço promocional</span>
          <input value={campos.preco_promocional} onChange={(e) => setCampos({ ...campos, preco_promocional: e.target.value })} inputMode="decimal" placeholder="opcional" />
        </div>
      </div>
      <span className="label">Categoria</span>
      <select value={campos.categoria_id} onChange={(e) => setCampos({ ...campos, categoria_id: e.target.value })}>
        <option value="">Sem categoria</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span className="label">SKU (opcional)</span>
          <input value={campos.sku} onChange={(e) => setCampos({ ...campos, sku: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">Unidade</span>
          <input value={campos.unidade} onChange={(e) => setCampos({ ...campos, unidade: e.target.value })} placeholder="un" />
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span className="label">Estoque (vazio = sem controle)</span>
          <input value={campos.estoque} onChange={(e) => setCampos({ ...campos, estoque: e.target.value })} inputMode="decimal" placeholder="ex: 30" />
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">Estoque mínimo</span>
          <input value={campos.estoque_minimo} onChange={(e) => setCampos({ ...campos, estoque_minimo: e.target.value })} inputMode="decimal" placeholder="ex: 5" />
        </div>
      </div>
      <span className="label">Foto (link, opcional)</span>
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <img className="product-thumb" src={campos.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', background: 'var(--panel-2)' }} />
        <input style={{ flex: 1 }} value={campos.foto_url} onChange={(e) => setCampos({ ...campos, foto_url: e.target.value })} placeholder="https://..." />
      </div>
    </>
  );
}

function ProdutosLista({ categorias }) {
  const [produtos, setProdutos] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [campos, setCampos] = useState(campoVazio(null));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase.from('produtos').select('*').order('nome');
    setProdutos(data || []);
  }

  async function adicionar(e) {
    e.preventDefault();
    setErro('');
    const dados = validar(campos, setErro);
    if (!dados) return;
    setSalvando(true);
    const { error } = await supabase.from('produtos').insert(dados);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setCampos(campoVazio(null));
    setMostrarForm(false);
    carregar();
  }

  function editar(p) {
    setEditandoId(p.id);
    setCampos(campoVazio(p));
    setErro('');
  }

  async function salvarEdicao(id) {
    setErro('');
    const dados = validar(campos, setErro);
    if (!dados) return;
    setSalvando(true);
    const original = produtos.find((p) => p.id === id);
    const { error } = await supabase.from('produtos').update(dados).eq('id', id);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    if (original && Number(original.preco) !== dados.preco) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        usuario_id: user.id,
        acao: 'alterar_preco',
        detalhes: { produto: dados.nome, preco_antigo: Number(original.preco), preco_novo: dados.preco },
      });
    }
    setEditandoId(null);
    carregar();
  }

  async function alternarAtivo(p) {
    await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id);
    carregar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!mostrarForm ? (
        <button type="button" className="btn btn-primary btn-block" onClick={() => { setCampos(campoVazio(null)); setMostrarForm(true); }}>
          Novo produto
        </button>
      ) : (
        <form onSubmit={adicionar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Novo produto</div>
          <CamposProduto campos={campos} setCampos={setCampos} categorias={categorias} />
          {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {produtos === null ? (
        <p className="muted">Carregando…</p>
      ) : produtos.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="list">
          {produtos.map((p) => {
            if (editandoId === p.id) {
              return (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <CamposProduto campos={campos} setCampos={setCampos} categorias={categorias} />
                  {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditandoId(null)}>
                      Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={salvando} onClick={() => salvarEdicao(p.id)}>
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </div>
              );
            }
            const semControle = p.estoque === null;
            const baixo = !semControle && p.estoque_minimo != null && Number(p.estoque) <= Number(p.estoque_minimo);
            const categoria = categorias.find((c) => c.id === p.categoria_id);
            return (
              <div key={p.id} className="card row" style={{ opacity: p.ativo ? 1 : 0.5 }}>
                <img className="product-thumb" src={p.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', background: 'var(--panel-2)' }} />
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <div>
                    {p.nome} {categoria && <span className="muted" style={{ fontSize: 11 }}>({categoria.nome})</span>}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2, color: baixo ? 'var(--danger)' : 'var(--text-dim)' }}>
                    {semControle ? 'Sem controle de estoque' : `Estoque: ${p.estoque}${baixo ? ' — repor logo' : ''}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tabular" style={{ fontWeight: 600 }}>
                    {p.preco_promocional ? (
                      <>
                        <span className="muted" style={{ textDecoration: 'line-through', fontSize: 12 }}>{money(p.preco)}</span> {money(p.preco_promocional)}
                      </>
                    ) : (
                      money(p.preco)
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => alternarAtivo(p)}>
                      {p.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => editar(p)}>
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
