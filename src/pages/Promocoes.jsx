import { useEffect, useState } from 'react';
import { Percent, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Promocoes() {
  const [promocoes, setPromocoes] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const [promoResp, prodResp, catResp] = await Promise.all([
      supabase.from('promocoes').select('*').order('criado_em', { ascending: false }),
      supabase.from('produtos').select('id, nome').order('nome'),
      supabase.from('categorias').select('id, nome').order('nome'),
    ]);
    setPromocoes(promoResp.data || []);
    setProdutos(prodResp.data || []);
    setCategorias(catResp.data || []);
  }

  async function alternarAtiva(promo) {
    await supabase.from('promocoes').update({ ativo: !promo.ativo }).eq('id', promo.id);
    carregar();
  }

  async function remover(id) {
    await supabase.from('promocoes').delete().eq('id', id);
    carregar();
  }

  function nomeAlvo(promo) {
    if (promo.produto_id) return produtos.find((p) => p.id === promo.produto_id)?.nome || 'Produto removido';
    return 'Categoria: ' + (categorias.find((c) => c.id === promo.categoria_id)?.nome || 'removida');
  }

  function vigencia(promo) {
    const partes = [];
    if (promo.dias_semana) partes.push(promo.dias_semana.map((d) => DIAS[d]).join(', '));
    if (promo.hora_inicio || promo.hora_fim) partes.push(`${promo.hora_inicio?.slice(0, 5) || '00:00'}–${promo.hora_fim?.slice(0, 5) || '23:59'}`);
    if (promo.data_inicio || promo.data_fim) partes.push(`${promo.data_inicio || '…'} a ${promo.data_fim || '…'}`);
    return partes.length ? partes.join(' · ') : 'Sempre ativa';
  }

  if (criando) {
    return (
      <NovaPromocao
        produtos={produtos}
        categorias={categorias}
        onVoltar={() => setCriando(false)}
        onCriada={() => {
          setCriando(false);
          carregar();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setCriando(true)}>
        <Sparkles size={16} /> Nova promoção
      </button>

      {promocoes === null ? (
        <p className="muted">Carregando…</p>
      ) : promocoes.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma promoção cadastrada ainda.</p>
      ) : (
        <div className="list">
          {promocoes.map((promo) => (
            <div key={promo.id} className="card" style={{ opacity: promo.ativo ? 1 : 0.55 }}>
              <div className="row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Percent size={15} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{promo.nome}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{nomeAlvo(promo)}</div>
                  </div>
                </div>
                <span className="chip chip-primary">
                  {promo.tipo === 'percentual' ? `-${promo.valor}%` : `-R$ ${Number(promo.valor).toFixed(2)}`}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{vigencia(promo)}</p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => alternarAtiva(promo)}>
                  {promo.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  onClick={() => remover(promo.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NovaPromocao({ produtos, categorias, onVoltar, onCriada }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('percentual');
  const [valor, setValor] = useState('');
  const [alvoTipo, setAlvoTipo] = useState('produto');
  const [alvoId, setAlvoId] = useState('');
  const [diasSemana, setDiasSemana] = useState([]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function alternarDia(d) {
    setDiasSemana((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    const valorNum = Number(valor.replace(',', '.'));
    if (!nome.trim() || !(valorNum > 0) || !alvoId) {
      setErro('Preencha nome, valor do desconto e o produto ou categoria.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.from('promocoes').insert({
      nome: nome.trim(),
      tipo,
      valor: valorNum,
      produto_id: alvoTipo === 'produto' ? alvoId : null,
      categoria_id: alvoTipo === 'categoria' ? alvoId : null,
      dias_semana: diasSemana.length ? diasSemana : null,
      hora_inicio: horaInicio || null,
      hora_fim: horaFim || null,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onCriada();
  }

  return (
    <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        Voltar
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="label">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Happy hour" />

        <span className="label">Desconto</span>
        <div className="row" style={{ gap: 8 }}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ flex: 1 }}>
            <option value="percentual">Percentual (%)</option>
            <option value="fixo">Valor fixo (R$)</option>
          </select>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder={tipo === 'percentual' ? 'ex: 20' : 'ex: 5.00'} style={{ flex: 1 }} />
        </div>

        <span className="label">Aplica em</span>
        <div className="tab-row">
          <button type="button" className="tab" aria-pressed={alvoTipo === 'produto'} onClick={() => { setAlvoTipo('produto'); setAlvoId(''); }}>
            Produto
          </button>
          <button type="button" className="tab" aria-pressed={alvoTipo === 'categoria'} onClick={() => { setAlvoTipo('categoria'); setAlvoId(''); }}>
            Categoria inteira
          </button>
        </div>
        <select value={alvoId} onChange={(e) => setAlvoId(e.target.value)}>
          <option value="">Selecione…</option>
          {(alvoTipo === 'produto' ? produtos : categorias).map((o) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="label">Dias da semana (vazio = todos)</span>
        <div className="tab-row">
          {DIAS.map((d, idx) => (
            <button key={d} type="button" className="tab" aria-pressed={diasSemana.includes(idx)} onClick={() => alternarDia(idx)}>
              {d}
            </button>
          ))}
        </div>

        <span className="label">Horário (vazio = dia todo)</span>
        <div className="row" style={{ gap: 8 }}>
          <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
        </div>

        <span className="label">Período (vazio = sem limite)</span>
        <div className="row" style={{ gap: 8 }}>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Criar promoção'}
      </button>
    </form>
  );
}
