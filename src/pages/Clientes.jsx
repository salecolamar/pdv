import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';

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

  useEffect(() => {
    carregar();
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
          <input value={campos.telefone} onChange={(e) => setCampos({ ...campos, telefone: e.target.value })} placeholder="(11) 99999-9999" />
          <span className="label">E-mail (opcional)</span>
          <input value={campos.email} onChange={(e) => setCampos({ ...campos, email: e.target.value })} type="email" />
          <span className="label">CPF (opcional)</span>
          <input value={campos.cpf} onChange={(e) => setCampos({ ...campos, cpf: e.target.value })} />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClienteCard({ cliente, expandido, onExpandir, onEditar, onExcluir }) {
  const [historico, setHistorico] = useState(null);

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

  return (
    <div className="card">
      <div className="row" style={{ cursor: 'pointer' }} onClick={onExpandir}>
        <div>
          <div style={{ fontWeight: 600 }}>{cliente.nome}</div>
          <div className="muted" style={{ fontSize: 12 }}>{cliente.telefone || 'sem telefone'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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
                <div className="list" style={{ marginTop: 6 }}>
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
        </div>
      )}
    </div>
  );
}
