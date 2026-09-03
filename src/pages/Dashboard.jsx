import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Landmark, QrCode } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { inicioDoDia, inicioDoMes, subDias } from '../utils/datas';

const FORMAS_PAGAMENTO = [
  { forma: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { forma: 'pix', label: 'Pix', icon: QrCode },
  { forma: 'debito', label: 'Débito', icon: Landmark },
  { forma: 'credito', label: 'Crédito', icon: CreditCard },
];

function bucketsMeiaHora(vendas) {
  const agora = new Date();
  const totalBuckets = Math.floor((agora.getHours() * 60 + agora.getMinutes()) / 30) + 1;
  const buckets = Array.from({ length: totalBuckets }, (_, i) => ({ idx: i, total: 0 }));
  for (const v of vendas) {
    const d = new Date(v.criado_em);
    const idx = Math.floor((d.getHours() * 60 + d.getMinutes()) / 30);
    if (buckets[idx]) buckets[idx].total += Number(v.total);
  }
  return buckets;
}

function rotuloBucket(idx) {
  const minutos = idx * 30;
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(undefined); // undefined = carregando
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setResumo(undefined);
    setErro('');

    const hoje = inicioDoDia().toISOString();
    const mes = inicioDoMes().toISOString();

    const [vendasHojeResp, vendasMesResp, estoqueResp, pagamentosResp] = await Promise.all([
      supabase.from('vendas').select('id, total, criado_em, operador_id, usuarios(nome)').eq('cancelada', false).gte('criado_em', hoje),
      supabase.from('vendas').select('total').eq('cancelada', false).gte('criado_em', mes),
      supabase.from('produtos').select('nome, estoque, estoque_minimo').eq('ativo', true).not('estoque', 'is', null).order('estoque', { ascending: true }).limit(5),
      supabase.from('pagamentos').select('forma, valor, vendas!inner(criado_em, cancelada)').eq('vendas.cancelada', false).gte('vendas.criado_em', hoje),
    ]);

    if (vendasHojeResp.error || vendasMesResp.error || estoqueResp.error || pagamentosResp.error) {
      setErro((vendasHojeResp.error || vendasMesResp.error || estoqueResp.error || pagamentosResp.error).message);
      setResumo(null);
      return;
    }

    const porFormaPagamento = {};
    for (const p of pagamentosResp.data) {
      porFormaPagamento[p.forma] = (porFormaPagamento[p.forma] || 0) + Number(p.valor);
    }

    const vendasHoje = vendasHojeResp.data;
    const faturamentoHoje = vendasHoje.reduce((s, v) => s + Number(v.total), 0);
    const numeroVendas = vendasHoje.length;
    const ticketMedio = numeroVendas ? faturamentoHoje / numeroVendas : 0;
    const faturamentoMes = vendasMesResp.data.reduce((s, v) => s + Number(v.total), 0);

    const picoVendas = bucketsMeiaHora(vendasHoje);

    const mapaGarcons = new Map();
    for (const v of vendasHoje) {
      const nome = v.usuarios?.nome || 'Sem operador';
      const atual = mapaGarcons.get(nome) || { quantidade: 0, total: 0 };
      atual.quantidade += 1;
      atual.total += Number(v.total);
      mapaGarcons.set(nome, atual);
    }
    const topGarcons = [...mapaGarcons.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const estoqueBaixo = estoqueResp.data.filter((p) => p.estoque_minimo == null || Number(p.estoque) <= Number(p.estoque_minimo));

    let maisVendidos = [];
    if (vendasHoje.length > 0) {
      const { data: itens, error: erroItens } = await supabase
        .from('venda_itens')
        .select('nome_produto, quantidade, preco_unitario')
        .in('venda_id', vendasHoje.map((v) => v.id));
      if (!erroItens && itens) {
        const mapa = new Map();
        for (const i of itens) {
          const atual = mapa.get(i.nome_produto) || { quantidade: 0, total: 0 };
          atual.quantidade += Number(i.quantidade);
          atual.total += Number(i.quantidade) * Number(i.preco_unitario);
          mapa.set(i.nome_produto, atual);
        }
        maisVendidos = [...mapa.entries()]
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
      }
    }

    setResumo({ faturamentoHoje, faturamentoMes, numeroVendas, ticketMedio, maisVendidos, picoVendas, topGarcons, estoqueBaixo, porFormaPagamento });
  }

  if (resumo === undefined) return <p className="muted">Carregando…</p>;
  if (resumo === null) return <p className="danger-text">Falha ao carregar o dashboard: {erro}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        <Cartao titulo="Faturamento hoje" valor={money(resumo.faturamentoHoje)} destaque />
        <Cartao titulo="Faturamento do mês" valor={money(resumo.faturamentoMes)} />
        <Cartao titulo="Vendas hoje" valor={resumo.numeroVendas} />
        <Cartao titulo="Ticket médio" valor={money(resumo.ticketMedio)} />
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Recebido hoje por forma de pagamento</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          {FORMAS_PAGAMENTO.map((f) => (
            <div key={f.forma} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--panel-2)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <f.icon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>{f.label}</p>
                <p className="tabular" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{money(resumo.porFormaPagamento[f.forma] || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Pico de vendas (a cada 30min)</div>
        <GraficoPico buckets={resumo.picoVendas} />
      </div>

      <TendenciaFaturamento />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        <Ranking
          titulo="Top produtos"
          itens={resumo.maisVendidos}
          vazio="Nenhuma venda registrada hoje ainda."
          renderLinha={(p) => (
            <>
              <span>
                {p.nome} <span className="muted" style={{ fontSize: 11 }}>x{p.quantidade}</span>
              </span>
              <span className="tabular">{money(p.total)}</span>
            </>
          )}
        />

        <Ranking
          titulo="Top garçom"
          itens={resumo.topGarcons}
          vazio="Nenhuma venda registrada hoje ainda."
          renderLinha={(g) => (
            <>
              <span>
                {g.nome} <span className="muted" style={{ fontSize: 11 }}>x{g.quantidade}</span>
              </span>
              <span className="tabular">{money(g.total)}</span>
            </>
          )}
        />

        <Ranking
          titulo="Estoque quase acabando"
          itens={resumo.estoqueBaixo}
          vazio="Nenhum produto com estoque baixo."
          renderLinha={(p) => (
            <>
              <span>{p.nome}</span>
              <span className={'tabular ' + (Number(p.estoque) <= 0 ? 'danger-text' : '')}>{p.estoque}</span>
            </>
          )}
        />
      </div>

      <button type="button" className="btn btn-secondary btn-sm" onClick={carregar}>
        Atualizar
      </button>
    </div>
  );
}

function GraficoPico({ buckets }) {
  if (buckets.length === 0) return <p className="muted" style={{ fontSize: 13, margin: 0 }}>Sem vendas hoje ainda.</p>;

  const max = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, overflowX: 'auto', paddingBottom: 2 }}>
      {buckets.map((b) => {
        const altura = Math.round((b.total / max) * 100);
        const horaCheia = (b.idx * 30) % 60 === 0;
        return (
          <div
            key={b.idx}
            title={`${rotuloBucket(b.idx)} — ${money(b.total)}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 8, flex: '1 0 8px' }}
          >
            <div
              style={{
                width: '100%',
                minWidth: 6,
                height: `${Math.max(altura, b.total > 0 ? 4 : 1)}%`,
                background: b.total > 0 ? 'var(--primary)' : 'var(--border)',
                borderRadius: 3,
              }}
            />
            {horaCheia && (
              <span className="muted" style={{ fontSize: 9, marginTop: 3, whiteSpace: 'nowrap' }}>{rotuloBucket(b.idx)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Ranking({ titulo, itens, vazio, renderLinha }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{titulo}</div>
      {itens.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{vazio}</p>
      ) : (
        <div className="list">
          {itens.map((item, idx) => (
            <div className="item" key={idx}>
              {renderLinha(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Cartao({ titulo, valor, destaque }) {
  return (
    <div className="card">
      <p className="muted" style={{ fontSize: 12 }}>{titulo}</p>
      <p className="tabular" style={{ fontSize: destaque ? 24 : 20, fontWeight: 800, marginTop: 4 }}>{valor}</p>
    </div>
  );
}

function TendenciaFaturamento() {
  const [dias, setDias] = useState(7);
  const [pontos, setPontos] = useState(undefined);

  useEffect(() => {
    carregar();
  }, [dias]);

  async function carregar() {
    setPontos(undefined);
    const desde = inicioDoDia(subDias(new Date(), dias - 1));
    const { data } = await supabase
      .from('vendas')
      .select('total, criado_em')
      .eq('cancelada', false)
      .gte('criado_em', desde.toISOString());

    const mapa = new Map();
    for (let i = 0; i < dias; i++) {
      const d = subDias(new Date(), dias - 1 - i);
      const chave = d.toISOString().slice(0, 10);
      mapa.set(chave, 0);
    }
    for (const v of data || []) {
      const chave = new Date(v.criado_em).toISOString().slice(0, 10);
      if (mapa.has(chave)) mapa.set(chave, mapa.get(chave) + Number(v.total));
    }
    setPontos([...mapa.entries()].map(([data, total]) => ({ data, total })));
  }

  const total = (pontos || []).reduce((s, p) => s + p.total, 0);
  const media = pontos?.length ? total / pontos.length : 0;

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Tendência de faturamento</div>
        <div className="tab-row" style={{ width: 'auto' }}>
          <button type="button" className="tab" aria-pressed={dias === 7} onClick={() => setDias(7)} style={{ padding: '5px 12px' }}>
            7 dias
          </button>
          <button type="button" className="tab" aria-pressed={dias === 30} onClick={() => setDias(30)} style={{ padding: '5px 12px' }}>
            30 dias
          </button>
        </div>
      </div>

      {pontos === undefined ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Carregando…</p>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>Total no período: <strong className="tabular" style={{ color: 'var(--text)' }}>{money(total)}</strong></span>
            <span className="muted" style={{ fontSize: 12 }}>Média/dia: <strong className="tabular" style={{ color: 'var(--text)' }}>{money(media)}</strong></span>
          </div>
          <GraficoTendencia pontos={pontos} />
        </>
      )}
    </div>
  );
}

function GraficoTendencia({ pontos }) {
  const max = Math.max(1, ...pontos.map((p) => p.total));
  const mostrarTodosRotulos = pontos.length <= 7;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: pontos.length > 15 ? 2 : 6, height: 120, overflowX: 'auto', paddingBottom: 2 }}>
      {pontos.map((p, idx) => {
        const altura = Math.round((p.total / max) * 100);
        const d = new Date(p.data + 'T00:00:00');
        const rotulo = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const mostrarRotulo = mostrarTodosRotulos || idx % 5 === 0 || idx === pontos.length - 1;
        return (
          <div
            key={p.data}
            title={`${rotulo} — ${money(p.total)}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 14, flex: '1 0 14px' }}
          >
            <div
              style={{
                width: '100%',
                minWidth: 8,
                height: `${Math.max(altura, p.total > 0 ? 4 : 1)}%`,
                background: p.total > 0 ? 'var(--primary)' : 'var(--border)',
                borderRadius: 3,
              }}
            />
            {mostrarRotulo && (
              <span className="muted" style={{ fontSize: 9, marginTop: 3, whiteSpace: 'nowrap' }}>{rotulo}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
