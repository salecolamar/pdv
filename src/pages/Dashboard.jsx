import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { inicioDoDia, inicioDoMes } from '../utils/datas';

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

    const [vendasHojeResp, vendasMesResp] = await Promise.all([
      supabase.from('vendas').select('id, total').eq('cancelada', false).gte('criado_em', hoje),
      supabase.from('vendas').select('total').eq('cancelada', false).gte('criado_em', mes),
    ]);

    if (vendasHojeResp.error || vendasMesResp.error) {
      setErro((vendasHojeResp.error || vendasMesResp.error).message);
      setResumo(null);
      return;
    }

    const vendasHoje = vendasHojeResp.data;
    const faturamentoHoje = vendasHoje.reduce((s, v) => s + Number(v.total), 0);
    const numeroVendas = vendasHoje.length;
    const ticketMedio = numeroVendas ? faturamentoHoje / numeroVendas : 0;
    const faturamentoMes = vendasMesResp.data.reduce((s, v) => s + Number(v.total), 0);

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

    setResumo({ faturamentoHoje, faturamentoMes, numeroVendas, ticketMedio, maisVendidos });
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
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Mais vendidos hoje</div>
        {resumo.maisVendidos.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda registrada hoje ainda.</p>
        ) : (
          <div className="list">
            {resumo.maisVendidos.map((p) => (
              <div className="item" key={p.nome}>
                <span>
                  {p.nome} <span className="muted" style={{ fontSize: 11 }}>x{p.quantidade}</span>
                </span>
                <span className="tabular">{money(p.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="btn btn-secondary btn-sm" onClick={carregar}>
        Atualizar
      </button>
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
