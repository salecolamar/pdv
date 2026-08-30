import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const PERMISSOES = [
  ['realizar_vendas', 'Realizar vendas'],
  ['cancelar_venda', 'Cancelar venda'],
  ['alterar_precos', 'Alterar preços'],
  ['dar_desconto', 'Dar desconto'],
  ['visualizar_faturamento', 'Visualizar faturamento'],
  ['alterar_estoque', 'Alterar estoque'],
];

const ROLE_LABEL = { admin: 'Admin', gerente: 'Gerente', operador: 'Operador' };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState(null);
  const [convidando, setConvidando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase.from('usuarios').select('*').order('criado_em');
    setUsuarios(data || []);
  }

  if (convidando) {
    return <ConvidarUsuario onVoltar={() => setConvidando(false)} onConvidado={() => { setConvidando(false); carregar(); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setConvidando(true)}>
        Convidar usuário
      </button>

      {usuarios === null ? (
        <p className="muted">Carregando…</p>
      ) : (
        <div className="list">
          {usuarios.map((u) =>
            editandoId === u.id ? (
              <EditarUsuario key={u.id} usuario={u} onCancelar={() => setEditandoId(null)} onSalvo={() => { setEditandoId(null); carregar(); }} />
            ) : (
              <div key={u.id} className="card">
                <div className="row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.nome}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                  </div>
                  <span className="chip chip-primary">{ROLE_LABEL[u.role] || u.role}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  {!u.ativo && <span className="danger-text" style={{ fontSize: 12 }}>Inativo</span>}
                  {u.role !== 'admin' && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditandoId(u.id)}>
                      Editar
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function EditarUsuario({ usuario, onCancelar, onSalvo }) {
  const [role, setRole] = useState(usuario.role);
  const [ativo, setAtivo] = useState(usuario.ativo);
  const [permissoes, setPermissoes] = useState(usuario.permissoes || {});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function alternar(chave) {
    setPermissoes((p) => ({ ...p, [chave]: !p[chave] }));
  }

  async function salvar() {
    setEnviando(true);
    setErro('');
    const { error } = await supabase.from('usuarios').update({ role, ativo, permissoes }).eq('id', usuario.id);
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onSalvo();
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 700 }}>{usuario.nome}</div>
      <span className="label">Papel</span>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="gerente">Gerente</option>
        <option value="operador">Operador</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 4 }}>
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Ativo
      </label>
      <span className="label" style={{ marginTop: 4 }}>Permissões</span>
      {PERMISSOES.map(([chave, label]) => (
        <label key={chave} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={!!permissoes[chave]} onChange={() => alternar(chave)} />
          {label}
        </label>
      ))}
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={enviando} onClick={salvar}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function ConvidarUsuario({ onVoltar, onConvidado }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('operador');
  const [permissoes, setPermissoes] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function alternar(chave) {
    setPermissoes((p) => ({ ...p, [chave]: !p[chave] }));
  }

  async function convidar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      setErro('Preencha nome, email e uma senha com pelo menos 6 caracteres.');
      return;
    }
    setEnviando(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const resposta = await fetch('/api/convidar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ nome: nome.trim(), email: email.trim(), senha, role, permissoes }),
    });
    const resultado = await resposta.json();
    setEnviando(false);
    if (!resposta.ok) {
      setErro(resultado.error || 'Não foi possível convidar esse usuário.');
      return;
    }
    onConvidado();
  }

  return (
    <form onSubmit={convidar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        Voltar
      </button>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="label">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
        <span className="label">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <span className="label">Senha provisória</span>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <span className="label">Papel</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="operador">Operador</option>
          <option value="gerente">Gerente</option>
        </select>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="label">Permissões</span>
        {PERMISSOES.map(([chave, label]) => (
          <label key={chave} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={!!permissoes[chave]} onChange={() => alternar(chave)} />
            {label}
          </label>
        ))}
      </div>
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Convidando…' : 'Convidar'}
      </button>
    </form>
  );
}
