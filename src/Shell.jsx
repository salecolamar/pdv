import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  ChefHat,
  History,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from './supabase';
import { Centro } from './App';
import IconeMesa from './components/IconeMesa';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Mesas, { HistoricoPDV } from './pages/Mesas';
import Cozinha from './pages/Cozinha';
import Clientes from './pages/Clientes';
import Caixa from './pages/Caixa';
import Usuarios from './pages/Usuarios';
import Relatorios from './pages/Relatorios';
import Notificacoes from './pages/Notificacoes';
import Auditoria from './pages/Auditoria';
import PosPago from './pages/PosPago';
import Reservas from './pages/Reservas';
import Configuracoes from './pages/Configuracoes';
import Ajuda from './pages/Ajuda';

// Cada módulo diz quais papéis podem vê-lo (seção 10 do documento):
// garçom (operador, login por PIN) e gerente (login por e-mail) só
// vendem e atendem — PDV/Histórico/Cozinha/Reservas, com o gerente
// tendo as permissões extras decididas em Usuários. Só admin enxerga o
// painel de gestão (Dashboard/Caixa/Cardápio/Clientes/Relatórios/etc).
const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, papeis: ['admin'] },
  { id: 'pdv', label: 'PDV', icon: ShoppingCart, papeis: ['operador', 'gerente'] },
  { id: 'historico', label: 'Histórico', icon: History, papeis: ['operador', 'gerente'] },
  { id: 'caixa', label: 'Caixa', icon: Wallet, papeis: ['admin'] },
  { id: 'produtos', label: 'Cardápio', icon: Package, papeis: ['admin'] },
  { id: 'pospago', label: 'Mapa de Mesas', icon: IconeMesa, papeis: ['admin'] },
  { id: 'cozinha', label: 'Painel de Pedidos', icon: ChefHat, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'reservas', label: 'Reservas', icon: CalendarClock, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'clientes', label: 'Clientes', icon: Users, papeis: ['admin'] },
  { id: 'usuarios', label: 'Usuários', icon: UserCog, papeis: ['admin'] },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, papeis: ['admin'] },
  { id: 'auditoria', label: 'Auditoria', icon: History, papeis: ['admin'] },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, papeis: ['admin'] },
  { id: 'ajuda', label: 'Suporte', icon: LifeBuoy, papeis: ['admin'] },
];

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(undefined); // undefined = carregando, null = sem linha em usuarios
  const [aba, setAba] = useState('dashboard');
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [caixaInfo, setCaixaInfo] = useState(undefined); // undefined = carregando, null = nenhum aberto
  const [caixaConfirmado, setCaixaConfirmado] = useState(() => sessionStorage.getItem('caixa_confirmado'));
  const [loginEm] = useState(() => {
    const bruto = session.user.last_sign_in_at ? new Date(session.user.last_sign_in_at) : new Date();
    return bruto.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    let cancelado = false;
    supabase
      .from('usuarios')
      .select('*, empresas(*)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          console.error('Falha ao carregar perfil:', error);
          setPerfil(null);
          return;
        }
        setPerfil(data);
      });
    return () => {
      cancelado = true;
    };
  }, [session.user.id]);

  useEffect(() => {
    if (perfil && (perfil.role === 'operador' || perfil.role === 'gerente')) {
      carregarCaixa();
    }
  }, [perfil?.role]);

  async function carregarCaixa() {
    const { data } = await supabase
      .from('caixas')
      .select('*, usuarios!caixas_aberto_por_fkey(nome)')
      .is('fechado_em', null)
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCaixaInfo(data || null);
  }

  if (perfil === undefined) return <Centro>Carregando…</Centro>;
  if (perfil === null) {
    return (
      <Centro>
        <div className="card" style={{ width: 320, textAlign: 'center' }}>
          <p style={{ marginBottom: 12 }}>Não achamos seu cadastro de usuário. Tente sair e criar a empresa de novo.</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </Centro>
    );
  }

  const precisaCaixaAberto = perfil.role === 'operador' || perfil.role === 'gerente';
  const chaveConfirmacao = caixaInfo ? `${caixaInfo.id}_${perfil.id}` : null;

  function entrarNoCaixa() {
    sessionStorage.setItem('caixa_confirmado', chaveConfirmacao);
    setCaixaConfirmado(chaveConfirmacao);
  }

  function sairDoCaixa() {
    sessionStorage.removeItem('caixa_confirmado');
    setCaixaConfirmado(null);
    carregarCaixa();
  }

  if (precisaCaixaAberto) {
    if (caixaInfo === undefined) return <Centro>Carregando…</Centro>;
    if (caixaInfo === null) {
      return (
        <Centro>
          <div className="card" style={{ width: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Wallet size={32} style={{ margin: '0 auto', color: 'var(--text-dim)' }} />
            <p style={{ fontWeight: 700 }}>Nenhum caixa aberto</p>
            <p className="muted" style={{ fontSize: 13 }}>Peça pra um gerente ou administrador abrir o caixa do dia antes de vender.</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => supabase.auth.signOut()}>
              <LogOut size={16} /> Sair
            </button>
          </div>
        </Centro>
      );
    }
    if (caixaConfirmado !== chaveConfirmacao) {
      return (
        <Centro>
          <div className="card" style={{ width: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Wallet size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
            <p style={{ fontWeight: 700 }}>Caixa aberto</p>
            <p className="muted" style={{ fontSize: 13 }}>
              Aberto por {caixaInfo.usuarios?.nome || '—'} às{' '}
              {new Date(caixaInfo.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={entrarNoCaixa}>
              <LogIn size={16} /> Entrar
            </button>
          </div>
        </Centro>
      );
    }
  }

  const modulosVisiveis = MODULOS.filter((m) => m.papeis.includes(perfil.role));
  const abaAtiva = modulosVisiveis.some((m) => m.id === aba) ? aba : modulosVisiveis[0]?.id;
  const moduloAtivo = modulosVisiveis.find((m) => m.id === abaAtiva);

  function irPara(id) {
    setAba(id);
    setSidebarAberta(false);
  }

  async function acessarComoGarcom() {
    const empresaId = perfil.empresas.id;
    await supabase.auth.signOut();
    window.location.href = `/garcom/${empresaId}`;
  }

  return (
    <div className="app-shell">
      <div className={'sidebar-overlay' + (sidebarAberta ? ' is-open' : '')} onClick={() => setSidebarAberta(false)} />

      <aside className={'sidebar' + (sidebarAberta ? ' is-open' : '')}>
        <div className="sidebar__brand">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar__brand-nome">{perfil.empresas.nome}</div>
            <div className="sidebar__brand-cargo">{perfil.nome} · {perfil.role}</div>
            <div className="sidebar__brand-cargo" style={{ opacity: 0.75, fontSize: 11 }}>Login: {loginEm}</div>
          </div>
          <button type="button" className="sidebar-toggle" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={() => setSidebarAberta(false)}>
            <X size={16} />
          </button>
        </div>

        {precisaCaixaAberto && caixaInfo && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, margin: '0 16px 8px', padding: '8px 10px',
              borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 11.5,
            }}
          >
            <Wallet size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
            <span style={{ opacity: 0.92 }}>
              Caixa aberto por <strong>{caixaInfo.usuarios?.nome || '—'}</strong> às{' '}
              {new Date(caixaInfo.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        <nav className="sidebar__nav">
          {modulosVisiveis.map((m) => (
            <button key={m.id} type="button" className={'sidebar__link' + (abaAtiva === m.id ? ' is-active' : '')} onClick={() => irPara(m.id)}>
              <m.icon size={17} />
              {m.label}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          {perfil.role === 'admin' && (
            <button type="button" className="sidebar__sair" onClick={acessarComoGarcom}>
              <UtensilsCrossed size={16} /> Acessar como garçom
            </button>
          )}
          {precisaCaixaAberto && (
            <button type="button" className="sidebar__sair" onClick={sairDoCaixa}>
              <Wallet size={16} /> Sair do caixa
            </button>
          )}
          <button type="button" className="sidebar__sair" onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar" title={moduloAtivo?.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="sidebar-toggle" onClick={() => setSidebarAberta(true)}>
              <Menu size={18} />
            </button>
            <span className="topbar__logo">
              <img src="/brand/logo-three-solutions-full.png" alt="Three Solutions" />
            </span>
          </div>
          {(perfil.role === 'admin' || perfil.role === 'gerente') && <Notificacoes />}
        </header>

        <main className="page-content">
          {abaAtiva === 'dashboard' && <Dashboard />}
          {abaAtiva === 'pdv' && <Mesas />}
          {abaAtiva === 'historico' && <HistoricoPDV />}
          {abaAtiva === 'cozinha' && <Cozinha />}
          {abaAtiva === 'produtos' && <Produtos />}
          {abaAtiva === 'pospago' && <PosPago />}
          {abaAtiva === 'reservas' && <Reservas />}
          {abaAtiva === 'clientes' && <Clientes />}
          {abaAtiva === 'caixa' && <Caixa />}
          {abaAtiva === 'relatorios' && <Relatorios />}
          {abaAtiva === 'usuarios' && <Usuarios />}
          {abaAtiva === 'auditoria' && <Auditoria />}
          {abaAtiva === 'configuracoes' && <Configuracoes />}
          {abaAtiva === 'ajuda' && <Ajuda />}
        </main>
      </div>
    </div>
  );
}
