import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { money, metodoLabel } from '../utils/format';
import { inicioDoDia, inicioDoMes, subDias } from '../utils/datas';

const FILTROS = [
  ['hoje', 'Hoje'],
  ['ontem', 'Ontem'],
  ['7dias', 'Últimos 7 dias'],
  ['30dias', 'Últimos 30 dias'],
  ['mes', 'Este mês'],
  ['personalizado', 'Personalizado'],
];

function periodo(filtro, de, ate) {
  const agora = new Date();
  switch (filtro) {
    case 'hoje':
      return [inicioDoDia(agora), agora];
    case 'ontem':
      return [inicioDoDia(subDias(agora, 1)), inicioDoDia(agora)];
    case '7dias':
      return [inicioDoDia(subDias(agora, 6)), agora];
    case '30dias':
      return [inicioDoDia(subDias(agora, 29)), agora];
    case 'mes':
      return [inicioDoMes(agora), agora];
    case 'personalizado':
      return [de ? inicioDoDia(new Date(`${de}T00:00:00`)) : null, ate ? new Date(`${ate}T23:59:59`) : null];
    default:
      return [inicioDoDia(agora), agora];
  }
}

export default function Relatorios() {
  const [filtro, setFiltro] = useState('hoje');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [resumo, setResumo] = useState(undefined);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, [filtro, de, ate]);

  async function carregar() {
    const [inicio, fim] = periodo(filtro, de, ate);
    if (filtro === 'personalizado' && (!inicio || !fim)) {
      setResumo(null);
      return;
    }

    setResumo(undefined);
    setErro('');

    const { data: vendas, error: erroVendas } = await supabase
      .from('vendas')
      .select('id, total, operador_id, usuarios(nome)')
      .eq('cancelada', false)
      .gte('criado_em', inicio.toISOString())
      .lte('criado_em', fim.toISOString());

    if (erroVendas) {
      setErro(erroVendas.message);
      setResumo(null);
      return;
    }

    const numeroVendas = vendas.length;
    const faturamento = vendas.reduce((s, v) => s + Number(v.total), 0);
    const ticketMedio = numeroVendas ? faturamento / numeroVendas : 0;

    const porOperador = new Map();
    for (const v of vendas) {
      const nome = v.usuarios?.nome || 'Sem operador';
      const atual = porOperador.get(nome) || { quantidade: 0, total: 0 };
      atual.quantidade += 1;
      atual.total += Number(v.total);
      porOperador.set(nome, atual);
    }

    let porFormaPagamento = new Map();
    if (vendas.length > 0) {
      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select('forma, valor')
        .in('venda_id', vendas.map((v) => v.id));
      for (const p of pagamentos || []) {
        porFormaPagamento.set(p.forma, (porFormaPagamento.get(p.forma) || 0) + Number(p.valor));
      }
    }

    setResumo({
      numeroVendas,
      faturamento,
      ticketMedio,
      porOperador: [...porOperador.entries()].sort((a, b) => b[1].total - a[1].total),
      porFormaPagamento: [...porFormaPagamento.entries()].sort((a, b) => b[1] - a[1]),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tab-row">
        {FILTROS.map(([id, label]) => (
          <button key={id} type="button" className="tab" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
            {label}
          </button>
        ))}
      </div>

      {filtro === 'personalizado' && (
        <div className="card" style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span className="label">De</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label">Até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
      )}

      {resumo === undefined ? (
        <p className="muted">Carregando…</p>
      ) : resumo === null ? (
        erro ? (
          <p className="danger-text">Falha ao carregar o relatório: {erro}</p>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Escolha as datas de início e fim.</p>
        )
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Cartao titulo="Faturamento" valor={money(resumo.faturamento)} destaque />
            <Cartao titulo="Vendas" valor={resumo.numeroVendas} />
            <Cartao titulo="Ticket médio" valor={money(resumo.ticketMedio)} />
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Por forma de pagamento</div>
            {resumo.porFormaPagamento.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda no período.</p>
            ) : (
              <div className="list">
                {resumo.porFormaPagamento.map(([forma, valor]) => (
                  <div className="item" key={forma}>
                    <span>{metodoLabel(forma)}</span>
                    <span className="tabular">{money(valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Por operador</div>
            {resumo.porOperador.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda no período.</p>
            ) : (
              <div className="list">
                {resumo.porOperador.map(([nome, v]) => (
                  <div className="item" key={nome}>
                    <span>
                      {nome} <span className="muted" style={{ fontSize: 11 }}>x{v.quantidade}</span>
                    </span>
                    <span className="tabular">{money(v.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
