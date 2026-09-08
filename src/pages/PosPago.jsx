import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import IconeMesa from '../components/IconeMesa';
import { conectarMaquininha, dispositivoSalvo, estornarUltimaTransacao, listarAparelhosPareados, pagarNaMaquininha, suportaPagamentoPagBank } from '../utils/pagbank';

// preco_unitario de um item já vem com os complementos somados (pra fechar
// a conta certo) — aqui a gente quer mostrar o produto pelo preço dele
// sozinho, com cada complemento discriminado embaixo com o preço próprio.
function precoBaseSemComplementos(precoUnitario, complementos) {
  const totalComplementos = (complementos || []).reduce((s, c) => s + Number(c.preco), 0);
  return Number(precoUnitario) - totalComplementos;
}

const STATUS_LABEL = { livre: 'Livre', ocupada: 'Ocupada', reservada: 'Reservada' };
const STATUS_CHIP = { livre: 'chip-success', ocupada: 'chip-danger', reservada: 'chip-primary' };
const STATUS_COR = { livre: 'var(--success, #2f9e5f)', ocupada: 'var(--danger)', reservada: 'var(--primary)' };

export default function PosPago() {
  const [mesas, setMesas] = useState(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mesaVendo, setMesaVendo] = useState(null);

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
    carregar();
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
    carregar();
  }

  function comecarEdicao(m) {
    setEditandoId(m.id);
    setNomeEditado(m.nome);
    setErro('');
  }

  async function salvarNome(id) {
    if (!nomeEditado.trim()) return;
    setEnviando(true);
    setErro('');
    const { error } = await supabase.from('mesas').update({ nome: nomeEditado.trim() }).eq('id', id);
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditandoId(null);
    carregar();
  }

  async function remover(id) {
    await supabase.from('mesas').delete().eq('id', id);
    carregar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row" style={{ padding: '14px 16px', background: 'var(--gradient-primary)', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <IconeMesa size={18} />
          Cadastre aqui as mesas que o garçom vai usar no mapa de mesas do PDV.
        </span>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <form onSubmit={adicionar} className="row" style={{ gap: 8 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mesa 7" style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}><Plus size={14} /> Adicionar</button>
        </form>
        <form onSubmit={criarVarias} className="row" style={{ gap: 8 }}>
          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Quantidade de mesas"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={enviando}>Criar várias</button>
        </form>
      </div>
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      {mesas === null ? (
        <p className="muted">Carregando…</p>
      ) : mesas.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa cadastrada ainda.</p>
      ) : (
        <div className="list">
          {mesas.map((m) =>
            editandoId === m.id ? (
              <div key={m.id} className="card row" style={{ alignItems: 'center', gap: 8 }}>
                <input value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} style={{ flex: 1 }} autoFocus />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => salvarNome(m.id)}>Salvar</button>
              </div>
            ) : (
              <div
                key={m.id}
                className="card row"
                style={{ alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => setMesaVendo(m)}
                title="Ver consumo da mesa"
              >
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, background: STATUS_COR[m.status] || 'var(--text-dim)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <IconeMesa size={16} />
                </div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{m.nome}</span>
                <span className={'chip ' + (STATUS_CHIP[m.status] || 'chip-danger')}>{STATUS_LABEL[m.status] || m.status}</span>
                {m.status !== 'livre' && (
                  <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <Eye size={15} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); comecarEdicao(m); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, marginLeft: 8 }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remover(m.id); }}
                  disabled={m.status !== 'livre'}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: m.status === 'livre' ? 'pointer' : 'not-allowed', opacity: m.status === 'livre' ? 1 : 0.35, padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      <TesteMaquininha />

      {mesaVendo && <ConsumoMesaModal mesa={mesaVendo} onFechar={() => setMesaVendo(null)} />}
    </div>
  );
}

function ConsumoMesaModal({ mesa, onFechar }) {
  const [pedido, setPedido] = useState(undefined); // undefined = carregando, null = sem comanda aberta

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa.id]);

  async function carregar() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nome), pedido_rodadas(*, pedido_itens(*), usuarios(nome))')
      .eq('mesa_id', mesa.id)
      .in('status', ['aberto', 'fechado'])
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPedido(data || null);
  }

  const rodadas = pedido?.pedido_rodadas || [];
  const total = rodadas.reduce(
    (s, r) => s + r.pedido_itens.filter((i) => !i.cancelado).reduce((s2, i) => s2 + i.quantidade * i.preco_unitario, 0),
    0
  );

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 700 }}>Consumo — {mesa.nome}</span>
          <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
            <X size={16} />
          </button>
        </div>

        {pedido === undefined ? (
          <p className="muted" style={{ fontSize: 13 }}>Carregando…</p>
        ) : pedido === null ? (
          <p className="muted" style={{ fontSize: 13 }}>Nenhuma comanda aberta nessa mesa.</p>
        ) : (
          <>
            {pedido.clientes?.nome && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Cliente: {pedido.clientes.nome}</p>}
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Aberta às {new Date(pedido.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>

            <div className="list" style={{ maxHeight: 340, overflowY: 'auto', marginTop: 8 }}>
              {rodadas.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Nenhum item lançado ainda.</p>
              ) : (
                rodadas.map((r) => (
                  <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {new Date(r.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {r.usuarios?.nome || 'Operador'}
                    </span>
                    {r.pedido_itens.map((i) => (
                      <div key={i.id} style={{ padding: '2px 0', opacity: i.cancelado ? 0.5 : 1 }}>
                        <div className="row" style={{ fontSize: 13 }}>
                          <span style={{ textDecoration: i.cancelado ? 'line-through' : 'none' }}>
                            {i.quantidade}x {i.nome_produto}{i.cancelado ? ' (cancelado)' : ''}
                          </span>
                          <span className="tabular">{money(i.quantidade * precoBaseSemComplementos(i.preco_unitario, i.complementos))}</span>
                        </div>
                        {(i.complementos || []).map((c, idx) => (
                          <div key={idx} className="row" style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 14 }}>
                            <span>+ {c.nome}</span>
                            <span className="tabular">{money(Number(c.preco) * i.quantidade)}</span>
                          </div>
                        ))}
                        {(i.observacoes || []).map((g, idx) => (
                          <div key={idx} className="muted" style={{ fontSize: 11, paddingLeft: 14 }}>
                            {g.titulo}: {g.opcoes.join(', ')}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="row" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 8, marginTop: 8 }}>
              <span style={{ fontWeight: 700 }}>Total consumido</span>
              <span className="tabular" style={{ fontWeight: 800, fontSize: 17 }}>{money(total)}</span>
            </div>
          </>
        )}

        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// tipos de transação suportados pelo terminal, na ordem que aparecem no
// seletor do painel de teste — é aqui que a homologação PagBank (que pede
// os logs de cada tipo pra validar a integração) faz os testes de verdade.
const TIPOS_TESTE = [
  { valor: 'credito', label: 'Crédito' },
  { valor: 'debito', label: 'Débito' },
  { valor: 'pix', label: 'Pix' },
];

function TesteMaquininha() {
  const [dispositivo, setDispositivo] = useState(() => dispositivoSalvo());
  const [valor, setValor] = useState('1.00');
  const [tipo, setTipo] = useState('credito');
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pareados, setPareados] = useState(null);
  const [log, setLog] = useState(null);

  const suportado = suportaPagamentoPagBank();

  async function listarPareados() {
    setOcupado(true);
    setErro('');
    setStatus('Buscando aparelhos pareados...');
    try {
      const lista = await listarAparelhosPareados();
      setPareados(lista);
      setStatus(lista.length ? '' : 'Nenhum aparelho pareado. Pareie a Moderninha no Bluetooth do celular primeiro.');
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function conectar() {
    if (!dispositivo.trim()) return;
    setOcupado(true);
    setErro('');
    setStatus('Conectando por Bluetooth...');
    try {
      const resultado = await conectarMaquininha(dispositivo.trim());
      setStatus(resultado.sucesso ? 'Conectado!' : `Falha ao conectar (código ${resultado.codigo}).`);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function pagar() {
    const valorNum = Number(valor.replace(',', '.'));
    if (!(valorNum > 0)) return;
    setOcupado(true);
    setErro('');
    setLog(null);
    setStatus(tipo === 'pix' ? 'Aguardando o Pix na maquininha...' : 'Aguardando o cartão na maquininha...');
    try {
      const resultado = await pagarNaMaquininha(valorNum, tipo, 'TESTE');
      setStatus(resultado.sucesso ? `Pagamento aprovado! ID ${resultado.transacaoId}` : `Recusado: ${resultado.mensagem}`);
      setLog({ tipo, valor: valorNum, dataHora: new Date().toISOString(), ...resultado });
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function estornar() {
    setOcupado(true);
    setErro('');
    setStatus('Estornando a última transação...');
    try {
      const resultado = await estornarUltimaTransacao();
      setStatus(resultado.sucesso ? 'Estornado!' : `Falha: ${resultado.mensagem}`);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Testar maquininha PagBank (Bluetooth)</div>
      {!suportado && (
        <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>
          Isso só funciona dentro do app Android empacotado (Capacitor) — não funciona aqui no navegador.
        </p>
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={listarPareados} disabled={!suportado || ocupado}>
        Listar aparelhos pareados
      </button>
      {pareados && pareados.length > 0 && (
        <div className="list">
          {pareados.map((d) => (
            <div
              key={d.mac}
              className="item"
              style={{ cursor: 'pointer', alignItems: 'center' }}
              onClick={() => setDispositivo(d.nome || d.mac)}
            >
              <span style={{ flex: 1 }}>{d.nome || '(sem nome)'}</span>
              <span className="muted" style={{ fontSize: 12 }}>{d.mac}</span>
            </div>
          ))}
        </div>
      )}

      <span className="label">Nome Bluetooth da maquininha (toque num item da lista acima, ou digite)</span>
      <input value={dispositivo} onChange={(e) => setDispositivo(e.target.value)} placeholder="P2_XXXXXXXX" disabled={!suportado} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={conectar} disabled={!suportado || ocupado || !dispositivo.trim()}>
        Conectar
      </button>

      <span className="label">Valor de teste (R$)</span>
      <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" disabled={!suportado} />

      <span className="label">Tipo de transação</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {TIPOS_TESTE.map((t) => (
          <button
            key={t.valor}
            type="button"
            className={`btn btn-sm ${tipo === t.valor ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setTipo(t.valor)}
            disabled={!suportado}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={pagar} disabled={!suportado || ocupado}>
          Cobrar no {TIPOS_TESTE.find((t) => t.valor === tipo)?.label.toLowerCase()}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={estornar} disabled={!suportado || ocupado}>
          Estornar última
        </button>
      </div>

      {status && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{status}</p>}
      {erro && <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>{erro}</p>}

      {log && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label">Log da transação (envie esse texto pra PagBank)</span>
          <textarea
            readOnly
            rows={7}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            value={JSON.stringify(log, null, 2)}
            onClick={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  );
}
