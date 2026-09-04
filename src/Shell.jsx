import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  ChefHat,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Table2,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from './supabase';
import { Centro } from './App';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Mesas from './pages/Mesas';
import Cozinha from './pages/Cozinha';
import Clientes from './pages/Clientes';
import Caixa from './pages/Caixa';
import Usuarios from './pages/Usuarios';
import Relatorios from './pages/Relatorios';
import Notificacoes from './pages/Notificacoes';
import Auditoria from './pages/Auditoria';
import PosPago from './pages/PosPago';
import Reservas from './pages/Reservas';

// Cada módulo diz quais papéis podem vê-lo (seção 10 do documento):
// garçom (operador, login por PIN) só vende e atende (PDV/Mesas/Cozinha/
// Clientes); admin e gerente enxergam toda a gestão, menos as telas de
// venda em si — quem vende é o garçom.
const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, papeis: ['admin', 'gerente'] },
  { id: 'pdv', label: 'PDV', icon: ShoppingCart, papeis: ['operador'] },
  { id: 'caixa', label: 'Caixa', icon: Wallet, papeis: ['admin', 'gerente'] },
  { id: 'produtos', label: 'Cardápio', icon: Package, papeis: ['admin', 'gerente'] },
  { id: 'pospago', label: 'Mapa de Mesas', icon: Table2, papeis: ['admin'] },
  { id: 'cozinha', label: 'Painel de Pedidos', icon: ChefHat, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'reservas', label: 'Reservas', icon: CalendarClock, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'clientes', label: 'Clientes', icon: Users, papeis: ['admin', 'gerente'] },
  { id: 'usuarios', label: 'Usuários', icon: UserCog, papeis: ['admin'] },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, papeis: ['admin', 'gerente'] },
  { id: 'auditoria', label: 'Auditoria', icon: History, papeis: ['admin'] },
];

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(undefined); // undefined = carregando, null = sem linha em usuarios
  const [aba, setAba] = useState('dashboard');
  const [sidebarAberta, setSidebarAberta] = useState(false);
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
          {abaAtiva === 'cozinha' && <Cozinha />}
          {abaAtiva === 'produtos' && <Produtos />}
          {abaAtiva === 'pospago' && <PosPago />}
          {abaAtiva === 'reservas' && <Reservas />}
          {abaAtiva === 'clientes' && <Clientes />}
          {abaAtiva === 'caixa' && <Caixa />}
          {abaAtiva === 'relatorios' && <Relatorios />}
          {abaAtiva === 'usuarios' && <Usuarios />}
          {abaAtiva === 'auditoria' && <Auditoria />}
        </main>
      </div>
    </div>
  );
}
