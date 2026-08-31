import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { inicioDoDia, inicioDoMes } from '../utils/datas';

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

    const [vendasHojeResp, vendasMesResp, estoqueResp] = await Promise.all([
      supabase.from('vendas').select('id, total, criado_em, operador_id, usuarios(nome)').eq('cancelada', false).gte('criado_em', hoje),
      supabase.from('vendas').select('total').eq('cancelada', false).gte('criado_em', mes),
      supabase.from('produtos').select('nome, estoque, estoque_minimo').eq('ativo', true).not('estoque', 'is', null).order('estoque', { ascending: true }).limit(5),
    ]);

    if (vendasHojeResp.error || vendasMesResp.error || estoqueResp.error) {
      setErro((vendasHojeResp.error || vendasMesResp.error || estoqueResp.error).message);
      setResumo(null);
      return;
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

    setResumo({ faturamentoHoje, faturamentoMes, numeroVendas, ticketMedio, maisVendidos, picoVendas, topGarcons, estoqueBaixo });
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
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Pico de vendas (a cada 30min)</div>
        <GraficoPico buckets={resumo.picoVendas} />
      </div>

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
