import { useEffect, useState } from 'react';
import { ChevronLeft, Lock, ShieldCheck, User, UserCog, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../supabase';
import { Centro, FormularioEntrar } from '../App';
import EscolhaCard from '../components/EscolhaCard';

export default function AcessoEmpresa({ empresaId }) {
  const [modo, setModo] = useState(null); // null | 'admin' | 'garcom'

  if (modo === 'admin') {
    return (
      <Centro>
        <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <VoltarEscolha onVoltar={() => setModo(null)} titulo="Entrar como admin" />
          <FormularioEntrar />
        </div>
      </Centro>
    );
  }

  if (modo === 'garcom') {
    return <AcessoGarcom empresaId={empresaId} onVoltar={() => setModo(null)} />;
  }

  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto 10px', background: 'linear-gradient(135deg, var(--primary), #6C3CE0)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Lock size={22} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>PDV</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Como você quer entrar?</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EscolhaCard icon={UtensilsCrossed} titulo="Sou garçom" descricao="Entrar com seu nome + PIN" onClick={() => setModo('garcom')} />
          <EscolhaCard icon={ShieldCheck} titulo="Sou admin" descricao="Entrar com e-mail e senha" onClick={() => setModo('admin')} />
        </div>
      </div>
    </Centro>
  );
}

function VoltarEscolha({ onVoltar, titulo }) {
  return (
    <div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onVoltar}>
        <ChevronLeft size={14} /> Voltar
      </button>
      <h1 style={{ fontSize: 18, textAlign: 'center', marginTop: 10 }}>{titulo}</h1>
    </div>
  );
}

export function AcessoGarcom({ empresaId, onVoltar }) {
  const [usuarios, setUsuarios] = useState(undefined);
  const [tipo, setTipo] = useState('operador'); // 'operador' | 'gerente'
  const [selecionado, setSelecionado] = useState(null);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase
      .rpc('listar_garcons', { p_empresa_id: empresaId })
      .then(({ data, error }) => setUsuarios(error ? null : data || []));
  }, [empresaId]);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    if (pin.length !== 6) {
      setErro('Digite os 6 dígitos do PIN.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: selecionado.email, password: pin });
    setEnviando(false);
    if (error) {
      setErro('PIN incorreto.');
      setPin('');
    }
    // Sucesso: onAuthStateChange no App troca de tela sozinho.
  }

  const temGerentes = (usuarios || []).some((u) => u.role === 'gerente');
  const listaFiltrada = (usuarios || []).filter((u) => u.role === tipo);

  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <VoltarEscolha onVoltar={selecionado ? () => { setSelecionado(null); setPin(''); setErro(''); } : onVoltar} titulo="Acesso do garçom" />

        {!selecionado && usuarios && usuarios.length > 0 && temGerentes && (
          <div className="tab-row">
            <button type="button" className="tab" aria-pressed={tipo === 'operador'} onClick={() => setTipo('operador')}>
              <UtensilsCrossed size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Garçom
            </button>
            <button type="button" className="tab" aria-pressed={tipo === 'gerente'} onClick={() => setTipo('gerente')}>
              <UserCog size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Gerente
            </button>
          </div>
        )}
        {!selecionado && <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: -8 }}>Toque no seu nome pra entrar.</p>}

        {selecionado ? (
          <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{selecionado.nome}</div>
            <span className="label">PIN (6 dígitos)</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              type="password"
              placeholder="••••••"
              autoFocus
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
            />
            {erro && <p className="danger-text" style={{ fontSize: 13, marginTop: 8, textAlign: 'center' }}>{erro}</p>}
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : usuarios === undefined ? (
          <p className="muted" style={{ textAlign: 'center' }}>Carregando…</p>
        ) : usuarios === null ? (
          <p className="danger-text" style={{ textAlign: 'center', fontSize: 13 }}>Não foi possível carregar a lista de garçons.</p>
        ) : listaFiltrada.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            {tipo === 'gerente' ? 'Nenhum gerente cadastrado ainda.' : 'Nenhum garçom cadastrado ainda.'} Peça pro admin cadastrar em Usuários.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {listaFiltrada.map((u) => (
              <EscolhaCard
                key={u.id}
                icon={u.role === 'gerente' ? UserCog : User}
                titulo={u.nome}
                onClick={() => { setSelecionado(u); setPin(''); setErro(''); }}
              />
            ))}
          </div>
        )}
      </div>
    </Centro>
  );
}
