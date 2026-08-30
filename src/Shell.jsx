import { useEffect, useState } from 'react';
import {
  BarChart3,
  Boxes,
  ChefHat,
  History,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Percent,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from './supabase';
import { Centro } from './App';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Promocoes from './pages/Promocoes';
import Pdv from './pages/Pdv';
import Mesas from './pages/Mesas';
import Cozinha from './pages/Cozinha';
import Clientes from './pages/Clientes';
import Estoque from './pages/Estoque';
import Caixa from './pages/Caixa';
import Usuarios from './pages/Usuarios';
import Relatorios from './pages/Relatorios';
import Notificacoes from './pages/Notificacoes';
import Auditoria from './pages/Auditoria';

// Cada módulo diz quais papéis podem vê-lo (seção 10 do documento):
// admin enxerga tudo; gerente não mexe em usuários; operador só vende e
// atende (PDV/Mesas/Cozinha/Clientes).
const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, papeis: ['admin', 'gerente'] },
  { id: 'pdv', label: 'PDV', icon: ShoppingCart, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'mesas', label: 'Mesas', icon: LayoutGrid, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'cozinha', label: 'Cozinha', icon: ChefHat, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'produtos', label: 'Produtos', icon: Package, papeis: ['admin', 'gerente'] },
  { id: 'promocoes', label: 'Promoções', icon: Percent, papeis: ['admin', 'gerente'] },
  { id: 'clientes', label: 'Clientes', icon: Users, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'estoque', label: 'Estoque', icon: Boxes, papeis: ['admin', 'gerente'] },
  { id: 'caixa', label: 'Caixa', icon: Wallet, papeis: ['admin', 'gerente'] },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, papeis: ['admin', 'gerente'] },
  { id: 'usuarios', label: 'Usuários', icon: UserCog, papeis: ['admin'] },
  { id: 'auditoria', label: 'Auditoria', icon: History, papeis: ['admin'] },
];

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(undefined); // undefined = carregando, null = sem linha em usuarios
  const [aba, setAba] = useState('dashboard');
  const [sidebarAberta, setSidebarAberta] = useState(false);

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

  return (
    <div className="app-shell">
      <div className={'sidebar-overlay' + (sidebarAberta ? ' is-open' : '')} onClick={() => setSidebarAberta(false)} />

      <aside className={'sidebar' + (sidebarAberta ? ' is-open' : '')}>
        <div className="sidebar__brand">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar__brand-nome">{perfil.empresas.nome}</div>
            <div className="sidebar__brand-cargo">{perfil.nome} · {perfil.role}</div>
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
          <button type="button" className="sidebar__sair" onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="sidebar-toggle" onClick={() => setSidebarAberta(true)}>
              <Menu size={18} />
            </button>
            <h1 style={{ fontSize: 16 }}>{moduloAtivo?.label}</h1>
          </div>
          {(perfil.role === 'admin' || perfil.role === 'gerente') && <Notificacoes />}
        </header>

        <main style={{ flex: 1, padding: 16 }}>
          {abaAtiva === 'dashboard' && <Dashboard />}
          {abaAtiva === 'pdv' && <Pdv />}
          {abaAtiva === 'mesas' && <Mesas />}
          {abaAtiva === 'cozinha' && <Cozinha />}
          {abaAtiva === 'produtos' && <Produtos />}
          {abaAtiva === 'promocoes' && <Promocoes />}
          {abaAtiva === 'clientes' && <Clientes />}
          {abaAtiva === 'estoque' && <Estoque />}
          {abaAtiva === 'caixa' && <Caixa />}
          {abaAtiva === 'relatorios' && <Relatorios />}
          {abaAtiva === 'usuarios' && <Usuarios />}
          {abaAtiva === 'auditoria' && <Auditoria />}
        </main>
      </div>
    </div>
  );
}
