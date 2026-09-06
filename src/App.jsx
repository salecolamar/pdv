import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UserCog, UtensilsCrossed } from 'lucide-react';
import { supabase } from './supabase';
import Shell from './Shell';
import AcessoEmpresa, { AcessoGarcom } from './pages/AcessoEmpresa';
import EscolhaCard from './components/EscolhaCard';

const ROTA_ACESSO_EMPRESA = window.location.pathname.match(/^\/garcom\/([0-9a-f-]{36})$/i);

// Cliques na logo pra revelar o cadastro de estabelecimento — não é
// segurança de verdade (roda no navegador do usuário), só evita que
// alguém esbarre no formulário de criar empresa por acidente. Configurável
// via variável de ambiente pra não deixar a senha só no código-fonte.
const SENHA_CADASTRO = import.meta.env.VITE_SENHA_CADASTRO_EMPRESA || 'appvia2026';
const CLIQUES_PARA_REVELAR = 6;

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = carregando, null = deslogado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <Centro>Carregando…</Centro>;
  }

  if (!session) {
    return ROTA_ACESSO_EMPRESA ? <AcessoEmpresa empresaId={ROTA_ACESSO_EMPRESA[1]} /> : <Auth />;
  }

  return <PosLogin session={session} />;
}

export function Centro({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--text-dim)' }}>
      {children}
    </div>
  );
}

// Assim que a sessão do admin/gerente é confirmada, oferece a mesma escolha
// que já existe no link público /garcom/<empresa> (seção 18 do documento:
// "escolher qual garçom" antes de operar) — útil quando o mesmo
// tablet/computador é usado ora pelo dono, ora por um garçom. Um garçom que
// já logou por PIN (role operador) não vê essa tela, vai direto pro PDV.
function PosLogin({ session }) {
  const [perfil, setPerfil] = useState(undefined);
  const [modo, setModo] = useState(null); // null | 'admin' | 'garcom' | 'gerente'
  const chaveEscolha = `pdv_modo_${session.user.id}`;

  useEffect(() => {
    let cancelado = false;
    supabase
      .from('usuarios')
      .select('id, nome, role, empresa_id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setPerfil(data || null);
      });
    return () => {
      cancelado = true;
    };
  }, [session.user.id]);

  if (perfil === undefined) return <Centro>Carregando…</Centro>;

  // Sem linha em `usuarios`, é garçom (já escolheu ao logar por PIN), ou
  // gerente (só tem um jeito de usar o app — direto pro PDV, sem escolha):
  // segue direto, sem essa tela extra.
  if (!perfil || perfil.role === 'operador' || perfil.role === 'gerente') {
    return <Shell session={session} />;
  }

  const escolhaSalva = modo || sessionStorage.getItem(chaveEscolha);

  if (escolhaSalva === 'admin') {
    return <Shell session={session} />;
  }

  if (escolhaSalva === 'garcom' || escolhaSalva === 'gerente') {
    return (
      <AcessoGarcom
        empresaId={perfil.empresa_id}
        tipoInicial={escolhaSalva === 'gerente' ? 'gerente' : 'operador'}
        onVoltar={() => {
          sessionStorage.removeItem(chaveEscolha);
          setModo(null);
        }}
      />
    );
  }

  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <LogoAppVia />
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Como você quer usar esse aparelho?</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EscolhaCard
            icon={UtensilsCrossed}
            titulo="Entrar como garçom"
            descricao="Escolher seu nome + PIN pra vender"
            onClick={() => {
              sessionStorage.setItem(chaveEscolha, 'garcom');
              setModo('garcom');
            }}
          />
          <EscolhaCard
            icon={UserCog}
            titulo="Entrar como gerente"
            descricao="Escolher seu nome + PIN pra vender"
            onClick={() => {
              sessionStorage.setItem(chaveEscolha, 'gerente');
              setModo('gerente');
            }}
          />
          <EscolhaCard
            icon={ShieldCheck}
            titulo={`Continuar como ${perfil.nome}`}
            descricao="Acesso total ao portal de gestão"
            onClick={() => {
              sessionStorage.setItem(chaveEscolha, 'admin');
              setModo('admin');
            }}
          />
        </div>
      </div>
    </Centro>
  );
}

function LogoAppVia({ onCliques }) {
  return (
    <button
      type="button"
      onClick={onCliques}
      style={{
        background: 'none',
        border: 'none',
        cursor: onCliques ? 'pointer' : 'default',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: '100%',
      }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="appviaGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2E9EF5" />
            <stop offset="1" stopColor="#6C3CE0" />
          </linearGradient>
        </defs>
        <rect x="14" y="4" width="20" height="34" rx="6" stroke="url(#appviaGrad)" strokeWidth="2.4" />
        <line x1="21" y1="10" x2="27" y2="10" stroke="url(#appviaGrad)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19 21l-4 4 4 4" stroke="url(#appviaGrad)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M29 21l4 4-4 4" stroke="url(#appviaGrad)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="26" y1="19" x2="22" y2="31" stroke="url(#appviaGrad)" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="36" y="10" width="5" height="5" rx="1.2" fill="#6C3CE0" opacity="0.85" />
        <rect x="40" y="17" width="4" height="4" rx="1" fill="#6C3CE0" opacity="0.55" />
      </svg>
      <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>
        <span style={{ color: 'var(--text)' }}>App</span>
        <span
          style={{
            background: 'linear-gradient(135deg, #2E9EF5, #6C3CE0)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Via
        </span>
      </span>
    </button>
  );
}

function Auth() {
  const cliquesRef = useRef(0);
  const timeoutRef = useRef(null);
  const [revelado, setRevelado] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  function registrarClique() {
    cliquesRef.current += 1;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      cliquesRef.current = 0;
    }, 2500);
    if (cliquesRef.current >= CLIQUES_PARA_REVELAR) {
      cliquesRef.current = 0;
      setRevelado(true);
    }
  }

  function confirmarSenha(e) {
    e.preventDefault();
    if (senha === SENHA_CADASTRO) {
      setCadastrando(true);
      setErroSenha('');
    } else {
      setErroSenha('Senha incorreta.');
      setSenha('');
    }
  }

  if (cadastrando) {
    return (
      <Centro>
        <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 18 }}>Cadastrar estabelecimento</h1>
          </div>
          <FormularioCriarEmpresa />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCadastrando(false); setRevelado(false); setSenha(''); }}>
            Voltar
          </button>
        </div>
      </Centro>
    );
  }

  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <LogoAppVia onCliques={registrarClique} />
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Sistema de vendas para bares, restaurantes e eventos.</p>
        </div>

        {revelado ? (
          <form onSubmit={confirmarSenha} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">Senha de cadastro</span>
            <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="••••••••" autoFocus />
            {erroSenha && <p className="danger-text" style={{ fontSize: 13, marginTop: 8 }}>{erroSenha}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setRevelado(false); setSenha(''); setErroSenha(''); }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Confirmar
              </button>
            </div>
          </form>
        ) : (
          <FormularioEntrar />
        )}
      </div>
    </Centro>
  );
}

export function FormularioEntrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) setErro('E-mail ou senha incorretos.');
  }

  return (
    <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="label">E-mail</span>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="voce@empresa.com" autoComplete="username" />
      <span className="label">Senha</span>
      <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="••••••••" autoComplete="current-password" />
      {erro && <p className="danger-text" style={{ fontSize: 13, marginTop: 8 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

function FormularioCriarEmpresa() {
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [categoria, setCategoria] = useState('Bar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    if (!email.trim()) {
      setErro('Informe um e-mail.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setEnviando(true);

    const { data: signUpData, error: erroSignUp } = await supabase.auth.signUp({ email: email.trim(), password: senha });
    if (erroSignUp) {
      setErro(erroSignUp.message.includes('already registered') ? 'Esse e-mail já está cadastrado.' : erroSignUp.message);
      setEnviando(false);
      return;
    }
    if (!signUpData.session) {
      // Projeto Supabase com confirmação de e-mail ligada: precisa desativar
      // em Authentication -> Providers -> Email -> "Confirm email" pro
      // cadastro entrar direto, sem depender de clicar num link no e-mail.
      setErro('Conta criada, mas o Supabase está pedindo confirmação por e-mail. Desative "Confirm email" nas configurações do projeto e tente entrar de novo.');
      setEnviando(false);
      return;
    }

    // Gera o id no navegador em vez de pedir pro banco devolver a linha
    // criada (.select()): nesse instante o usuário ainda não tem uma linha
    // em `usuarios`, então a política de leitura de `empresas` (que depende
    // de já pertencer a uma empresa) ainda não consegue confirmar que essa
    // linha é dele — e o Postgres rejeita o INSERT inteiro por causa disso.
    const empresaId = crypto.randomUUID();
    const { error: erroEmpresa } = await supabase
      .from('empresas')
      .insert({ id: empresaId, nome: nomeEmpresa.trim() || 'Minha Empresa', categoria: categoria.trim() || 'Bar' });
    if (erroEmpresa) {
      setErro('Falha ao criar a empresa: ' + erroEmpresa.message);
      setEnviando(false);
      return;
    }

    const { error: erroUsuario } = await supabase.from('usuarios').insert({
      id: signUpData.session.user.id,
      empresa_id: empresaId,
      nome: nome.trim() || 'Administrador',
      email: email.trim(),
      role: 'admin',
    });
    if (erroUsuario) {
      setErro('Falha ao criar o usuário: ' + erroUsuario.message);
      setEnviando(false);
      return;
    }
    setEnviando(false);
    // onAuthStateChange já vai atualizar a sessão e trocar de tela sozinho.
  }

  return (
    <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="label">Nome da empresa</span>
      <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Bar do Zé" />
      <span className="label">Categoria</span>
      <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Bar, restaurante, evento…" />
      <span className="label">Seu nome</span>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Zé" />
      <span className="label">E-mail</span>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="voce@empresa.com" autoComplete="username" />
      <span className="label">Senha (mínimo 6 caracteres)</span>
      <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="••••••••" autoComplete="new-password" />
      {erro && <p className="danger-text" style={{ fontSize: 13, marginTop: 8 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={enviando}>
        {enviando ? 'Criando…' : 'Criar empresa'}
      </button>
    </form>
  );
}
