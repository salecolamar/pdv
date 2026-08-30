import { useEffect, useState } from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import { supabase } from '../supabase';
import { Centro } from '../App';

export default function GarcomLogin({ empresaId }) {
  const [garcons, setGarcons] = useState(undefined);
  const [selecionado, setSelecionado] = useState(null);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase
      .rpc('listar_garcons', { p_empresa_id: empresaId })
      .then(({ data, error }) => setGarcons(error ? null : data || []));
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

  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <Lock size={24} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
          <h1 style={{ fontSize: 20 }}>Acesso do garçom</h1>
          {!selecionado && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Toque no seu nome pra entrar.</p>}
        </div>

        {selecionado ? (
          <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start', marginBottom: 8 }}
              onClick={() => { setSelecionado(null); setPin(''); setErro(''); }}
            >
              <ChevronLeft size={14} /> Trocar de garçom
            </button>
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
        ) : garcons === undefined ? (
          <p className="muted" style={{ textAlign: 'center' }}>Carregando…</p>
        ) : garcons === null ? (
          <p className="danger-text" style={{ textAlign: 'center', fontSize: 13 }}>Não foi possível carregar a lista de garçons.</p>
        ) : garcons.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Nenhum garçom cadastrado ainda. Peça pro admin cadastrar em Usuários.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {garcons.map((g) => (
              <button
                key={g.id}
                type="button"
                className="card"
                onClick={() => { setSelecionado(g); setPin(''); setErro(''); }}
                style={{ textAlign: 'center', cursor: 'pointer', padding: '18px 10px', fontWeight: 700 }}
              >
                {g.nome}
              </button>
            ))}
          </div>
        )}
      </div>
    </Centro>
  );
}
