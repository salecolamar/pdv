import { useEffect, useState } from 'react';
import { ChevronLeft, Lock, LogIn, LogOut, ShieldCheck, UserCog, UtensilsCrossed, Wallet } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { Centro, FormularioEntrar } from '../App';
import EscolhaCard from '../components/EscolhaCard';

export default function AcessoEmpresa({ empresaId }) {
  const [modo, setModo] = useState(null); // null | 'admin' | 'garcom' | 'gerente'

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

  if (modo === 'garcom' || modo === 'gerente') {
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
          <EscolhaCard icon={UtensilsCrossed} titulo="Garçom" onClick={() => setModo('garcom')} />
          <EscolhaCard icon={UserCog} titulo="Gerente" onClick={() => setModo('gerente')} />
          <EscolhaCard icon={ShieldCheck} titulo="Administrador" onClick={() => setModo('admin')} />
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
  const [selecionado, setSelecionado] = useState(null);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [acaoCaixa, setAcaoCaixa] = useState(null); // null | 'abrir' | 'fechar'
  const [resumoCaixa, setResumoCaixa] = useState(undefined);

  useEffect(() => {
    supabase
      .rpc('listar_garcons', { p_empresa_id: empresaId })
      .then(({ data, error }) => setUsuarios(error ? null : data || []));
  }, [empresaId]);

  useEffect(() => {
    carregarResumoCaixa();
  }, [empresaId]);

  async function carregarResumoCaixa() {
    const { data, error } = await supabase.rpc('resumo_caixa_aberto', { p_empresa_id: empresaId });
    setResumoCaixa(error ? null : data?.[0] || null);
  }

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

  const listaOrdenada = [...(usuarios || [])].sort((a, b) => a.nome.localeCompare(b.nome));

  if (acaoCaixa) {
    return (
      <Centro>
        <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AcaoCaixaModal
            empresaId={empresaId}
            acao={acaoCaixa}
            resumo={resumoCaixa}
            onVoltar={() => setAcaoCaixa(null)}
            onConcluido={() => {
              setAcaoCaixa(null);
              carregarResumoCaixa();
            }}
          />
        </div>
      </Centro>
    );
  }

  return (
    <Centro>
      <div className="card" style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <VoltarEscolha
          onVoltar={selecionado ? () => { setSelecionado(null); setPin(''); setErro(''); } : onVoltar}
          titulo={selecionado ? (selecionado.role === 'gerente' ? 'Acesso do gerente' : 'Acesso do garçom') : 'Entrar'}
        />

        {!selecionado && resumoCaixa !== undefined && (
          <div className="secao-caixa">
            <span className="secao-caixa__titulo">Caixa do dia</span>
            {resumoCaixa ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <Wallet size={15} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                  <span>
                    Caixa aberto por <strong>{resumoCaixa.aberto_por_nome || '—'}</strong> às{' '}
                    {new Date(resumoCaixa.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAcaoCaixa('fechar')}>
                  <LogOut size={14} /> Fechar caixa
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <Wallet size={15} style={{ flexShrink: 0, color: 'var(--text-dim)' }} />
                  <span className="muted">Nenhum caixa aberto ainda hoje.</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAcaoCaixa('abrir')}>
                  <LogIn size={14} /> Abrir caixa
                </button>
              </>
            )}
          </div>
        )}

        {!selecionado && <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>Toque no seu nome pra entrar.</p>}

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
        ) : listaOrdenada.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            Nenhum garçom ou gerente cadastrado ainda. Peça pro admin cadastrar em Usuários.
          </p>
        ) : (
          <div className="lista-cascata" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {listaOrdenada.map((u) => (
              <button
                key={u.id}
                type="button"
                className="lista-cascata__item"
                onClick={() => { setSelecionado(u); setPin(''); setErro(''); }}
              >
                <span className="lista-cascata__item-icone">
                  {u.role === 'gerente' ? <UserCog size={15} /> : <UtensilsCrossed size={15} />}
                </span>
                {u.nome}
                <span className="lista-cascata__item-tag">{u.role === 'gerente' ? 'Gerente' : 'Garçom'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Centro>
  );
}

function AcaoCaixaModal({ empresaId, acao, resumo, onVoltar, onConcluido }) {
  const [autorizadores, setAutorizadores] = useState(null);
  const [usuarioId, setUsuarioId] = useState('');
  const [senha, setSenha] = useState('');
  const [valor, setValor] = useState(() => (acao === 'fechar' ? (resumo?.esperado || 0).toFixed(2) : '0'));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    supabase.rpc('listar_autorizadores_caixa', { p_empresa_id: empresaId }).then(({ data }) => {
      setAutorizadores(data || []);
      if (data?.length > 0) setUsuarioId(data[0].id);
    });
  }, [empresaId]);

  const mesasAbertas = resumo?.mesas_abertas || 0;

  async function confirmar(e) {
    e.preventDefault();
    setErro('');
    if (!usuarioId) {
      setErro('Nenhum gerente ou admin cadastrado pra autorizar.');
      return;
    }
    if (!senha) {
      setErro('Digite a senha (ou PIN).');
      return;
    }
    const v = Number(String(valor).replace(',', '.'));
    if (!(v >= 0)) {
      setErro('Informe um valor válido.');
      return;
    }
    setEnviando(true);
    const { data, error } =
      acao === 'abrir'
        ? await supabase.rpc('abrir_caixa_autorizado', { p_empresa_id: empresaId, p_usuario_id: usuarioId, p_senha: senha, p_valor_inicial: v })
        : await supabase.rpc('fechar_caixa_autorizado', { p_empresa_id: empresaId, p_usuario_id: usuarioId, p_senha: senha, p_valor_informado: v });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    setResultado(acao === 'abrir' ? {} : data);
  }

  if (resultado) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px',
          }}
        >
          <Wallet size={22} />
        </div>
        <p style={{ fontWeight: 800, fontSize: 16 }}>{acao === 'abrir' ? 'Caixa aberto' : 'Caixa fechado'}</p>
        {acao === 'fechar' && (
          <>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Diferença</p>
            <p className="tabular" style={{ fontSize: 20, fontWeight: 800 }}>
              {resultado.diferenca > 0 ? '+' : ''}{money(resultado.diferenca)}
            </p>
          </>
        )}
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={onConcluido}>
          Concluir
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Lock size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16.5 }}>{acao === 'abrir' ? 'Abrir caixa' : 'Fechar caixa'}</h2>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Precisa de um gerente ou admin pra confirmar.</p>
        </div>
      </div>

      {acao === 'fechar' && mesasAbertas > 0 && (
        <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>
          {mesasAbertas} mesa(s) ainda com comanda em aberto — feche todas antes de fechar o caixa.
        </p>
      )}

      {autorizadores === null ? (
        <p className="muted" style={{ fontSize: 13 }}>Carregando…</p>
      ) : autorizadores.length === 0 ? (
        <p className="danger-text" style={{ fontSize: 13 }}>Nenhum gerente ou admin cadastrado.</p>
      ) : (
        <>
          <span className="label">Autorizado por</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
            {autorizadores.map((u) => (
              <EscolhaCard
                key={u.id}
                selecionado={usuarioId === u.id}
                onClick={() => setUsuarioId(u.id)}
                icon={u.role === 'admin' ? ShieldCheck : UserCog}
                titulo={u.nome}
                descricao={u.role === 'admin' ? 'Admin' : 'Gerente'}
              />
            ))}
          </div>
          <span className="label">Senha (ou PIN)</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoFocus />
          <span className="label">{acao === 'abrir' ? 'Valor inicial (R$)' : 'Valor contado no caixa (R$)'}</span>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" onFocus={(e) => e.target.select()} />
          {acao === 'fechar' && resumo && (
            <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>Valor esperado: {money(resumo.esperado)}</p>
          )}
        </>
      )}

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <div className="modal-box__actions">
        <button type="button" className="btn btn-secondary" disabled={enviando} onClick={onVoltar}>
          Voltar
        </button>
        <button type="submit" className="btn btn-primary" disabled={enviando || !autorizadores?.length}>
          {enviando ? 'Confirmando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  );
}
