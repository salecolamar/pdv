import { useEffect, useState } from 'react';
import { Ban, BarChart3, Download, Package, Printer, Search, Ticket, Users2, Wallet } from 'lucide-react';
import { supabase } from '../supabase';
import { money, metodoLabel } from '../utils/format';
import { inicioDoDia, inicioDoMes, subDias } from '../utils/datas';
import { baixarCsv } from '../utils/exportar';

const FILTROS = [
  ['hoje', 'Hoje'],
  ['ontem', 'Ontem'],
  ['dia', 'Um dia específico'],
  ['7dias', 'Últimos 7 dias'],
  ['30dias', 'Últimos 30 dias'],
  ['mes', 'Este mês'],
  ['personalizado', 'Personalizado'],
];

function periodo(filtro, de, ate, dia) {
  const agora = new Date();
  switch (filtro) {
    case 'hoje':
      return [inicioDoDia(agora), agora];
    case 'ontem':
      return [inicioDoDia(subDias(agora, 1)), inicioDoDia(agora)];
    case 'dia':
      return dia ? [inicioDoDia(new Date(`${dia}T00:00:00`)), new Date(`${dia}T23:59:59.999`)] : [null, null];
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
  const [abaPrincipal, setAbaPrincipal] = useState('resumo');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row" style={{ padding: '14px 16px', background: 'linear-gradient(135deg, var(--primary), #6C3CE0)', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <BarChart3 size={18} />
          Acompanhe faturamento, formas de pagamento, operadores e cancelamentos por período.
        </span>
      </div>
      <div className="tab-row">
        <button type="button" className="tab" aria-pressed={abaPrincipal === 'resumo'} onClick={() => setAbaPrincipal('resumo')}>
          <Wallet size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Resumo
        </button>
        <button type="button" className="tab" aria-pressed={abaPrincipal === 'detalhado'} onClick={() => setAbaPrincipal('detalhado')}>
          <Search size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Detalhado
        </button>
        <button type="button" className="tab" aria-pressed={abaPrincipal === 'cancelamentos'} onClick={() => setAbaPrincipal('cancelamentos')}>
          <Ban size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Cancelamentos
        </button>
      </div>
      {abaPrincipal === 'resumo' ? <ResumoVendas /> : abaPrincipal === 'detalhado' ? <RelatorioDetalhado /> : <RelatorioCancelamentos />}
    </div>
  );
}

function RelatorioCancelamentos() {
  const [filtro, setFiltro] = useState('hoje');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dia, setDia] = useState(() => inicioDoDia().toISOString().slice(0, 10));
  const [linhas, setLinhas] = useState(undefined);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, de, ate, dia]);

  async function carregar() {
    const [inicio, fim] = periodo(filtro, de, ate, dia);
    if ((filtro === 'personalizado' || filtro === 'dia') && (!inicio || !fim)) {
      setLinhas(null);
      return;
    }
    setLinhas(undefined);
    setErro('');

    const { data: logs, error: erroLogs } = await supabase
      .from('audit_logs')
      .select('id, acao, detalhes, criado_em, usuarios(nome)')
      .in('acao', ['cancelar_item_pedido', 'cancelar_venda'])
      .gte('criado_em', inicio.toISOString())
      .lte('criado_em', fim.toISOString())
      .order('criado_em', { ascending: false });

    if (erroLogs) {
      setErro(erroLogs.message);
      setLinhas(null);
      return;
    }

    const idsVendaCancelada = (logs || [])
      .filter((l) => l.acao === 'cancelar_venda')
      .map((l) => l.detalhes?.venda_id)
      .filter(Boolean);

    let formasPorVenda = new Map();
    if (idsVendaCancelada.length > 0) {
      const { data: pagamentos } = await supabase.from('pagamentos').select('venda_id, forma').in('venda_id', idsVendaCancelada);
      for (const p of pagamentos || []) {
        const atual = formasPorVenda.get(p.venda_id) || new Set();
        atual.add(p.forma);
        formasPorVenda.set(p.venda_id, atual);
      }
    }

    const novasLinhas = (logs || []).map((l) => {
      const d = l.detalhes || {};
      if (l.acao === 'cancelar_venda') {
        const formas = [...(formasPorVenda.get(d.venda_id) || [])].map(metodoLabel).join(', ');
        return {
          id: l.id,
          produto: 'Venda completa (todos os itens)',
          motivo: d.motivo || '—',
          pagamento: formas || 'Lançamento',
          garcom: l.usuarios?.nome || 'Usuário removido',
          criadoEm: l.criado_em,
          valor: Number(d.total) || 0,
        };
      }
      return {
        id: l.id,
        produto: d.nome_produto || '—',
        motivo: d.motivo || '—',
        pagamento: 'Lançamento',
        garcom: l.usuarios?.nome || 'Usuário removido',
        criadoEm: l.criado_em,
        valor: Number(d.valor) || 0,
      };
    });
    setLinhas(novasLinhas);
  }

  function exportarCsv() {
    baixarCsv(
      `cancelamentos-${filtro}.csv`,
      ['Data', 'Produto', 'Observação', 'Pagamento', 'Garçom', 'Valor'],
      linhas.map((l) => [new Date(l.criadoEm).toLocaleString('pt-BR'), l.produto, l.motivo, l.pagamento, l.garcom, l.valor])
    );
  }

  const totalCancelado = (linhas || []).reduce((s, l) => s + l.valor, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tab-row">
        {FILTROS.map(([id, label]) => (
          <button key={id} type="button" className="tab" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
            {label}
          </button>
        ))}
      </div>

      {filtro === 'dia' && (
        <div className="card">
          <span className="label">Escolha o dia</span>
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      )}

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

      {linhas === undefined ? (
        <p className="muted">Carregando…</p>
      ) : linhas === null ? (
        erro ? (
          <p className="danger-text">Falha ao carregar o relatório: {erro}</p>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Escolha as datas de início e fim.</p>
        )
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Cartao titulo="Total cancelado" valor={money(totalCancelado)} destaque />
            <Cartao titulo="Cancelamentos" valor={linhas.length} />
          </div>

          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={exportarCsv} disabled={linhas.length === 0}>
            <Download size={14} /> Exportar CSV
          </button>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="dash-card-titulo" style={{ padding: '14px 16px 0' }}><Ban size={15} /> Itens e vendas cancelados</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 680 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {['Data', 'Produto', 'Observação', 'Pagamento', 'Garçom', 'Valor'].map((h) => (
                      <th key={h} className="muted" style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 16, textAlign: 'center' }} className="muted">Nenhum cancelamento no período.</td>
                    </tr>
                  ) : (
                    linhas.map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{new Date(l.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '7px 10px' }}>{l.produto}</td>
                        <td style={{ padding: '7px 10px' }}>{l.motivo}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.pagamento}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.garcom}</td>
                        <td className="tabular" style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{money(l.valor)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ResumoVendas() {
  const [filtro, setFiltro] = useState('hoje');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dia, setDia] = useState(() => inicioDoDia().toISOString().slice(0, 10));
  const [resumo, setResumo] = useState(undefined);
  const [erro, setErro] = useState('');
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, de, ate, dia]);

  async function carregar() {
    const [inicio, fim] = periodo(filtro, de, ate, dia);
    if ((filtro === 'personalizado' || filtro === 'dia') && (!inicio || !fim)) {
      setResumo(null);
      return;
    }

    setResumo(undefined);
    setErro('');

    const { data: vendas, error: erroVendas } = await supabase
      .from('vendas')
      .select('id, criado_em, subtotal, desconto, total, operador_id, usuarios(nome, comissao_percentual)')
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
      const pct = Number(v.usuarios?.comissao_percentual) || 0;
      const atual = porOperador.get(nome) || { quantidade: 0, total: 0, comissaoPercentual: pct, comissao: 0 };
      atual.quantidade += 1;
      atual.total += Number(v.total);
      atual.comissao += Number(v.total) * (pct / 100);
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

      {filtro === 'dia' && (
        <div className="card">
          <span className="label">Escolha o dia</span>
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      )}

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
            <div className="dash-card-titulo"><Wallet size={15} /> Por forma de pagamento</div>
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
            <div className="dash-card-titulo"><Users2 size={15} /> Por operador</div>
            {resumo.porOperador.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhuma venda no período.</p>
            ) : (
              <div className="list">
                {resumo.porOperador.map(([nome, v]) => (
                  <div className="item" key={nome} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                    <div className="row">
                      <span>
                        {nome} <span className="muted" style={{ fontSize: 11 }}>x{v.quantidade}</span>
                      </span>
                      <span className="tabular">{money(v.total)}</span>
                    </div>
                    {v.comissaoPercentual > 0 && (
                      <div className="row">
                        <span className="muted" style={{ fontSize: 11 }}>Comissão ({v.comissaoPercentual}%)</span>
                        <span className="tabular success-text" style={{ fontSize: 12 }}>{money(v.comissao)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <div className="dash-card-titulo" style={{ marginBottom: 0 }}><Ticket size={15} /> Descontos</div>
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
            <div className="dash-card-titulo"><Search size={15} /> Vendas do período</div>
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
            <div className="dash-card-titulo"><Package size={15} /> Produtos mais vendidos</div>
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

const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'debito', 'credito', 'outro'];

function RelatorioDetalhado() {
  const [filtro, setFiltro] = useState('hoje');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dia, setDia] = useState(() => inicioDoDia().toISOString().slice(0, 10));
  const [incluirCanceladas, setIncluirCanceladas] = useState(false);
  const [linhas, setLinhas] = useState(undefined);
  const [erro, setErro] = useState('');

  const [operador, setOperador] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('');
  const [forma, setForma] = useState('');
  const [produtoBusca, setProdutoBusca] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [todosProdutos, setTodosProdutos] = useState([]);

  useEffect(() => {
    supabase.from('produtos').select('nome').order('nome').then(({ data }) => setTodosProdutos(data || []));
  }, []);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, de, ate, dia, incluirCanceladas]);

  async function carregar() {
    const [inicio, fim] = periodo(filtro, de, ate, dia);
    if ((filtro === 'personalizado' || filtro === 'dia') && (!inicio || !fim)) {
      setLinhas(null);
      return;
    }
    setLinhas(undefined);
    setErro('');

    let query = supabase
      .from('vendas')
      .select('id, criado_em, cancelada, operador_id, usuarios(nome)')
      .gte('criado_em', inicio.toISOString())
      .lte('criado_em', fim.toISOString());
    if (!incluirCanceladas) query = query.eq('cancelada', false);
    const { data: vendas, error: erroVendas } = await query.order('criado_em', { ascending: false });

    if (erroVendas) {
      setErro(erroVendas.message);
      setLinhas(null);
      return;
    }
    if (vendas.length === 0) {
      setLinhas([]);
      return;
    }

    const vendaIds = vendas.map((v) => v.id);
    const [itensResp, pagamentosResp, pedidosResp] = await Promise.all([
      supabase.from('venda_itens').select('venda_id, produto_id, nome_produto, quantidade, preco_unitario, produtos(categoria_id, categorias(nome))').in('venda_id', vendaIds),
      supabase.from('pagamentos').select('venda_id, forma').in('venda_id', vendaIds),
      supabase.from('pedidos').select('venda_id, mesas(nome)').in('venda_id', vendaIds),
    ]);

    const vendasMap = new Map(vendas.map((v) => [v.id, v]));
    const formasPorVenda = new Map();
    for (const p of pagamentosResp.data || []) {
      const atual = formasPorVenda.get(p.venda_id) || new Set();
      atual.add(p.forma);
      formasPorVenda.set(p.venda_id, atual);
    }
    const mesaPorVenda = new Map();
    for (const p of pedidosResp.data || []) {
      if (p.mesas?.nome) mesaPorVenda.set(p.venda_id, p.mesas.nome);
    }

    const novasLinhas = (itensResp.data || []).map((i) => {
      const venda = vendasMap.get(i.venda_id);
      const mesaNome = mesaPorVenda.get(i.venda_id);
      return {
        vendaId: i.venda_id,
        criadoEm: venda?.criado_em,
        cancelada: venda?.cancelada,
        operador: venda?.usuarios?.nome || 'Sem operador',
        tipo: mesaNome ? 'Mesa' : 'Ficha',
        mesa: mesaNome || '',
        produto: i.nome_produto,
        categoria: i.produtos?.categorias?.nome || 'Sem categoria',
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.preco_unitario),
        total: Number(i.quantidade) * Number(i.preco_unitario),
        formas: [...(formasPorVenda.get(i.venda_id) || [])].map(metodoLabel).join(', '),
      };
    });
    setLinhas(novasLinhas);
  }

  const operadores = [...new Set((linhas || []).map((l) => l.operador))].sort();
  const categorias = [...new Set((linhas || []).map((l) => l.categoria))].sort();

  const linhasFiltradas = (linhas || []).filter((l) => {
    if (operador && l.operador !== operador) return false;
    if (categoria && l.categoria !== categoria) return false;
    if (tipo && l.tipo !== tipo) return false;
    if (forma && !l.formas.toLowerCase().includes(metodoLabel(forma).toLowerCase())) return false;
    if (produtoBusca.trim() && !l.produto.toLowerCase().includes(produtoBusca.trim().toLowerCase())) return false;
    if (valorMin && l.total < Number(valorMin.replace(',', '.'))) return false;
    if (valorMax && l.total > Number(valorMax.replace(',', '.'))) return false;
    return true;
  });

  const totalFiltrado = linhasFiltradas.reduce((s, l) => s + l.total, 0);
  const vendasEnvolvidas = new Set(linhasFiltradas.map((l) => l.vendaId)).size;

  function limparFiltros() {
    setOperador('');
    setCategoria('');
    setTipo('');
    setForma('');
    setProdutoBusca('');
    setValorMin('');
    setValorMax('');
  }

  function exportarCsv() {
    baixarCsv(
      `relatorio-detalhado-${filtro}.csv`,
      ['Data', 'Operador', 'Tipo', 'Mesa', 'Produto', 'Categoria', 'Quantidade', 'Valor unitário', 'Valor total', 'Forma(s) de pagamento', 'Cancelada'],
      linhasFiltradas.map((l) => [
        new Date(l.criadoEm).toLocaleString('pt-BR'),
        l.operador,
        l.tipo,
        l.mesa,
        l.produto,
        l.categoria,
        l.quantidade,
        l.precoUnitario,
        l.total,
        l.formas,
        l.cancelada ? 'Sim' : 'Não',
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

      {filtro === 'dia' && (
        <div className="card">
          <span className="label">Escolha o dia</span>
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      )}

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

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="dash-card-titulo" style={{ marginBottom: 0 }}><Search size={15} /> Filtros</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          <div>
            <span className="label">Operador</span>
            <select value={operador} onChange={(e) => setOperador(e.target.value)}>
              <option value="">Todos</option>
              {operadores.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="Mesa">Mesa</option>
              <option value="Ficha">Ficha</option>
            </select>
          </div>
          <div>
            <span className="label">Forma de pagamento</span>
            <select value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="">Todas</option>
              {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{metodoLabel(f)}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Produto</span>
            <div className="search-input-wrap">
              <Search size={15} />
              <input
                value={produtoBusca}
                onChange={(e) => setProdutoBusca(e.target.value)}
                placeholder="Buscar produto..."
                list="produtos-disponiveis"
              />
            </div>
            <datalist id="produtos-disponiveis">
              {todosProdutos.map((p) => <option key={p.nome} value={p.nome} />)}
            </datalist>
          </div>
          <div>
            <span className="label">Valor mín. (R$)</span>
            <input value={valorMin} onChange={(e) => setValorMin(e.target.value)} inputMode="decimal" placeholder="0" />
          </div>
          <div>
            <span className="label">Valor máx. (R$)</span>
            <input value={valorMax} onChange={(e) => setValorMax(e.target.value)} inputMode="decimal" placeholder="Sem limite" />
          </div>
        </div>
        <label className="row" style={{ fontSize: 13, cursor: 'pointer' }}>
          <span>Incluir vendas canceladas</span>
          <input type="checkbox" checked={incluirCanceladas} onChange={(e) => setIncluirCanceladas(e.target.checked)} />
        </label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={limparFiltros}>
          Limpar filtros
        </button>
      </div>

      {linhas === undefined ? (
        <p className="muted">Carregando…</p>
      ) : linhas === null ? (
        erro ? (
          <p className="danger-text">Falha ao carregar o relatório: {erro}</p>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Escolha as datas de início e fim.</p>
        )
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Cartao titulo="Total filtrado" valor={money(totalFiltrado)} destaque />
            <Cartao titulo="Linhas" valor={linhasFiltradas.length} />
            <Cartao titulo="Vendas envolvidas" valor={vendasEnvolvidas} />
          </div>

          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={exportarCsv} disabled={linhasFiltradas.length === 0}>
            <Download size={14} /> Exportar CSV
          </button>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="dash-card-titulo" style={{ padding: '14px 16px 0' }}><Package size={15} /> Linhas do relatório</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    {['Data', 'Operador', 'Tipo', 'Mesa', 'Produto', 'Categoria', 'Qtd', 'Unit.', 'Total', 'Pagamento'].map((h) => (
                      <th key={h} className="muted" style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 16, textAlign: 'center' }} className="muted">Nenhum resultado com esses filtros.</td>
                    </tr>
                  ) : (
                    linhasFiltradas.map((l, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-soft)', opacity: l.cancelada ? 0.5 : 1 }}>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{new Date(l.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.operador}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.tipo}{l.cancelada ? ' (cancelada)' : ''}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.mesa || '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{l.produto}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.categoria}</td>
                        <td className="tabular" style={{ padding: '7px 10px', textAlign: 'right' }}>{l.quantidade}</td>
                        <td className="tabular" style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(l.precoUnitario)}</td>
                        <td className="tabular" style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{money(l.total)}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.formas || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
