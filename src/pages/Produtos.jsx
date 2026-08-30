import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import Promocoes from './Promocoes';
import Estoque from './Estoque';

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
        <button type="button" className="tab" aria-pressed={aba === 'promocoes'} onClick={() => setAba('promocoes')}>
          Promoções
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'estoque'} onClick={() => setAba('estoque')}>
          Estoque
        </button>
      </div>
      {aba === 'categorias' ? (
        <Categorias categorias={categorias} onMudou={carregarCategorias} />
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

function ProdutosLista({ categorias, onCategoriasAtualizadas }) {
  const [produtos, setProdutos] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [importando, setImportando] = useState(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!mostrarForm ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setCampos(campoVazio(null)); setMostrarForm(true); }}>
            Novo produto
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setImportando(true)}>
            <Upload size={15} /> Importar
          </button>
        </div>
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

    const nomesCategorias = [...new Set(validas.map((l) => l.categoria).filter(Boolean))];
    const mapaCategorias = new Map(categorias.map((c) => [normalizarCabecalho(c.nome), c.id]));
    const categoriasFaltando = nomesCategorias.filter((nome) => !mapaCategorias.has(normalizarCabecalho(nome)));

    if (categoriasFaltando.length > 0) {
      const { data: novasCategorias, error: erroCategorias } = await supabase
        .from('categorias')
        .insert(categoriasFaltando.map((nome) => ({ nome })))
        .select();
      if (erroCategorias) {
        setErro('Falha ao criar categorias: ' + erroCategorias.message);
        setImportando(false);
        return;
      }
      for (const c of novasCategorias) mapaCategorias.set(normalizarCabecalho(c.nome), c.id);
    }

    const payload = validas.map((l) => ({
      nome: l.nome,
      preco: l.preco,
      categoria_id: l.categoria ? mapaCategorias.get(normalizarCabecalho(l.categoria)) || null : null,
    }));

    const { error: erroProdutos } = await supabase.from('produtos').insert(payload);
    setImportando(false);
    if (erroProdutos) {
      setErro('Falha ao importar produtos: ' + erroProdutos.message);
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
