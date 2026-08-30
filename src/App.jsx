import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from './supabase';
import Shell from './Shell';
import AcessoEmpresa from './pages/AcessoEmpresa';

const ROTA_ACESSO_EMPRESA = window.location.pathname.match(/^\/garcom\/([0-9a-f-]{36})$/i);

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

  return <Shell session={session} />;
}

export function Centro({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--text-dim)' }}>
      {children}
    </div>
  );
}

function Auth() {
  const [aba, setAba] = useState('entrar');
  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <Lock size={24} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
          <h1 style={{ fontSize: 20 }}>PDV</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Sistema de vendas para bares, restaurantes e eventos.</p>
        </div>
        <div className="tab-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="tab" aria-pressed={aba === 'entrar'} onClick={() => setAba('entrar')}>
            Entrar
          </button>
          <button type="button" className="tab" aria-pressed={aba === 'criar'} onClick={() => setAba('criar')}>
            Criar empresa
          </button>
        </div>
        {aba === 'entrar' ? <FormularioEntrar /> : <FormularioCriarEmpresa />}
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

