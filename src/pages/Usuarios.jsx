import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
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
  const [empresaId, setEmpresaId] = useState(null);
  const [convidando, setConvidando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const [usuariosResp, empresaResp] = await Promise.all([
      supabase.from('usuarios').select('*').order('criado_em'),
      supabase.from('usuarios').select('empresa_id').limit(1).maybeSingle(),
    ]);
    setUsuarios(usuariosResp.data || []);
    setEmpresaId(empresaResp.data?.empresa_id || null);
  }

  if (convidando) {
    return <ConvidarUsuario onVoltar={() => setConvidando(false)} onConvidado={() => { setConvidando(false); carregar(); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setConvidando(true)}>
        Convidar usuário
      </button>

      {empresaId && <LinkAcesso empresaId={empresaId} />}
      {empresaId && <TaxaServico empresaId={empresaId} />}

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
                    <div className="muted" style={{ fontSize: 12 }}>{u.login_tipo === 'pin' ? 'Acesso por PIN' : u.email}</div>
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

function LinkAcesso({ empresaId }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/garcom/${empresaId}`;

  async function copiar() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Link de acesso do estabelecimento</div>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 8px' }}>
        Deixe esse link salvo no celular/tablet do balcão — quem abrir escolhe entre entrar como admin (e-mail e senha) ou como garçom (escolhe o nome na lista e digita o PIN).
      </p>
      <div className="row" style={{ gap: 8 }}>
        <input value={link} readOnly style={{ flex: 1, fontSize: 12.5 }} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={copiar}>
          <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function TaxaServico({ empresaId }) {
  const [percentual, setPercentual] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    supabase
      .from('empresas')
      .select('taxa_servico_percentual')
      .eq('id', empresaId)
      .maybeSingle()
      .then(({ data }) => {
        setPercentual(String(data?.taxa_servico_percentual ?? 10));
        setCarregado(true);
      });
  }, [empresaId]);

  async function salvar(e) {
    e.preventDefault();
    const valor = Number(percentual.replace(',', '.'));
    if (!(valor >= 0)) return;
    setSalvando(true);
    await supabase.from('empresas').update({ taxa_servico_percentual: valor }).eq('id', empresaId);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (!carregado) return null;

  return (
    <form onSubmit={salvar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Taxa de serviço</div>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        Percentual sugerido na hora de fechar a conta (o garçom pode desativar por venda, na tela de pagamento). Deixe 0 pra não cobrar.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <input value={percentual} onChange={(e) => setPercentual(e.target.value.replace(/[^\d,.-]/g, ''))} inputMode="decimal" style={{ width: 90 }} />
        <span className="muted">%</span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando} style={{ marginLeft: 'auto' }}>
          {salvando ? 'Salvando…' : salvo ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </form>
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
  const [tipo, setTipo] = useState('garcom');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [pin, setPin] = useState('');
  const [confirmarPin, setConfirmarPin] = useState('');
  const [permissoes, setPermissoes] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function alternar(chave) {
    setPermissoes((p) => ({ ...p, [chave]: !p[chave] }));
  }

  async function convidar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) {
      setErro('Informe o nome.');
      return;
    }

    let corpo;
    if (tipo === 'garcom') {
      if (!/^\d{6}$/.test(pin)) {
        setErro('O PIN precisa ter exatamente 6 dígitos.');
        return;
      }
      if (pin !== confirmarPin) {
        setErro('Os PINs não são iguais.');
        return;
      }
      corpo = { nome: nome.trim(), tipo: 'garcom', pin };
    } else {
      if (!email.trim() || senha.length < 6) {
        setErro('Preencha email e uma senha com pelo menos 6 caracteres.');
        return;
      }
      corpo = { nome: nome.trim(), email: email.trim(), senha, role: 'gerente', permissoes };
    }

    setEnviando(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const resposta = await fetch('/api/convidar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(corpo),
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

      <div className="tab-row">
        <button type="button" className="tab" aria-pressed={tipo === 'garcom'} onClick={() => setTipo('garcom')}>
          Garçom (PIN)
        </button>
        <button type="button" className="tab" aria-pressed={tipo === 'gerente'} onClick={() => setTipo('gerente')}>
          Gerente (e-mail)
        </button>
      </div>

      {tipo === 'garcom' ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João" />
          <span className="label">PIN (6 dígitos)</span>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" />
          <span className="label">Confirmar PIN</span>
          <input value={confirmarPin} onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" />
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            O garçom entra pelo link da lista de garçons (veja abaixo) escolhendo o nome e digitando esse PIN — sem precisar de e-mail.
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
            <span className="label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="label">Senha provisória</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
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
        </>
      )}
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Convidando…' : 'Convidar'}
      </button>
    </form>
  );
}
