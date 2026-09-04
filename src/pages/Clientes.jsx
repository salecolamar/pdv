import { useEffect, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { supabase } from '../supabase';
import { money, mascararTelefone, mascararCpf } from '../utils/format';

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase();
}

function AvatarCliente({ nome }) {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'var(--primary)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 13.5,
        flexShrink: 0,
      }}
    >
      {iniciais(nome)}
    </div>
  );
}

function campoVazio(cliente) {
  return {
    nome: cliente?.nome || '',
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    cpf: cliente?.cpf || '',
    nascimento: cliente?.nascimento || '',
    observacoes: cliente?.observacoes || '',
  };
}

export default function Clientes() {
  const [clientes, setClientes] = useState(null);
  const [busca, setBusca] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);
  const [campos, setCampos] = useState(campoVazio(null));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [empresaId, setEmpresaId] = useState(null);
  const [editandoRegra, setEditandoRegra] = useState(false);

  useEffect(() => {
    carregar();
    supabase.from('usuarios').select('empresa_id').limit(1).maybeSingle().then(({ data }) => setEmpresaId(data?.empresa_id || null));
  }, []);

  async function carregar() {
    const { data } = await supabase.from('clientes').select('*').order('nome');
    setClientes(data || []);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!campos.nome.trim()) {
      setErro('Nome é obrigatório.');
      return;
    }
    const dados = {
      nome: campos.nome.trim(),
      telefone: campos.telefone.trim() || null,
      email: campos.email.trim() || null,
      cpf: campos.cpf.trim() || null,
      nascimento: campos.nascimento || null,
      observacoes: campos.observacoes.trim() || null,
    };
    setSalvando(true);
    const { error } = editandoId
      ? await supabase.from('clientes').update(dados).eq('id', editandoId)
      : await supabase.from('clientes').insert(dados);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setMostrarForm(false);
    setEditandoId(null);
    setCampos(campoVazio(null));
    carregar();
  }

  function editar(c) {
    setEditandoId(c.id);
    setCampos(campoVazio(c));
    setMostrarForm(true);
    setErro('');
  }

  async function excluir(id) {
    await supabase.from('clientes').delete().eq('id', id);
    carregar();
  }

  const filtrados = (clientes || []).filter((c) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return c.nome.toLowerCase().includes(termo) || (c.telefone || '').includes(termo);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!mostrarForm ? (
        <>
          <div className="card row" style={{ padding: '14px 16px', background: 'linear-gradient(135deg, var(--primary), #6C3CE0)', color: '#fff' }}>
            <p style={{ fontSize: 12.5, margin: 0, opacity: 0.92 }}>
              <strong>★ Programa de fidelidade:</strong> cada cliente ganha pontos por R$ gasto em vendas vinculadas a ele. Resgate os pontos no cartão do cliente quando ele trocar por desconto/brinde no balcão.
            </p>
            <button type="button" className="btn btn-sm" style={{ flexShrink: 0, background: '#fff', color: 'var(--primary)', fontWeight: 700 }} onClick={() => setEditandoRegra(true)}>
              <Star size={14} /> Regra
            </button>
          </div>
          {editandoRegra && empresaId && <RegraFidelidade empresaId={empresaId} onFechar={() => setEditandoRegra(false)} />}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" style={{ paddingLeft: 34 }} />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setEditandoId(null);
              setCampos(campoVazio(null));
              setMostrarForm(true);
            }}
          >
            Novo cliente
          </button>
        </>
      ) : (
        <form onSubmit={salvar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{editandoId ? 'Editar cliente' : 'Novo cliente'}</div>
          <span className="label">Nome</span>
          <input value={campos.nome} onChange={(e) => setCampos({ ...campos, nome: e.target.value })} placeholder="Nome completo" />
          <span className="label">Telefone</span>
          <input value={campos.telefone} onChange={(e) => setCampos({ ...campos, telefone: mascararTelefone(e.target.value) })} inputMode="numeric" placeholder="(11) 99999-9999" />
          <span className="label">E-mail (opcional)</span>
          <input value={campos.email} onChange={(e) => setCampos({ ...campos, email: e.target.value })} type="email" />
          <span className="label">CPF (opcional)</span>
          <input value={campos.cpf} onChange={(e) => setCampos({ ...campos, cpf: mascararCpf(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" />
          <span className="label">Data de nascimento (opcional)</span>
          <input value={campos.nascimento} onChange={(e) => setCampos({ ...campos, nascimento: e.target.value })} type="date" />
          <span className="label">Observações (opcional)</span>
          <input value={campos.observacoes} onChange={(e) => setCampos({ ...campos, observacoes: e.target.value })} />
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

      {clientes === null ? (
        <p className="muted">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>{clientes.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado.'}</p>
      ) : (
        <div className="list">
          {filtrados.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              expandido={expandidoId === c.id}
              onExpandir={() => setExpandidoId(expandidoId === c.id ? null : c.id)}
              onEditar={() => editar(c)}
              onExcluir={() => excluir(c.id)}
              onMudou={carregar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClienteCard({ cliente, expandido, onExpandir, onEditar, onExcluir, onMudou }) {
  const [historico, setHistorico] = useState(null);
  const [resgatando, setResgatando] = useState(false);
  const [pontosResgate, setPontosResgate] = useState('');
  const [enviandoResgate, setEnviandoResgate] = useState(false);
  const [erroResgate, setErroResgate] = useState('');

  useEffect(() => {
    if (!expandido || historico !== null) return;
    supabase
      .from('vendas')
      .select('id, total, criado_em, cancelada')
      .eq('cliente_id', cliente.id)
      .eq('cancelada', false)
      .order('criado_em', { ascending: false })
      .then(({ data }) => setHistorico(data || []));
  }, [expandido, cliente.id, historico]);

  const totalGasto = historico?.reduce((s, v) => s + Number(v.total), 0) || 0;
  const numeroCompras = historico?.length || 0;
  const ultimaCompra = historico?.[0]?.criado_em;
  const pontos = cliente.pontos_fidelidade || 0;

  async function confirmarResgate() {
    setErroResgate('');
    const n = Number(pontosResgate);
    if (!(n > 0)) {
      setErroResgate('Informe uma quantidade de pontos válida.');
      return;
    }
    setEnviandoResgate(true);
    const { error } = await supabase.rpc('resgatar_pontos_fidelidade', { p_cliente_id: cliente.id, p_pontos: n });
    setEnviandoResgate(false);
    if (error) {
      setErroResgate(error.message.replace('P0001: ', ''));
      return;
    }
    setResgatando(false);
    setPontosResgate('');
    onMudou();
  }

  return (
    <div className="card">
      <div className="row" style={{ cursor: 'pointer', gap: 10 }} onClick={onExpandir}>
        <AvatarCliente nome={cliente.nome} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{cliente.nome}</div>
          <div className="muted" style={{ fontSize: 12 }}>{cliente.telefone || 'sem telefone'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip chip-primary" title="Pontos de fidelidade">★ {pontos}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onEditar(); }}>
            Editar
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onExcluir(); }}>
            Excluir
          </button>
        </div>
      </div>
      {expandido && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
            <span className="muted">Pontos de fidelidade</span>
            <span className="tabular" style={{ fontWeight: 700 }}>★ {pontos}</span>
          </div>
          <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
            <span className="muted">Aniversário</span>
            <span>{cliente.nascimento ? new Date(cliente.nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
          </div>
          <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
            <span className="muted">CPF</span>
            <span>{cliente.cpf || '—'}</span>
          </div>
          <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
            <span className="muted">E-mail</span>
            <span>{cliente.email || '—'}</span>
          </div>
          {historico === null ? (
            <p className="muted" style={{ fontSize: 13 }}>Carregando histórico…</p>
          ) : (
            <>
              <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="muted">Total gasto</span>
                <span className="tabular" style={{ fontWeight: 700 }}>{money(totalGasto)}</span>
              </div>
              <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="muted">Compras</span>
                <span>{numeroCompras}</span>
              </div>
              {ultimaCompra && (
                <div className="row" style={{ fontSize: 13, marginBottom: 6 }}>
                  <span className="muted">Última compra</span>
                  <span>{new Date(ultimaCompra).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {numeroCompras === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Nenhuma compra registrada ainda.</p>
              ) : (
                <div className="list" style={{ marginTop: 6, marginBottom: 10 }}>
                  {historico.map((v) => (
                    <div className="item" key={v.id}>
                      <span>{new Date(v.criado_em).toLocaleDateString('pt-BR')}</span>
                      <span className="tabular">{money(v.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {resgatando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <span className="label">Quantos pontos resgatar? (saldo: {pontos})</span>
              <input value={pontosResgate} onChange={(e) => setPontosResgate(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Ex: 50" />
              {erroResgate && <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>{erroResgate}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setResgatando(false); setErroResgate(''); }}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={enviandoResgate} onClick={confirmarResgate}>
                  {enviandoResgate ? 'Resgatando…' : 'Confirmar resgate'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm btn-block" disabled={pontos === 0} onClick={() => setResgatando(true)}>
              Resgatar pontos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegraFidelidade({ empresaId, onFechar }) {
  const [pontosPorReal, setPontosPorReal] = useState('1');
  const [valorPorPonto, setValorPorPonto] = useState('0.10');
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase
      .from('empresas')
      .select('fidelidade_pontos_por_real, fidelidade_valor_por_ponto')
      .eq('id', empresaId)
      .maybeSingle()
      .then(({ data }) => {
        setPontosPorReal(String(data?.fidelidade_pontos_por_real ?? 1));
        setValorPorPonto(String(data?.fidelidade_valor_por_ponto ?? 0.1));
        setCarregado(true);
      });
  }, [empresaId]);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    const pontos = Number(pontosPorReal.replace(',', '.'));
    const valor = Number(valorPorPonto.replace(',', '.'));
    if (!(pontos >= 0) || !(valor >= 0)) {
      setErro('Informe valores válidos (podem ser 0, mas não negativos).');
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from('empresas')
      .update({ fidelidade_pontos_por_real: pontos, fidelidade_valor_por_ponto: valor })
      .eq('id', empresaId);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (!carregado) return <p className="muted" style={{ fontSize: 13 }}>Carregando…</p>;

  return (
    <form onSubmit={salvar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row">
        <div style={{ fontWeight: 700 }}>Regra de fidelidade</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onFechar}>
          Fechar
        </button>
      </div>

      <span className="label">Pontos ganhos por R$1 gasto</span>
      <input value={pontosPorReal} onChange={(e) => setPontosPorReal(e.target.value)} inputMode="decimal" placeholder="Ex: 1" />
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Ex: 1 = ganha 1 ponto a cada R$1; 0,5 = 1 ponto a cada R$2 gastos.
      </p>

      <span className="label" style={{ marginTop: 6 }}>Valor de cada ponto no resgate (R$)</span>
      <input value={valorPorPonto} onChange={(e) => setValorPorPonto(e.target.value)} inputMode="decimal" placeholder="Ex: 0.10" />
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Só uma referência pro garçom saber quanto de desconto dar no balcão ao resgatar — o sistema não aplica esse desconto sozinho.
      </p>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="submit" className="btn btn-primary btn-sm" disabled={salvando} style={{ marginTop: 6 }}>
        {salvando ? 'Salvando…' : salvo ? 'Salvo!' : 'Salvar regra'}
      </button>
    </form>
  );
}
