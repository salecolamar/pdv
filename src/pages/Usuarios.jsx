import { useEffect, useState } from 'react';
import {
  Ban,
  Copy,
  Package,
  Pencil,
  Percent,
  Printer,
  ShieldCheck,
  ShoppingCart,
  Tag,
  TrendingUp,
  UserCog,
  UserPlus,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { supabase } from '../supabase';
import Switch from '../components/Switch';

const PERMISSOES = [
  ['realizar_vendas', 'Realizar vendas', ShoppingCart],
  ['cancelar_venda', 'Cancelar venda ou item lançado errado', Ban],
  ['alterar_precos', 'Alterar preços', Tag],
  ['dar_desconto', 'Dar desconto', Percent],
  ['reimprimir', 'Reimprimir venda em Ficha', Printer],
  ['visualizar_faturamento', 'Visualizar faturamento', TrendingUp],
  ['alterar_estoque', 'Alterar estoque', Package],
];

const ROLE_INFO = {
  admin: { label: 'Admin', icon: ShieldCheck, cor: '#6C3CE0' },
  gerente: { label: 'Gerente', icon: UserCog, cor: 'var(--primary)' },
  operador: { label: 'Garçom', icon: UtensilsCrossed, cor: 'var(--success, #2f9e5f)' },
};

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase();
}

function Avatar({ nome, role, tamanho = 40 }) {
  const info = ROLE_INFO[role] || ROLE_INFO.operador;
  return (
    <div
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: '50%',
        background: info.cor,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: tamanho * 0.36,
        flexShrink: 0,
      }}
    >
      {iniciais(nome)}
    </div>
  );
}

function EscolhaCard({ selecionado, onClick, icon: Icon, titulo, descricao }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: 'left',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 14,
        cursor: 'pointer',
        border: selecionado ? '2px solid var(--primary)' : '1.5px solid var(--border)',
        background: selecionado ? 'color-mix(in srgb, var(--primary) 10%, var(--panel))' : 'var(--panel)',
        transition: 'border-color .15s, background .15s',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: selecionado ? 'var(--primary)' : 'var(--panel-2)',
          color: selecionado ? '#fff' : 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: selecionado ? 'var(--primary)' : 'var(--text)' }}>{titulo}</div>
        {descricao && <div className="muted" style={{ fontSize: 11.5, marginTop: 1, lineHeight: 1.3 }}>{descricao}</div>}
      </div>
    </button>
  );
}

function ListaPermissoes({ permissoes, onAlternar }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 14px' }}>
      {PERMISSOES.map(([chave, label, Icon], idx) => (
        <div
          key={chave}
          className="row"
          style={{ padding: '10px 0', borderTop: idx > 0 ? '1px solid var(--border-soft)' : 'none' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <Icon size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            {label}
          </span>
          <Switch checked={!!permissoes[chave]} onChange={() => onAlternar(chave)} />
        </div>
      ))}
    </div>
  );
}

function PinInput({ value, onChange, autoFocus }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      type="password"
      placeholder="••••••"
      autoFocus={autoFocus}
      style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 700 }}
    />
  );
}

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

  const grupos = ['admin', 'gerente', 'operador']
    .map((role) => ({ role, itens: (usuarios || []).filter((u) => u.role === role) }))
    .filter((g) => g.itens.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setConvidando(true)}>
        <UserPlus size={16} /> Convidar usuário
      </button>

      {empresaId && <LinkAcesso empresaId={empresaId} />}

      {usuarios === null ? (
        <p className="muted">Carregando…</p>
      ) : usuarios.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum usuário cadastrado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grupos.map((grupo) => {
            const info = ROLE_INFO[grupo.role];
            return (
              <div key={grupo.role}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <info.icon size={14} style={{ color: info.cor }} />
                  <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-dim)' }}>
                    {info.label}s
                  </span>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>({grupo.itens.length})</span>
                </div>
                <div className="list">
                  {grupo.itens.map((u) =>
                    editandoId === u.id ? (
                      <EditarUsuario key={u.id} usuario={u} onCancelar={() => setEditandoId(null)} onSalvo={() => { setEditandoId(null); carregar(); }} />
                    ) : (
                      <div key={u.id} className="card row" style={{ opacity: u.ativo ? 1 : 0.55 }}>
                        <Avatar nome={u.nome} role={u.role} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{u.nome}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{u.login_tipo === 'pin' ? 'Acesso por PIN' : u.email}</div>
                        </div>
                        {!u.ativo && <span className="chip chip-danger" style={{ marginRight: 4 }}>Inativo</span>}
                        {u.role !== 'admin' && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditandoId(u.id)}>
                            <Pencil size={13} /> Editar
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
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
    <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), #6C3CE0)', color: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Link de acesso do estabelecimento</div>
      <p style={{ fontSize: 12.5, margin: '0 0 10px', opacity: 0.9 }}>
        Deixe esse link salvo no celular/tablet do balcão — quem abrir escolhe entre entrar como admin (e-mail e senha) ou como garçom (escolhe o nome na lista e digita o PIN).
      </p>
      <div className="row" style={{ gap: 8 }}>
        <input
          value={link}
          readOnly
          style={{ flex: 1, fontSize: 12.5, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn btn-sm" style={{ background: '#fff', color: 'var(--primary)', fontWeight: 700 }} onClick={copiar}>
          <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function EditarUsuario({ usuario, onCancelar, onSalvo }) {
  const [role, setRole] = useState(usuario.role);
  const [ativo, setAtivo] = useState(usuario.ativo);
  const [permissoes, setPermissoes] = useState(usuario.permissoes || {});
  const [comissao, setComissao] = useState(String(usuario.comissao_percentual ?? 0));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function alternar(chave) {
    setPermissoes((p) => ({ ...p, [chave]: !p[chave] }));
  }

  async function salvar() {
    setEnviando(true);
    setErro('');
    const comissaoNum = Number(comissao.replace(',', '.')) || 0;
    const { error } = await supabase.from('usuarios').update({ role, ativo, permissoes, comissao_percentual: comissaoNum }).eq('id', usuario.id);
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onSalvo();
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar nome={usuario.nome} role={role} />
          <div style={{ fontWeight: 800, fontSize: 16 }}>{usuario.nome}</div>
        </div>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
          <X size={18} />
        </button>
      </div>

      <div>
        <span className="label">Papel</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <EscolhaCard selecionado={role === 'gerente'} onClick={() => setRole('gerente')} icon={UserCog} titulo="Gerente" descricao="E-mail, telas do garçom + permissões extras" />
          <EscolhaCard selecionado={role === 'operador'} onClick={() => setRole('operador')} icon={UtensilsCrossed} titulo="Operador" descricao="PIN, vende pelo PDV" />
        </div>
      </div>

      <div className="card row" style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Usuário ativo</span>
        <Switch checked={ativo} onChange={setAtivo} />
      </div>

      <div>
        <span className="label">Comissão sobre vendas (%)</span>
        <input value={comissao} onChange={(e) => setComissao(e.target.value.replace(/[^\d,.-]/g, ''))} inputMode="decimal" placeholder="Ex: 10" />
      </div>

      {(role === 'operador' || role === 'gerente') && (
        <div>
          <span className="label">Cargo (atalho rápido)</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <EscolhaCard
              selecionado={!permissoes.cancelar_venda && !permissoes.dar_desconto}
              onClick={() => setPermissoes({ realizar_vendas: true })}
              icon={UtensilsCrossed}
              titulo="Garçom"
              descricao="Padrão, sem cancelar/dar desconto"
            />
            <EscolhaCard
              selecionado={!!permissoes.cancelar_venda && !!permissoes.dar_desconto}
              onClick={() => setPermissoes({ realizar_vendas: true, cancelar_venda: true, dar_desconto: true, reimprimir: true })}
              icon={UserCog}
              titulo="Gerente"
              descricao="Cancela, dá desconto e reimprime"
            />
          </div>
        </div>
      )}

      <div>
        <span className="label">Permissões</span>
        <div style={{ marginTop: 4 }}>
          <ListaPermissoes permissoes={permissoes} onAlternar={alternar} />
        </div>
      </div>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
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
  const [cargo, setCargo] = useState('garcom');
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
      corpo = { nome: nome.trim(), tipo: 'garcom', pin, cargo };
    } else {
      if (!email.trim() || senha.length < 6) {
        setErro('Preencha email e uma senha com pelo menos 6 caracteres.');
        return;
      }
      corpo = { nome: nome.trim(), email: email.trim(), senha, role: tipo, permissoes: tipo === 'gerente' ? permissoes : {} };
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
    <form onSubmit={convidar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onVoltar}>
          <X size={14} /> Voltar
        </button>
      </div>

      <div>
        <h1 style={{ fontSize: 19, fontWeight: 800 }}>Convidar usuário</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>Escolha como essa pessoa vai entrar no sistema.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <EscolhaCard
          selecionado={tipo === 'garcom'}
          onClick={() => setTipo('garcom')}
          icon={UtensilsCrossed}
          titulo="Garçom"
          descricao="Nome + PIN — só as telas de venda"
        />
        <EscolhaCard
          selecionado={tipo === 'gerente'}
          onClick={() => setTipo('gerente')}
          icon={UserCog}
          titulo="Gerente"
          descricao="E-mail — mesmas telas do garçom, com permissões extras"
        />
        <EscolhaCard
          selecionado={tipo === 'admin'}
          onClick={() => setTipo('admin')}
          icon={ShieldCheck}
          titulo="Admin"
          descricao="E-mail — acesso total ao portal de gestão"
        />
      </div>

      {tipo === 'garcom' ? (
        <>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João" autoFocus />
          </div>

          <div>
            <span className="label">Cargo</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <EscolhaCard
                selecionado={cargo === 'garcom'}
                onClick={() => setCargo('garcom')}
                icon={UtensilsCrossed}
                titulo="Garçom"
                descricao="Padrão — sem cancelar/dar desconto"
              />
              <EscolhaCard
                selecionado={cargo === 'gerente'}
                onClick={() => setCargo('gerente')}
                icon={UserCog}
                titulo="Gerente"
                descricao="Cancela, dá desconto e reimprime"
              />
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span className="label">PIN (6 dígitos)</span>
              <PinInput value={pin} onChange={setPin} />
            </div>
            <div>
              <span className="label">Confirmar PIN</span>
              <PinInput value={confirmarPin} onChange={setConfirmarPin} />
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              O garçom entra pelo link da lista de garçons escolhendo o nome e digitando esse PIN — sem precisar de e-mail.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            <span className="label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            <span className="label">Senha provisória</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </div>

          {tipo === 'gerente' ? (
            <>
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                O gerente acessa as mesmas telas do garçom (PDV, Histórico, Painel de Pedidos, Reservas) — sem acesso ao painel de gestão. Escolha abaixo o que ele pode fazer a mais.
              </p>
              <div>
                <span className="label">Permissões</span>
                <div style={{ marginTop: 4 }}>
                  <ListaPermissoes permissoes={permissoes} onAlternar={alternar} />
                </div>
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Admin tem acesso total ao portal de gestão (Dashboard, Cardápio, Relatórios, Configurações, Usuários, etc).
            </p>
          )}
        </>
      )}

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Convidando…' : 'Convidar'}
      </button>
    </form>
  );
}
