import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { supabase } from '../supabase';
import { money, metodoLabel } from '../utils/format';
import { inicioDoDia, inicioDoMes, subDias } from '../utils/datas';
import { baixarCsv } from '../utils/exportar';

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
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

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
      .select('id, criado_em, subtotal, desconto, total, operador_id, usuarios(nome)')
      .eq('cancelada', false)
      .gte('criado_em', inicio.toISOString())
      .lte('criado_em', fim.toISOString())
      .order('criado_em');

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

    const vendasComDesconto = vendas.filter((v) => Number(v.desconto) > 0);
    const totalDescontos = vendasComDesconto.reduce((s, v) => s + Number(v.desconto), 0);
    const descontoPorOperador = new Map();
    for (const v of vendasComDesconto) {
      const nome = v.usuarios?.nome || 'Sem operador';
      const atual = descontoPorOperador.get(nome) || { quantidade: 0, total: 0 };
      atual.quantidade += 1;
      atual.total += Number(v.desconto);
      descontoPorOperador.set(nome, atual);
    }

    let porFormaPagamento = new Map();
    let maisVendidos = [];
    if (vendas.length > 0) {
      const [pagamentosResp, itensResp] = await Promise.all([
        supabase.from('pagamentos').select('forma, valor').in('venda_id', vendas.map((v) => v.id)),
        supabase.from('venda_itens').select('nome_produto, quantidade, preco_unitario').in('venda_id', vendas.map((v) => v.id)),
      ]);
      for (const p of pagamentosResp.data || []) {
        porFormaPagamento.set(p.forma, (porFormaPagamento.get(p.forma) || 0) + Number(p.valor));
      }
      const mapaProdutos = new Map();
      for (const i of itensResp.data || []) {
        const atual = mapaProdutos.get(i.nome_produto) || { quantidade: 0, total: 0 };
        atual.quantidade += Number(i.quantidade);
        atual.total += Number(i.quantidade) * Number(i.preco_unitario);
        mapaProdutos.set(i.nome_produto, atual);
      }
      maisVendidos = [...mapaProdutos.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total);
    }

    setResumo({
      vendas,
      numeroVendas,
      faturamento,
      ticketMedio,
      porOperador: [...porOperador.entries()].sort((a, b) => b[1].total - a[1].total),
      porFormaPagamento: [...porFormaPagamento.entries()].sort((a, b) => b[1] - a[1]),
      maisVendidos,
      totalDescontos,
      vendasComDesconto,
      descontoPorOperador: [...descontoPorOperador.entries()].sort((a, b) => b[1].total - a[1].total),
    });
  }

  async function confirmarCancelamento(id) {
    const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: id, p_motivo: motivoCancelamento.trim() || null });
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    setCancelandoId(null);
    setMotivoCancelamento('');
    carregar();
  }

  function exportarCsv() {
    baixarCsv(
      `vendas-${filtro}.csv`,
      ['Data', 'Operador', 'Subtotal', 'Desconto', 'Total'],
      resumo.vendas.map((v) => [
        new Date(v.criado_em).toLocaleString('pt-BR'),
        v.usuarios?.nome || 'Sem operador',
        v.subtotal,
        v.desconto,
        v.total,
      ])
    );
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
        <div className="relatorio-print" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="no-print" style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportarCsv} disabled={resumo.numeroVendas === 0}>
              <Download size={14} /> Exportar CSV
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={resumo.numeroVendas === 0}>
              <Printer size={14} /> Exportar PDF
            </button>
          </div>

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

          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>Descontos</span>
              <span className="tabular danger-text" style={{ fontWeight: 800 }}>{money(resumo.totalDescontos)}</span>
            </div>
            {resumo.descontoPorOperador.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhum desconto dado no período.</p>
            ) : (
              <>
                <div className="list">
                  {resumo.descontoPorOperador.map(([nome, v]) => (
                    <div className="item" key={nome}>
                      <span>
                        {nome} <span className="muted" style={{ fontSize: 11 }}>x{v.quantidade}</span>
                      </span>
                      <span className="tabular">{money(v.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="list no-print" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {resumo.vendasComDesconto.map((v) => (
                    <div className="item" key={v.id} style={{ fontSize: 12.5 }}>
                      <span>
                        {new Date(v.criado_em).toLocaleString('pt-BR')} <span className="muted">· {v.usuarios?.nome || 'Sem operador'}</span>
                      </span>
                      <span className="tabular">{money(v.desconto)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card no-print">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Vendas do período</div>
            {resumo.vendas.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda no período.</p>
            ) : (
              <div className="list">
                {resumo.vendas.map((v) =>
                  cancelandoId === v.id ? (
                    <div key={v.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 13 }}>Cancelar venda de {money(v.total)}?</span>
                      <span className="label">Motivo (opcional)</span>
                      <input value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} />
                      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setCancelandoId(null)}>
                          Voltar
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => confirmarCancelamento(v.id)}>
                          Confirmar cancelamento
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="item" key={v.id}>
                      <span>
                        {new Date(v.criado_em).toLocaleString('pt-BR')} <span className="muted" style={{ fontSize: 11 }}>· {v.usuarios?.nome || 'Sem operador'}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="tabular">{money(v.total)}</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCancelandoId(v.id); setMotivoCancelamento(''); setErro(''); }}>
                          Cancelar
                        </button>
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Produtos mais vendidos</div>
            {resumo.maisVendidos.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda no período.</p>
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
