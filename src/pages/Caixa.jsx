import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { money, metodoLabel } from '../utils/format';

const TIPOS_MOVIMENTO = [
  ['entrada', 'Entrada'],
  ['sangria', 'Sangria'],
  ['retirada', 'Retirada'],
  ['despesa', 'Despesa'],
];

export default function Caixa() {
  const [caixa, setCaixa] = useState(undefined); // undefined = carregando, null = nenhum aberto

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase
      .from('caixas')
      .select('*, usuarios!caixas_aberto_por_fkey(nome)')
      .is('fechado_em', null)
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCaixa(data || null);
  }

  if (caixa === undefined) return <p className="muted">Carregando…</p>;
  if (caixa === null) return <AbrirCaixa onAberto={carregar} />;
  return <CaixaAberto caixa={caixa} onFechado={carregar} />;
}

function AbrirCaixa({ onAberto }) {
  const [valorInicial, setValorInicial] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function abrir(e) {
    e.preventDefault();
    setErro('');
    const valor = Number(valorInicial.replace(',', '.'));
    if (!(valor >= 0)) {
      setErro('Informe um valor inicial válido.');
      return;
    }
    setEnviando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('caixas').insert({ valor_inicial: valor, aberto_por: user.id });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    await supabase.from('audit_logs').insert({ usuario_id: user.id, acao: 'abrir_caixa', detalhes: { valor_inicial: valor } });
    onAberto();
  }

  return (
    <form onSubmit={abrir} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Abrir caixa</div>
      <span className="label">Valor inicial (R$)</span>
      <input value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} inputMode="decimal" />
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={enviando}>
        {enviando ? 'Abrindo…' : 'Abrir caixa'}
      </button>
    </form>
  );
}

function CaixaAberto({ caixa, onFechado }) {
  const [movimentos, setMovimentos] = useState(null);
  const [resumoPagamentos, setResumoPagamentos] = useState(null);
  const [abrindoTipo, setAbrindoTipo] = useState(null);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    carregarMovimentos();
    carregarPagamentos();
  }, []);

  async function carregarMovimentos() {
    const { data } = await supabase
      .from('caixa_movimentos')
      .select('*')
      .eq('caixa_id', caixa.id)
      .order('criado_em', { ascending: false });
    setMovimentos(data || []);
  }

  async function carregarPagamentos() {
    const { data } = await supabase
      .from('pagamentos')
      .select('forma, valor, vendas!inner(caixa_id, cancelada)')
      .eq('vendas.caixa_id', caixa.id)
      .eq('vendas.cancelada', false);
    const mapa = {};
    for (const p of data || []) {
      mapa[p.forma] = (mapa[p.forma] || 0) + Number(p.valor);
    }
    setResumoPagamentos(mapa);
  }

  async function confirmarMovimento() {
    setErro('');
    const v = Number(valor.replace(',', '.'));
    if (!(v > 0)) {
      setErro('Informe um valor válido.');
      return;
    }
    setEnviando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('caixa_movimentos').insert({
      caixa_id: caixa.id,
      tipo: abrindoTipo,
      valor: v,
      motivo: motivo.trim() || null,
      usuario_id: user.id,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setAbrindoTipo(null);
    setValor('');
    setMotivo('');
    carregarMovimentos();
  }

  const totalMovimentos = (movimentos || []).reduce((s, m) => s + (m.tipo === 'entrada' ? Number(m.valor) : -Number(m.valor)), 0);

  if (fechando) {
    return (
      <FecharCaixa
        caixa={caixa}
        resumoPagamentos={resumoPagamentos}
        totalMovimentos={totalMovimentos}
        onVoltar={() => setFechando(false)}
        onFechado={onFechado}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <p className="muted" style={{ fontSize: 12 }}>Caixa aberto</p>
        <p style={{ fontWeight: 700 }}>{caixa.usuarios?.nome || 'Operador'} · {new Date(caixa.aberto_em).toLocaleString('pt-BR')}</p>
        <p className="tabular" style={{ marginTop: 4 }}>Valor inicial: {money(caixa.valor_inicial)}</p>
      </div>

      {resumoPagamentos && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Vendas nesse caixa</div>
          {Object.keys(resumoPagamentos).length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda ainda.</p>
          ) : (
            <div className="list">
              {Object.entries(resumoPagamentos).map(([forma, v]) => (
                <div className="item" key={forma}>
                  <span>{metodoLabel(forma)}</span>
                  <span className="tabular">{money(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {abrindoTipo ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{TIPOS_MOVIMENTO.find(([id]) => id === abrindoTipo)[1]}</div>
          <span className="label">Valor (R$)</span>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
          <span className="label">Motivo (opcional)</span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAbrindoTipo(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={enviando} onClick={confirmarMovimento}>
              {enviando ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {TIPOS_MOVIMENTO.map(([id, label]) => (
            <button key={id} type="button" className="btn btn-secondary" onClick={() => { setAbrindoTipo(id); setErro(''); }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {movimentos && movimentos.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Movimentações do caixa</div>
          <div className="list">
            {movimentos.map((m) => (
              <div className="item" key={m.id}>
                <span>{TIPOS_MOVIMENTO.find(([id]) => id === m.tipo)?.[1] || m.tipo} {m.motivo ? `— ${m.motivo}` : ''}</span>
                <span className={'tabular ' + (m.tipo === 'entrada' ? 'success-text' : 'danger-text')}>
                  {m.tipo === 'entrada' ? '+' : '-'}{money(m.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="btn btn-danger btn-block" onClick={() => setFechando(true)}>
        Fechar caixa
      </button>
    </div>
  );
}

function FecharCaixa({ caixa, resumoPagamentos, totalMovimentos, onVoltar, onFechado }) {
  const [valorInformado, setValorInformado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  const vendasDinheiro = resumoPagamentos?.dinheiro || 0;
  const esperado = Number(caixa.valor_inicial) + vendasDinheiro + totalMovimentos;

  async function confirmar() {
    setErro('');
    const valor = Number(valorInformado.replace(',', '.'));
    if (!(valor >= 0)) {
      setErro('Informe o valor contado no caixa.');
      return;
    }
    setEnviando(true);
    const { data, error } = await supabase.rpc('fechar_caixa', { p_caixa_id: caixa.id, p_valor_informado: valor });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    setResultado(data);
  }

  if (resultado) {
    return (
      <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontWeight: 700 }}>Caixa fechado</p>
        <p className="muted" style={{ fontSize: 13 }}>Valor esperado</p>
        <p className="tabular" style={{ fontSize: 20, fontWeight: 700 }}>{money(resultado.esperado)}</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Diferença</p>
        <p className={'tabular ' + (Math.abs(resultado.diferenca) < 0.01 ? '' : resultado.diferenca > 0 ? 'success-text' : 'danger-text')} style={{ fontSize: 20, fontWeight: 700 }}>
          {resultado.diferenca > 0 ? '+' : ''}{money(resultado.diferenca)}
        </p>
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={onFechado}>
          Concluir
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        Voltar
      </button>
      <div className="card">
        <div className="row" style={{ fontSize: 13 }}>
          <span className="muted">Valor inicial</span>
          <span className="tabular">{money(caixa.valor_inicial)}</span>
        </div>
        <div className="row" style={{ fontSize: 13 }}>
          <span className="muted">Vendas em dinheiro</span>
          <span className="tabular">{money(vendasDinheiro)}</span>
        </div>
        <div className="row" style={{ fontSize: 13 }}>
          <span className="muted">Entradas/retiradas/sangrias/despesas</span>
          <span className="tabular">{money(totalMovimentos)}</span>
        </div>
        <div className="row" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700 }}>Valor esperado</span>
          <span className="tabular" style={{ fontWeight: 800 }}>{money(esperado)}</span>
        </div>
      </div>
      <div className="card">
        <span className="label">Valor contado no caixa (R$)</span>
        <input value={valorInformado} onChange={(e) => setValorInformado(e.target.value)} inputMode="decimal" placeholder={esperado.toFixed(2)} />
      </div>
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="button" className="btn btn-danger btn-block" disabled={enviando} onClick={confirmar}>
        {enviando ? 'Fechando…' : 'Confirmar fechamento'}
      </button>
    </div>
  );
}
