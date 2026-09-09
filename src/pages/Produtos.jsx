import { useEffect, useState } from 'react';
import EstadoVazio, { Carregando } from '../components/EstadoVazio';
import * as XLSX from 'xlsx';
import { Camera, Copy, FileSpreadsheet, Pencil, Plus, PlusCircle, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import Promocoes from './Promocoes';
import Estoque from './Estoque';
import Cardapios from './Cardapios';

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
          Cardápio
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'categorias'} onClick={() => setAba('categorias')}>
          Categorias
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'cardapios'} onClick={() => setAba('cardapios')}>
          Cardápios
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'complementos'} onClick={() => setAba('complementos')}>
          Complementos
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'promocoes'} onClick={() => setAba('promocoes')}>
          Promoções
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'estoque'} onClick={() => setAba('estoque')}>
          Estoque
        </button>
      </div>
      {aba === 'categorias' ? (
        <Categorias categorias={categorias} onMudou={carregarCategorias} />
      ) : aba === 'cardapios' ? (
        <Cardapios />
      ) : aba === 'complementos' ? (
        <Complementos />
      ) : aba === 'promocoes' ? (
        <Promocoes />
      ) : aba === 'estoque' ? (
        <Estoque />
      ) : (
        <ProdutosLista categorias={categorias || []} onCategoriasAtualizadas={carregarCategorias} />
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
        <Carregando />
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

function Complementos() {
  const [complementos, setComplementos] = useState(null);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [precoEditado, setPrecoEditado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase.from('complementos').select('*').order('nome');
    setComplementos(data || []);
  }

  async function adicionar(e) {
    e.preventDefault();
    setErro('');
    const precoNum = Number(preco.replace(',', '.'));
    if (!nome.trim() || !(precoNum >= 0)) {
      setErro('Preencha o nome e um preço válido.');
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from('complementos').insert({ nome: nome.trim(), preco: precoNum });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNome('');
    setPreco('');
    carregar();
  }

  function editar(c) {
    setEditandoId(c.id);
    setNomeEditado(c.nome);
    setPrecoEditado(String(c.preco));
    setErro('');
  }

  async function salvarEdicao(id) {
    const precoNum = Number(precoEditado.replace(',', '.'));
    if (!nomeEditado.trim() || !(precoNum >= 0)) {
      setErro('Preencha o nome e um preço válido.');
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from('complementos').update({ nome: nomeEditado.trim(), preco: precoNum }).eq('id', id);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditandoId(null);
    carregar();
  }

  async function alternarAtivo(c) {
    await supabase.from('complementos').update({ ativo: !c.ativo }).eq('id', c.id);
    carregar();
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esse complemento? Ele sai de todos os produtos que o usam.')) return;
    await supabase.from('complementos').delete().eq('id', id);
    carregar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row" style={{ padding: '14px 16px', background: 'var(--gradient-primary)', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <PlusCircle size={18} />
          Cadastre aqui os adicionais (ex: bacon extra, queijo extra) — na edição de cada produto você escolhe quais desses valem pra ele.
        </span>
      </div>

      <form onSubmit={adicionar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {erro && <p className="danger-text" style={{ fontSize: 13, margin: 0 }}>{erro}</p>}
        <div className="row" style={{ gap: 8 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Bacon extra" style={{ flex: 1 }} />
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="Preço" style={{ width: 100 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </form>

      {complementos === null ? (
        <Carregando />
      ) : complementos.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum complemento cadastrado ainda.</p>
      ) : (
        <div className="list">
          {complementos.map((c) =>
            editandoId === c.id ? (
              <div key={c.id} className="card row" style={{ gap: 8 }}>
                <input value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} style={{ flex: 1 }} autoFocus />
                <input value={precoEditado} onChange={(e) => setPrecoEditado(e.target.value)} inputMode="decimal" style={{ width: 100 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={salvando} onClick={() => salvarEdicao(c.id)}>Salvar</button>
              </div>
            ) : (
              <div key={c.id} className="card row" style={{ alignItems: 'center', gap: 10, opacity: c.ativo ? 1 : 0.55 }}>
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, background: c.ativo ? 'var(--primary)' : 'var(--text-dim)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <PlusCircle size={16} />
                </div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{c.nome}</span>
                <span className="tabular" style={{ fontWeight: 600 }}>+ {money(c.preco)}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => alternarAtivo(c)}>
                  {c.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => editar(c)}>
                  <Pencil size={13} />
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => excluir(c.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function campoVazio(produto) {
  return {
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    observacoes: produto?.observacoes || '',
    preco: produto ? String(produto.preco) : '',
    preco_promocional: produto?.preco_promocional != null ? String(produto.preco_promocional) : '',
    categoria_id: produto?.categoria_id || '',
    sku: produto?.sku || '',
    estoque: produto?.estoque != null ? String(produto.estoque) : '',
    estoque_minimo: produto?.estoque_minimo != null ? String(produto.estoque_minimo) : '',
    unidade: produto?.unidade || 'un',
    foto_url: produto?.foto_url || '',
    ativo: produto?.ativo ?? true,
    grupos_observacao: produto?.grupos_observacao?.length ? produto.grupos_observacao : [],
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
    observacoes: campos.observacoes.trim() || null,
    preco,
    preco_promocional: precoPromo,
    categoria_id: campos.categoria_id || null,
    sku: campos.sku.trim() || null,
    estoque,
    estoque_minimo: estoqueMinimo,
    unidade: campos.unidade.trim() || 'un',
    foto_url: campos.foto_url.trim() || null,
    ativo: campos.ativo,
    grupos_observacao: (campos.grupos_observacao || [])
      .map((g) => ({ titulo: g.titulo.trim(), opcoes: g.opcoes.map((o) => o.trim()).filter(Boolean) }))
      .filter((g) => g.titulo && g.opcoes.length > 0),
  };
}

function CamposProduto({ campos, setCampos, categorias }) {
  const grupos = campos.grupos_observacao || [];

  function atualizarGrupos(novosGrupos) {
    setCampos({ ...campos, grupos_observacao: novosGrupos });
  }

  function adicionarGrupo() {
    atualizarGrupos([...grupos, { titulo: '', opcoes: [''] }]);
  }

  function removerGrupo(idx) {
    atualizarGrupos(grupos.filter((_, i) => i !== idx));
  }

  function atualizarTituloGrupo(idx, titulo) {
    atualizarGrupos(grupos.map((g, i) => (i === idx ? { ...g, titulo } : g)));
  }

  function adicionarOpcao(idx) {
    atualizarGrupos(grupos.map((g, i) => (i === idx ? { ...g, opcoes: [...g.opcoes, ''] } : g)));
  }

  function atualizarOpcao(idxGrupo, idxOpcao, valor) {
    atualizarGrupos(
      grupos.map((g, i) => (i === idxGrupo ? { ...g, opcoes: g.opcoes.map((o, j) => (j === idxOpcao ? valor : o)) } : g))
    );
  }

  function removerOpcao(idxGrupo, idxOpcao) {
    atualizarGrupos(grupos.map((g, i) => (i === idxGrupo ? { ...g, opcoes: g.opcoes.filter((_, j) => j !== idxOpcao) } : g)));
  }

  return (
    <>
      <div className="form-secao">
        <span className="form-secao__titulo">Informações</span>
        <div>
          <span className="label" style={{ marginTop: 0 }}>Nome</span>
          <input value={campos.nome} onChange={(e) => setCampos({ ...campos, nome: e.target.value })} placeholder="Coca Cola Zero Lata" />
        </div>
        <div>
          <span className="label">Descrição (opcional)</span>
          <input value={campos.descricao} onChange={(e) => setCampos({ ...campos, descricao: e.target.value })} />
        </div>
        <div>
          <span className="label">Observação (uso interno, não aparece pro cliente)</span>
          <input value={campos.observacoes} onChange={(e) => setCampos({ ...campos, observacoes: e.target.value })} placeholder="Ex: sem estoque às segundas" />
        </div>
      </div>

      <div className="form-secao">
        <span className="form-secao__titulo">Preço e categoria</span>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginTop: 0 }}>Preço (R$)</span>
            <input value={campos.preco} onChange={(e) => setCampos({ ...campos, preco: e.target.value })} inputMode="decimal" placeholder="8" />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginTop: 0 }}>Preço promocional</span>
            <input value={campos.preco_promocional} onChange={(e) => setCampos({ ...campos, preco_promocional: e.target.value })} inputMode="decimal" placeholder="opcional" />
          </div>
        </div>
        <div>
          <span className="label">Categoria</span>
          <select value={campos.categoria_id} onChange={(e) => setCampos({ ...campos, categoria_id: e.target.value })}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-secao">
        <span className="form-secao__titulo">Estoque</span>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginTop: 0 }}>SKU (opcional)</span>
            <input value={campos.sku} onChange={(e) => setCampos({ ...campos, sku: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginTop: 0 }}>Unidade</span>
            <input value={campos.unidade} onChange={(e) => setCampos({ ...campos, unidade: e.target.value })} placeholder="un" />
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginTop: 0 }}>Estoque (vazio = sem controle)</span>
            <input value={campos.estoque} onChange={(e) => setCampos({ ...campos, estoque: e.target.value })} inputMode="decimal" placeholder="ex: 30" />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginTop: 0 }}>Estoque mínimo</span>
            <input value={campos.estoque_minimo} onChange={(e) => setCampos({ ...campos, estoque_minimo: e.target.value })} inputMode="decimal" placeholder="ex: 5" />
          </div>
        </div>
      </div>

      <div className="form-secao">
        <span className="form-secao__titulo">Observações (sem custo, pro cliente escolher)</span>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Ex: título "Escolha seu molho" com as opções Ketchup, Mostarda, Maionese — o garçom marca as escolhidas ao lançar o item.
        </p>
        {grupos.map((g, idxGrupo) => (
          <div key={idxGrupo} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--panel-2)' }}>
            <div className="row" style={{ gap: 6 }}>
              <input
                style={{ flex: 1 }}
                value={g.titulo}
                onChange={(e) => atualizarTituloGrupo(idxGrupo, e.target.value)}
                placeholder="Título, ex: Escolha seu molho"
              />
              <button type="button" onClick={() => removerGrupo(idxGrupo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', flexShrink: 0 }} title="Remover grupo">
                <Trash2 size={15} />
              </button>
            </div>
            {g.opcoes.map((op, idxOpcao) => (
              <div key={idxOpcao} className="row" style={{ gap: 6, paddingLeft: 14 }}>
                <input
                  style={{ flex: 1 }}
                  value={op}
                  onChange={(e) => atualizarOpcao(idxGrupo, idxOpcao, e.target.value)}
                  placeholder="Opção, ex: Ketchup"
                />
                <button type="button" onClick={() => removerOpcao(idxGrupo, idxOpcao)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0 }} title="Remover opção">
                  <X size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginLeft: 14 }} onClick={() => adicionarOpcao(idxGrupo)}>
              <Plus size={13} /> Opção
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={adicionarGrupo}>
          <Plus size={13} /> Grupo de observação
        </button>
      </div>

      <div className="form-secao">
        <span className="form-secao__titulo">Foto</span>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <img className="product-thumb" src={campos.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', background: 'var(--panel-2)', flexShrink: 0 }} />
          <input style={{ flex: 1 }} value={campos.foto_url} onChange={(e) => setCampos({ ...campos, foto_url: e.target.value })} placeholder="https://..." />
        </div>
      </div>
    </>
  );
}

function ProdutosLista({ categorias, onCategoriasAtualizadas }) {
  const [produtos, setProdutos] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importandoFoto, setImportandoFoto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [campos, setCampos] = useState(campoVazio(null));
  const [complementos, setComplementos] = useState([]);
  const [complementosDisponiveis, setComplementosDisponiveis] = useState([]);
  const [selecionados, setSelecionados] = useState(new Set());
  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
    supabase.from('complementos').select('*').eq('ativo', true).order('nome').then(({ data }) => setComplementosDisponiveis(data || []));
  }, []);

  async function carregar() {
    const { data } = await supabase.from('produtos').select('*').order('nome');
    setProdutos(data || []);
  }

  function alternarSelecionado(id) {
    setSelecionados((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Excluir ${selecionados.size} produto(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    setExcluindoSelecionados(true);
    const { error } = await supabase.from('produtos').delete().in('id', [...selecionados]);
    setExcluindoSelecionados(false);
    if (error) {
      window.alert('Falha ao excluir: ' + error.message);
      return;
    }
    setSelecionados(new Set());
    carregar();
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

  async function duplicar(p) {
    const copia = { ...p };
    delete copia.id;
    delete copia.criado_em;
    copia.nome = `${p.nome} (cópia)`;
    const { error } = await supabase.from('produtos').insert(copia);
    if (error) {
      window.alert('Falha ao duplicar: ' + error.message);
      return;
    }
    carregar();
  }

  async function editar(p) {
    setEditandoId(p.id);
    setCampos(campoVazio(p));
    setErro('');
    const { data } = await supabase.from('produto_complementos').select('complemento_id').eq('produto_id', p.id);
    setComplementos((data || []).map((c) => c.complemento_id));
  }

  function alternarComplemento(produtoId) {
    setComplementos((atual) => (atual.includes(produtoId) ? atual.filter((id) => id !== produtoId) : [...atual, produtoId]));
  }

  async function salvarEdicao(id) {
    setErro('');
    const dados = validar(campos, setErro);
    if (!dados) return;
    setSalvando(true);
    const original = produtos.find((p) => p.id === id);
    const { error } = await supabase.from('produtos').update(dados).eq('id', id);
    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }
    await supabase.from('produto_complementos').delete().eq('produto_id', id);
    if (complementos.length > 0) {
      await supabase.from('produto_complementos').insert(complementos.map((complemento_id) => ({ produto_id: id, complemento_id })));
    }
    setSalvando(false);
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

  if (importando) {
    return (
      <ImportarProdutos
        categorias={categorias}
        onVoltar={() => setImportando(false)}
        onImportado={() => {
          setImportando(false);
          onCategoriasAtualizadas();
          carregar();
        }}
      />
    );
  }

  if (importandoFoto) {
    return (
      <ImportarProdutosPorFoto
        categorias={categorias}
        onVoltar={() => setImportandoFoto(false)}
        onImportado={() => {
          setImportandoFoto(false);
          onCategoriasAtualizadas();
          carregar();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!mostrarForm ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" style={{ flex: '1 1 160px' }} onClick={() => { setCampos(campoVazio(null)); setMostrarForm(true); }}>
            <Plus size={15} /> Novo produto
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => setImportando(true)}>
            <FileSpreadsheet size={15} /> Importar
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => setImportandoFoto(true)}>
            <Camera size={15} /> Importar por foto
          </button>
        </div>
      ) : null}

      {selecionados.size > 0 && (
        <div className="card row" style={{ padding: '10px 14px', background: 'var(--danger)', color: '#fff' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selecionados.size} produto(s) selecionado(s)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => setSelecionados(new Set())}>
              Limpar
            </button>
            <button type="button" className="btn btn-sm" style={{ background: '#fff', color: 'var(--danger)', fontWeight: 700 }} disabled={excluindoSelecionados} onClick={excluirSelecionados}>
              <Trash2 size={13} /> {excluindoSelecionados ? 'Excluindo…' : 'Excluir selecionados'}
            </button>
          </div>
        </div>
      )}

      {mostrarForm && (
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
        <Carregando />
      ) : produtos.length === 0 ? (
        <EstadoVazio
          icon={UtensilsCrossed}
          titulo="Nenhum produto cadastrado ainda"
          texto="Adicione manualmente em “Novo produto” ou importe o cardápio de uma vez (planilha ou foto) usando os botões acima."
        />
      ) : (
        <ProdutosPorCategoria
          produtos={produtos}
          categorias={categorias}
          editandoId={editandoId}
          campos={campos}
          setCampos={setCampos}
          complementos={complementos}
          complementosDisponiveis={complementosDisponiveis}
          onAlternarComplemento={alternarComplemento}
          selecionados={selecionados}
          onAlternarSelecionado={alternarSelecionado}
          erro={erro}
          salvando={salvando}
          onCancelarEdicao={() => setEditandoId(null)}
          onSalvarEdicao={salvarEdicao}
          onAlternarAtivo={alternarAtivo}
          onEditar={editar}
          onDuplicar={duplicar}
        />
      )}
    </div>
  );
}

function ProdutosPorCategoria({
  produtos,
  categorias,
  editandoId,
  campos,
  setCampos,
  complementos,
  complementosDisponiveis,
  onAlternarComplemento,
  selecionados,
  onAlternarSelecionado,
  erro,
  salvando,
  onCancelarEdicao,
  onSalvarEdicao,
  onAlternarAtivo,
  onEditar,
  onDuplicar,
}) {
  const grupos = [...categorias.map((c) => ({ id: c.id, nome: c.nome })), { id: null, nome: 'Sem categoria' }]
    .map((c) => ({ ...c, itens: produtos.filter((p) => (p.categoria_id || null) === c.id) }))
    .filter((g) => g.itens.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {grupos.map((grupo) => (
        <div key={grupo.id || 'sem-categoria'}>
          <div className="dash-card-titulo" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <UtensilsCrossed size={14} /> {grupo.nome} <span className="muted" style={{ fontWeight: 400, textTransform: 'none' }}>({grupo.itens.length})</span>
          </div>
          <div className="list">
            {grupo.itens.map((p) => {
              if (editandoId === p.id) {
                return (
                  <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <CamposProduto campos={campos} setCampos={setCampos} categorias={categorias} />
                    <span className="label" style={{ marginTop: 6 }}>Complementos (cadastrados na aba Complementos)</span>
                    {complementosDisponiveis.length === 0 ? (
                      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Nenhum complemento cadastrado ainda — crie na aba "Complementos".</p>
                    ) : (
                      <div className="list" style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {complementosDisponiveis.map((op) => (
                          <label key={op.id} className="item" style={{ cursor: 'pointer', alignItems: 'center' }}>
                            <span style={{ flex: 1 }}>{op.nome}</span>
                            <span className="tabular muted" style={{ fontSize: 12 }}>+ {money(op.preco)}</span>
                            <input
                              type="checkbox"
                              checked={complementos.includes(op.id)}
                              onChange={() => onAlternarComplemento(op.id)}
                              style={{ marginLeft: 10 }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancelarEdicao}>
                        Cancelar
                      </button>
                      <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={salvando} onClick={() => onSalvarEdicao(p.id)}>
                        {salvando ? 'Salvando…' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                );
              }
              const semControle = p.estoque === null;
              const baixo = !semControle && p.estoque_minimo != null && Number(p.estoque) <= Number(p.estoque_minimo);
              return (
                <div key={p.id} className="card row" style={{ opacity: p.ativo ? 1 : 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.id)}
                    onChange={() => onAlternarSelecionado(p.id)}
                    style={{ marginRight: 2, flexShrink: 0 }}
                  />
                  <img className="product-thumb" src={p.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', background: 'var(--panel-2)', flexShrink: 0 }} />
                  <div style={{ flex: '1 1 160px', paddingRight: 8, minWidth: 0 }}>
                    <div>{p.nome}</div>
                    <div style={{ fontSize: 12, marginTop: 2, color: baixo ? 'var(--danger)' : 'var(--text-dim)' }}>
                      {semControle ? 'Sem controle de estoque' : `Estoque: ${p.estoque}${baixo ? ' — repor logo' : ''}`}
                    </div>
                  </div>
                  <div className="tabular" style={{ fontWeight: 600, flex: '0 0 auto' }}>
                    {p.preco_promocional ? (
                      <>
                        <span className="muted" style={{ textDecoration: 'line-through', fontSize: 12 }}>{money(p.preco)}</span> {money(p.preco_promocional)}
                      </>
                    ) : (
                      money(p.preco)
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 0 auto', width: '100%' }}>
                      <button type="button" className="btn btn-secondary btn-sm" title="Duplicar" onClick={() => onDuplicar(p)}>
                        <Copy size={13} />
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAlternarAtivo(p)}>
                        {p.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEditar(p)}>
                        <Pencil size={13} /> Editar
                      </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizarCabecalho(texto) {
  // Remove acentos sem depender de escrever a faixa Unicode de marcas
  // diacríticas combinantes no código-fonte (0x300-0x36f).
  return Array.from(String(texto).normalize('NFD'))
    .filter((ch) => {
      const codigo = ch.codePointAt(0);
      return codigo < 0x300 || codigo > 0x36f;
    })
    .join('')
    .trim()
    .toUpperCase();
}

function acharCampo(linha, alvos) {
  for (const chave of Object.keys(linha)) {
    if (alvos.includes(normalizarCabecalho(chave))) return linha[chave];
  }
  return undefined;
}

function parsePreco(valor) {
  if (typeof valor === 'number') return valor;
  if (valor == null) return NaN;
  const limpo = String(valor).trim().replace(/[^\d,.-]/g, '').replace(',', '.');
  return limpo ? Number(limpo) : NaN;
}

function analisarLinha(linhaBruta) {
  const nome = String(acharCampo(linhaBruta, ['NOME', 'PRODUTO']) ?? '').trim();
  const precoValor = acharCampo(linhaBruta, ['PRECO', 'VALOR']);
  const preco = parsePreco(precoValor);
  const categoria = String(acharCampo(linhaBruta, ['CATEGORIA']) ?? '').trim();

  if (!nome) return { nome, preco, categoria, valido: false, motivo: 'Sem nome' };
  if (!(preco > 0)) return { nome, preco, categoria, valido: false, motivo: 'Preço inválido' };
  return { nome, preco, categoria, valido: true, motivo: '' };
}

// Cria as categorias que ainda não existem e insere os produtos válidos —
// compartilhado entre a importação por planilha e por foto do cardápio.
async function salvarProdutosImportados(categorias, validas) {
  const nomesCategorias = [...new Set(validas.map((l) => l.categoria).filter(Boolean))];
  const mapaCategorias = new Map(categorias.map((c) => [normalizarCabecalho(c.nome), c.id]));
  const categoriasFaltando = nomesCategorias.filter((nome) => !mapaCategorias.has(normalizarCabecalho(nome)));

  if (categoriasFaltando.length > 0) {
    const { data: novasCategorias, error: erroCategorias } = await supabase
      .from('categorias')
      .insert(categoriasFaltando.map((nome) => ({ nome })))
      .select();
    if (erroCategorias) return 'Falha ao criar categorias: ' + erroCategorias.message;
    for (const c of novasCategorias) mapaCategorias.set(normalizarCabecalho(c.nome), c.id);
  }

  const payload = validas.map((l) => ({
    nome: l.nome,
    preco: l.preco,
    categoria_id: l.categoria ? mapaCategorias.get(normalizarCabecalho(l.categoria)) || null : null,
  }));

  const { error: erroProdutos } = await supabase.from('produtos').insert(payload);
  if (erroProdutos) return 'Falha ao importar produtos: ' + erroProdutos.message;
  return null;
}

function ImportarProdutos({ categorias, onVoltar, onImportado }) {
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [linhas, setLinhas] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState('');

  async function selecionarArquivo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro('');
    setLinhas(null);
    setNomeArquivo(arquivo.name);
    setLendo(true);
    try {
      // CSV precisa ser lido como texto (senão o SheetJS não garante UTF-8 e
      // acentos viram lixo); .xlsx/.xls são binários de verdade, lidos como
      // array de bytes.
      const ehCsv = /\.csv$/i.test(arquivo.name) || arquivo.type === 'text/csv';
      const planilha = ehCsv
        ? XLSX.read(await arquivo.text(), { type: 'string' })
        : XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
      const primeiraAba = planilha.Sheets[planilha.SheetNames[0]];
      // raw:false devolve o texto formatado da célula (ex: "12,00"), não o
      // número que o SheetJS às vezes adivinha errado pra formato brasileiro
      // (vírgula como separador de milhar em vez de decimal).
      const linhasBrutas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '', raw: false });
      setLinhas(linhasBrutas.map(analisarLinha));
    } catch {
      setErro('Não foi possível ler esse arquivo. Confira se é um .xlsx, .xls ou .csv válido.');
    } finally {
      setLendo(false);
    }
  }

  async function confirmarImportacao() {
    const validas = linhas.filter((l) => l.valido);
    if (validas.length === 0) return;
    setImportando(true);
    setErro('');
    const erroImportacao = await salvarProdutosImportados(categorias, validas);
    setImportando(false);
    if (erroImportacao) {
      setErro(erroImportacao);
      return;
    }
    onImportado();
  }

  const validas = linhas?.filter((l) => l.valido).length ?? 0;
  const invalidas = (linhas?.length ?? 0) - validas;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        Voltar
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Importar produtos</div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Envie uma planilha (.xlsx, .xls ou .csv) com as colunas <strong>NOME</strong>, <strong>PREÇO</strong> e <strong>CATEGORIA</strong>. Categorias novas são criadas automaticamente.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={selecionarArquivo} />
        {nomeArquivo && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Arquivo: {nomeArquivo}</p>}
      </div>

      {lendo && <p className="muted">Lendo planilha…</p>}
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      {linhas && !lendo && (
        <>
          <div className="card row">
            <span className="success-text" style={{ fontSize: 13 }}>{validas} válido{validas === 1 ? '' : 's'}</span>
            {invalidas > 0 && <span className="danger-text" style={{ fontSize: 13 }}>{invalidas} com erro</span>}
          </div>

          <div className="list" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {linhas.map((l, idx) => (
              <div key={idx} className="item" style={{ opacity: l.valido ? 1 : 0.6 }}>
                <span>
                  {l.nome || <span className="muted">(sem nome)</span>}
                  {l.categoria && <span className="muted" style={{ fontSize: 11 }}> · {l.categoria}</span>}
                </span>
                <span className={l.valido ? 'tabular' : 'danger-text'} style={{ fontSize: 12.5 }}>
                  {l.valido ? money(l.preco) : l.motivo}
                </span>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-primary btn-block" disabled={validas === 0 || importando} onClick={confirmarImportacao}>
            {importando ? 'Importando…' : `Importar ${validas} produto${validas === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </div>
  );
}

function fotoParaBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

function ImportarProdutosPorFoto({ categorias, onVoltar, onImportado }) {
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [itens, setItens] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState('');

  async function selecionarArquivo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro('');
    setItens(null);
    setNomeArquivo(arquivo.name);
    setLendo(true);
    try {
      const base64 = await fotoParaBase64(arquivo);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch('/api/importar-cardapio-foto', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ imagemBase64: base64, mimeType: arquivo.type || 'image/jpeg' }),
      });
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.error || 'Não consegui ler essa foto.');
        return;
      }
      setItens(
        (dados.itens || []).map((i) => ({
          nome: String(i.nome || '').trim(),
          preco: i.preco == null ? NaN : Number(i.preco),
          categoria: String(i.categoria || '').trim(),
        }))
      );
    } catch {
      setErro('Falha ao processar a foto. Tente de novo.');
    } finally {
      setLendo(false);
    }
  }

  function atualizarItem(idx, campo, valor) {
    setItens((atual) => atual.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function removerItem(idx) {
    setItens((atual) => atual.filter((_, i) => i !== idx));
  }

  async function confirmarImportacao() {
    const validas = itens.filter((i) => i.nome && i.preco > 0).map((i) => ({ ...i, valido: true }));
    if (validas.length === 0) return;
    setImportando(true);
    setErro('');
    const erroImportacao = await salvarProdutosImportados(categorias, validas);
    setImportando(false);
    if (erroImportacao) {
      setErro(erroImportacao);
      return;
    }
    onImportado();
  }

  const validos = itens?.filter((i) => i.nome && i.preco > 0).length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        Voltar
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Importar por foto do cardápio</div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Envie uma foto nítida do cardápio. A IA lê os itens automaticamente — confira e corrija antes de importar, já
          que letra apertada ou foto tremida pode confundir a leitura.
        </p>
        <input type="file" accept="image/*" capture="environment" onChange={selecionarArquivo} />
        {nomeArquivo && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Arquivo: {nomeArquivo}</p>}
      </div>

      {lendo && <p className="muted">Lendo a foto com a IA… pode levar alguns segundos.</p>}
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      {itens && !lendo && (
        <>
          {itens.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Não encontrei nenhum item nessa foto.</p>
          ) : (
            <>
              <div className="card row">
                <span className="success-text" style={{ fontSize: 13 }}>{validos} válido{validos === 1 ? '' : 's'}</span>
                {itens.length - validos > 0 && (
                  <span className="danger-text" style={{ fontSize: 13 }}>{itens.length - validos} com erro</span>
                )}
              </div>

              <div className="list" style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itens.map((it, idx) => {
                  const valido = it.nome && it.preco > 0;
                  return (
                    <div key={idx} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, opacity: valido ? 1 : 0.75 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          style={{ flex: 1 }}
                          value={it.nome}
                          placeholder="Nome"
                          onChange={(e) => atualizarItem(idx, 'nome', e.target.value)}
                        />
                        <button type="button" onClick={() => removerItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', flexShrink: 0 }} title="Remover">
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          style={{ width: 90 }}
                          inputMode="decimal"
                          value={Number.isNaN(it.preco) ? '' : it.preco}
                          placeholder="Preço"
                          onChange={(e) => atualizarItem(idx, 'preco', Number(e.target.value.replace(',', '.')))}
                        />
                        <input
                          style={{ flex: 1 }}
                          value={it.categoria}
                          placeholder="Categoria"
                          onChange={(e) => atualizarItem(idx, 'categoria', e.target.value)}
                        />
                      </div>
                      {!valido && <span className="danger-text" style={{ fontSize: 11.5 }}>Falta nome ou preço válido</span>}
                    </div>
                  );
                })}
              </div>

              <button type="button" className="btn btn-primary btn-block" disabled={validos === 0 || importando} onClick={confirmarImportacao}>
                {importando ? 'Importando…' : `Importar ${validos} produto${validos === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
