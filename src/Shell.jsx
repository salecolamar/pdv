import { useEffect, useState } from 'react';
import {
  BarChart3,
  Boxes,
  ChefHat,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Package,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase } from './supabase';
import { Centro } from './App';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Pdv from './pages/Pdv';
import Mesas from './pages/Mesas';
import Cozinha from './pages/Cozinha';
import Clientes from './pages/Clientes';
import Estoque from './pages/Estoque';
import Caixa from './pages/Caixa';
import Usuarios from './pages/Usuarios';
import Relatorios from './pages/Relatorios';

// Cada módulo diz quais papéis podem vê-lo (seção 10 do documento):
// admin enxerga tudo; gerente não mexe em usuários; operador só vende e
// atende (PDV/Mesas/Cozinha/Clientes).
const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, papeis: ['admin', 'gerente'] },
  { id: 'pdv', label: 'PDV', icon: ShoppingCart, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'mesas', label: 'Mesas', icon: LayoutGrid, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'cozinha', label: 'Cozinha', icon: ChefHat, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'produtos', label: 'Produtos', icon: Package, papeis: ['admin', 'gerente'] },
  { id: 'clientes', label: 'Clientes', icon: Users, papeis: ['admin', 'gerente', 'operador'] },
  { id: 'estoque', label: 'Estoque', icon: Boxes, papeis: ['admin', 'gerente'] },
  { id: 'caixa', label: 'Caixa', icon: Wallet, papeis: ['admin', 'gerente'] },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, papeis: ['admin', 'gerente'] },
  { id: 'usuarios', label: 'Usuários', icon: UserCog, papeis: ['admin'] },
];

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(undefined); // undefined = carregando, null = sem linha em usuarios
  const [aba, setAba] = useState('dashboard');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 17 }}>{perfil.empresas.nome}</h1>
          <p className="muted" style={{ fontSize: 12 }}>
            {perfil.nome} · <span className="chip chip-primary" style={{ padding: '1px 8px' }}>{perfil.role}</span>
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => supabase.auth.signOut()}>
          <LogOut size={14} /> Sair
        </button>
      </header>

      <nav className="tab-row" style={{ padding: '10px 16px 0' }}>
        {modulosVisiveis.map((m) => (
          <button key={m.id} type="button" className="tab" aria-pressed={abaAtiva === m.id} onClick={() => setAba(m.id)}>
            <m.icon size={14} style={{ marginRight: 5, verticalAlign: -2 }} />
            {m.label}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, padding: 16 }}>
        {abaAtiva === 'dashboard' && <Dashboard />}
        {abaAtiva === 'pdv' && <Pdv />}
        {abaAtiva === 'mesas' && <Mesas />}
        {abaAtiva === 'cozinha' && <Cozinha />}
        {abaAtiva === 'produtos' && <Produtos />}
        {abaAtiva === 'clientes' && <Clientes />}
        {abaAtiva === 'estoque' && <Estoque />}
        {abaAtiva === 'caixa' && <Caixa />}
        {abaAtiva === 'relatorios' && <Relatorios />}
        {abaAtiva === 'usuarios' && <Usuarios />}
      </main>
    </div>
  );
}
