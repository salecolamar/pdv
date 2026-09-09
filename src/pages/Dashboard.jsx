import { useEffect, useState } from 'react';
import { Carregando } from '../components/EstadoVazio';
import {
  Banknote,
  CreditCard,
  Flame,
  Landmark,
  Package,
  Percent,
  QrCode,
  Receipt,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import { inicioDoDia, inicioDoMes, subDias } from '../utils/datas';

const MEDALHA = ['var(--accent-gold)', 'var(--accent-silver)', 'var(--accent-bronze)'];

const FORMAS_PAGAMENTO = [
  { forma: 'dinheiro', label: 'Dinheiro', icon: Banknote, cor: 'var(--success, #2f9e5f)' },
  { forma: 'pix', label: 'Pix', icon: QrCode, cor: 'var(--primary-blue)' },
  { forma: 'debito', label: 'Débito', icon: Landmark, cor: 'var(--primary-violet)' },
  { forma: 'credito', label: 'Crédito', icon: CreditCard, cor: 'var(--primary)' },
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

function inicioDoDiaEm(dataStr) {
  const d = new Date(dataStr + 'T00:00:00');
  return d;
}

function fimDoDiaEm(dataStr) {
  const d = new Date(dataStr + 'T23:59:59.999');
  return d;
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(undefined); // undefined = carregando
  const [erro, setErro] = useState('');
  const hojeStr = () => inicioDoDia().toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(hojeStr);
  const [dataFim, setDataFim] = useState(hojeStr);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim]);

  async function carregar() {
    // Enquanto o admin ainda está digitando a data no seletor nativo, o
    // input passa por estados intermediários vazios/incompletos — ignora
    // esses disparos em vez de tentar montar um período inválido.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) return;

    setResumo(undefined);
    setErro('');

    // Corrige o período se o admin escolher "Até" antes de "De" — sem isso a
    // query em si continuaria funcionando (viraria um intervalo vazio), só
    // não seria o que a pessoa esperava ao mexer nos dois seletores.
    const [dataDe, dataAte] = dataInicio <= dataFim ? [dataInicio, dataFim] : [dataFim, dataInicio];
    const inicioPeriodoDate = inicioDoDiaEm(dataDe);
    const fimPeriodoDate = fimDoDiaEm(dataAte);
    const inicioPeriodo = inicioPeriodoDate.toISOString();
    const fimPeriodo = fimPeriodoDate.toISOString();
    // Período anterior de comparação: mesma duração, imediatamente antes.
    const duracaoDias = Math.max(1, Math.round((fimPeriodoDate - inicioPeriodoDate) / 86400000) + 1);
    const inicioAnterior = inicioDoDia(subDias(inicioPeriodoDate, duracaoDias)).toISOString();
    const mes = inicioDoMes().toISOString();
    const ehHoje = dataDe === hojeStr() && dataAte === hojeStr();
    const ehPeriodoUnico = dataDe === dataAte;

    const [vendasPeriodoResp, vendasAnteriorResp, vendasMesResp, estoqueResp, pagamentosResp, pedidosResp, caixaAbertoResp] = await Promise.all([
      supabase
        .from('vendas')
        .select('id, total, desconto, taxa_servico, criado_em, operador_id, caixa_id, usuarios(nome)')
        .eq('cancelada', false)
        .gte('criado_em', inicioPeriodo)
        .lte('criado_em', fimPeriodo),
      supabase.from('vendas').select('total').eq('cancelada', false).gte('criado_em', inicioAnterior).lt('criado_em', inicioPeriodo),
      supabase.from('vendas').select('total').eq('cancelada', false).gte('criado_em', mes),
      supabase.from('produtos').select('nome, estoque, estoque_minimo').eq('ativo', true).not('estoque', 'is', null).order('estoque', { ascending: true }).limit(5),
      supabase
        .from('pagamentos')
        .select('forma, valor, vendas!inner(criado_em, cancelada)')
        .eq('vendas.cancelada', false)
        .gte('vendas.criado_em', inicioPeriodo)
        .lte('vendas.criado_em', fimPeriodo),
      supabase.from('pedidos').select('venda_id').not('venda_id', 'is', null),
      supabase.from('caixas').select('id').is('fechado_em', null).order('aberto_em', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (vendasPeriodoResp.error || vendasMesResp.error || estoqueResp.error || pagamentosResp.error) {
      setErro((vendasPeriodoResp.error || vendasMesResp.error || estoqueResp.error || pagamentosResp.error).message);
      setResumo(null);
      return;
    }

    const porFormaPagamento = {};
    for (const p of pagamentosResp.data) {
      porFormaPagamento[p.forma] = (porFormaPagamento[p.forma] || 0) + Number(p.valor);
    }

    const vendasPeriodo = vendasPeriodoResp.data;
    const faturamentoHoje = vendasPeriodo.reduce((s, v) => s + Number(v.total), 0);
    const numeroVendas = vendasPeriodo.length;
    const ticketMedio = numeroVendas ? faturamentoHoje / numeroVendas : 0;
    const faturamentoMes = vendasMesResp.data.reduce((s, v) => s + Number(v.total), 0);
    const faturamentoAnterior = (vendasAnteriorResp.data || []).reduce((s, v) => s + Number(v.total), 0);
    const variacao = faturamentoAnterior > 0 ? ((faturamentoHoje - faturamentoAnterior) / faturamentoAnterior) * 100 : faturamentoHoje > 0 ? 100 : 0;
    const taxaServicoTotal = vendasPeriodo.reduce((s, v) => s + Number(v.taxa_servico || 0), 0);
    const descontoTotal = vendasPeriodo.reduce((s, v) => s + Number(v.desconto || 0), 0);

    const idsComMesa = new Set((pedidosResp.data || []).map((p) => p.venda_id));
    const vendasFicha = vendasPeriodo.filter((v) => !idsComMesa.has(v.id));
    const faturamentoFicha = vendasFicha.reduce((s, v) => s + Number(v.total), 0);
    const ticketMedioFicha = vendasFicha.length ? faturamentoFicha / vendasFicha.length : 0;

    const picoVendas = bucketsMeiaHora(vendasPeriodo);

    const mapaGarcons = new Map();
    for (const v of vendasPeriodo) {
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

    const caixaAbertoId = caixaAbertoResp.data?.id || null;
    let topGarcomTaxa = [];
    if (caixaAbertoId) {
      const mapaTaxa = new Map();
      for (const v of vendasPeriodo) {
        if (v.caixa_id !== caixaAbertoId) continue;
        const nome = v.usuarios?.nome || 'Sem operador';
        mapaTaxa.set(nome, (mapaTaxa.get(nome) || 0) + Number(v.taxa_servico || 0));
      }
      topGarcomTaxa = [...mapaTaxa.entries()]
        .map(([nome, total]) => ({ nome, total }))
        .filter((g) => g.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    }

    const estoqueBaixo = estoqueResp.data.filter((p) => p.estoque_minimo == null || Number(p.estoque) <= Number(p.estoque_minimo));

    let maisVendidos = [];
    if (vendasPeriodo.length > 0) {
      const { data: itens, error: erroItens } = await supabase
        .from('venda_itens')
        .select('nome_produto, quantidade, preco_unitario')
        .in('venda_id', vendasPeriodo.map((v) => v.id));
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

    setResumo({
      ehHoje,
      ehPeriodoUnico,
      dataDe,
      dataAte,
      faturamentoHoje,
      faturamentoAnterior,
      variacao,
      faturamentoMes,
      numeroVendas,
      ticketMedio,
      taxaServicoTotal,
      descontoTotal,
      faturamentoFicha,
      numeroVendasFicha: vendasFicha.length,
      ticketMedioFicha,
      maisVendidos,
      picoVendas,
      topGarcons,
      topGarcomTaxa,
      caixaAbertoId,
      estoqueBaixo,
      porFormaPagamento,
    });
  }

  if (resumo === undefined) return <Carregando />;
  if (resumo === null) return <p className="danger-text">Falha ao carregar o dashboard: {erro}</p>;

  const formatarCurta = (dataStr) => new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const dataFormatada = resumo.ehPeriodoUnico
    ? new Date(resumo.dataDe + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    : `${formatarCurta(resumo.dataDe)} até ${formatarCurta(resumo.dataAte)}`;
  const subiu = resumo.variacao >= 0;
  const melhorHorario = resumo.picoVendas.length
    ? resumo.picoVendas.reduce((melhor, b) => (b.total > melhor.total ? b : melhor), resumo.picoVendas[0])
    : null;
  const totalFormas = Object.values(resumo.porFormaPagamento).reduce((s, v) => s + v, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="dash-hero">
        <div className="dash-hero__glow" />
        <div className="dash-hero__top">
          <div>
            <span className="dash-hero__eyebrow"><Sparkles size={13} /> {dataFormatada}</span>
            <h1 className="dash-hero__titulo">
              {resumo.ehHoje ? 'Faturamento de hoje' : resumo.ehPeriodoUnico ? 'Faturamento do dia' : 'Faturamento do período'}
            </h1>
          </div>
          <div className="dash-hero__periodo">
            <input
              type="date"
              value={dataInicio}
              max={dataFim}
              onChange={(e) => setDataInicio(e.target.value)}
              className="dash-hero__data"
              title="De"
            />
            <span className="dash-hero__periodo-ate">até</span>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => setDataFim(e.target.value)}
              className="dash-hero__data"
              title="Até"
            />
          </div>
        </div>
        <div className="dash-hero__valor tabular">{money(resumo.faturamentoHoje)}</div>
        <div className="dash-hero__rodape">
          <span className={'dash-hero__delta' + (subiu ? ' is-up' : ' is-down')}>
            {subiu ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(resumo.variacao).toFixed(0)}% vs. {resumo.ehPeriodoUnico ? 'dia anterior' : 'período anterior'}
          </span>
          <span className="dash-hero__info">{resumo.numeroVendas} vendas · ticket médio {money(resumo.ticketMedio)}</span>
          {!resumo.ehHoje && (
            <button type="button" className="dash-hero__voltar" onClick={() => { setDataInicio(hojeStr()); setDataFim(hojeStr()); }}>
              Voltar pra hoje
            </button>
          )}
        </div>
      </div>

      <SecaoCaixa />

      <div className="dash-grid-stats">
        <CartaoIcone icon={Wallet} cor="var(--primary-violet)" titulo="Faturamento do mês" valor={money(resumo.faturamentoMes)} />
        <CartaoIcone icon={ShoppingBag} cor="var(--primary)" titulo={resumo.ehHoje ? 'Vendas hoje' : resumo.ehPeriodoUnico ? 'Vendas no dia' : 'Vendas no período'} valor={resumo.numeroVendas} />
        <CartaoIcone icon={Receipt} cor="var(--success, #2f9e5f)" titulo="Ticket médio" valor={money(resumo.ticketMedio)} />
        <CartaoIcone icon={Percent} cor="var(--atencao)" titulo="Taxa de serviço" valor={money(resumo.taxaServicoTotal)} />
        <CartaoIcone icon={Ticket} cor="var(--danger)" titulo="Descontos concedidos" valor={money(resumo.descontoTotal)} />
        {melhorHorario && melhorHorario.total > 0 && (
          <CartaoIcone icon={Flame} cor="var(--accent-coral)" titulo="Horário mais forte" valor={rotuloBucket(melhorHorario.idx)} />
        )}
      </div>

      <div className="card">
        <div className="dash-card-titulo"><ShoppingBag size={15} /> Vendas por Ficha (balcão, sem mesa)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <Cartao titulo="Faturamento Ficha" valor={money(resumo.faturamentoFicha)} />
          <Cartao titulo="Vendas Ficha" valor={resumo.numeroVendasFicha} />
          <Cartao titulo="Ticket médio Ficha" valor={money(resumo.ticketMedioFicha)} />
        </div>
      </div>

      <div className="card">
        <div className="dash-card-titulo"><Wallet size={15} /> Recebido no dia por forma de pagamento</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FORMAS_PAGAMENTO.map((f) => {
            const valor = resumo.porFormaPagamento[f.forma] || 0;
            const pct = Math.round((valor / totalFormas) * 100);
            return (
              <div key={f.forma} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="dash-forma-icone" style={{ background: `color-mix(in srgb, ${f.cor} 14%, white)`, color: f.cor }}>
                  <f.icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ marginBottom: 3 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{f.label}</span>
                    <span className="tabular" style={{ fontSize: 13, fontWeight: 800 }}>{money(valor)}</span>
                  </div>
                  <div className="dash-forma-barra">
                    <div className="dash-forma-barra__fill" style={{ width: `${Math.max(pct, valor > 0 ? 3 : 0)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="dash-card-titulo"><Flame size={15} /> Pico de vendas (a cada 30min)</div>
        <GraficoPico buckets={resumo.picoVendas} />
      </div>

      <TendenciaFaturamento />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <Ranking
          titulo="Top produtos"
          icon={Package}
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
          icon={Trophy}
          itens={resumo.topGarcons}
          vazio="Nenhuma venda registrada no período."
          renderLinha={(g) => (
            <>
              <span>
                {g.nome} <span className="muted" style={{ fontSize: 11 }}>x{g.quantidade}</span>
              </span>
              <span className="tabular">{money(g.total)}</span>
            </>
          )}
        />

        {resumo.caixaAbertoId && (
          <Ranking
            titulo="Taxa de serviço por garçom (caixa aberto)"
            icon={Percent}
            itens={resumo.topGarcomTaxa}
            vazio="Nenhuma taxa de serviço registrada nesse caixa ainda."
            renderLinha={(g) => (
              <>
                <span>{g.nome}</span>
                <span className="tabular">{money(g.total)}</span>
              </>
            )}
          />
        )}

        <Ranking
          titulo="Estoque quase acabando"
          icon={Package}
          itens={resumo.estoqueBaixo}
          vazio="Nenhum produto com estoque baixo."
          semMedalha
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

function rotuloCaixa(c) {
  const abertoEm = new Date(c.aberto_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return c.fechado_em ? `Fechado — ${abertoEm}` : `Aberto agora — ${abertoEm}`;
}

function SecaoCaixa() {
  const [caixas, setCaixas] = useState(undefined);
  const [caixaId, setCaixaId] = useState('');
  const [detalhe, setDetalhe] = useState(undefined);

  useEffect(() => {
    carregarCaixas();
  }, []);

  useEffect(() => {
    if (caixaId) carregarDetalhe(caixaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixaId]);

  async function carregarCaixas() {
    const { data } = await supabase
      .from('caixas')
      .select('id, aberto_em, fechado_em, valor_inicial, valor_informado, diferenca, aberto_por_usuario:usuarios!caixas_aberto_por_fkey(nome), fechado_por_usuario:usuarios!caixas_fechado_por_fkey(nome)')
      .order('aberto_em', { ascending: false })
      .limit(30);
    setCaixas(data || []);
    if (data?.length > 0) setCaixaId(data[0].id);
  }

  async function carregarDetalhe(id) {
    setDetalhe(undefined);
    const [pagamentosResp, movimentosResp, vendasResp] = await Promise.all([
      supabase.from('pagamentos').select('forma, valor, vendas!inner(caixa_id, cancelada)').eq('vendas.caixa_id', id).eq('vendas.cancelada', false),
      supabase.from('caixa_movimentos').select('tipo, valor').eq('caixa_id', id),
      supabase.from('vendas').select('id, total').eq('caixa_id', id).eq('cancelada', false),
    ]);
    const porForma = {};
    for (const p of pagamentosResp.data || []) {
      porForma[p.forma] = (porForma[p.forma] || 0) + Number(p.valor);
    }
    const movimentos = (movimentosResp.data || []).reduce((s, m) => s + (m.tipo === 'entrada' ? Number(m.valor) : -Number(m.valor)), 0);
    const totalVendas = (vendasResp.data || []).reduce((s, v) => s + Number(v.total), 0);
    setDetalhe({ porForma, movimentos, totalVendas, numeroVendas: (vendasResp.data || []).length });
  }

  if (caixas === undefined) return null;
  if (caixas.length === 0) {
    return (
      <div className="card">
        <div className="dash-card-titulo"><Wallet size={15} /> Caixa</div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhum caixa aberto ainda.</p>
      </div>
    );
  }

  const caixa = caixas.find((c) => c.id === caixaId);
  const aberto = caixa && !caixa.fechado_em;
  const vendasDinheiro = detalhe?.porForma.dinheiro || 0;
  const esperado = caixa ? Number(caixa.valor_inicial) + vendasDinheiro + (detalhe?.movimentos || 0) : 0;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="dash-card-titulo" style={{ marginBottom: 0 }}><Wallet size={15} /> Caixa</div>
        <select value={caixaId} onChange={(e) => setCaixaId(e.target.value)} style={{ width: 'auto', maxWidth: 260 }}>
          {caixas.map((c) => (
            <option key={c.id} value={c.id}>{rotuloCaixa(c)}</option>
          ))}
        </select>
      </div>

      {caixa && (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className={'chip ' + (aberto ? 'chip-success' : 'chip-primary')}>{aberto ? 'Aberto' : 'Fechado'}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Aberto por {caixa.aberto_por_usuario?.nome || '—'} às{' '}
              {new Date(caixa.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {caixa.fechado_em && (
                <>
                  {' · Fechado por '}{caixa.fechado_por_usuario?.nome || '—'}{' às '}
                  {new Date(caixa.fechado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </>
              )}
            </span>
          </div>

          {detalhe === undefined ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Carregando…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <Cartao titulo="Valor inicial" valor={money(caixa.valor_inicial)} />
              <Cartao titulo="Vendas no caixa" valor={detalhe.numeroVendas} />
              <Cartao titulo="Faturamento" valor={money(detalhe.totalVendas)} />
              <Cartao titulo="Vendas em dinheiro" valor={money(vendasDinheiro)} />
              <Cartao titulo="Entradas/sangrias" valor={money(detalhe.movimentos)} />
              <Cartao titulo="Esperado em dinheiro" valor={money(esperado)} destaque />
              {caixa.fechado_em && (
                <>
                  <Cartao titulo="Informado" valor={money(caixa.valor_informado)} />
                  <Cartao
                    titulo="Diferença"
                    valor={(Number(caixa.diferenca) > 0 ? '+' : '') + money(caixa.diferenca)}
                    destaque
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
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

function Ranking({ titulo, icon: Icon, itens, vazio, renderLinha, semMedalha }) {
  return (
    <div className="card">
      <div className="dash-card-titulo" style={{ marginBottom: 8 }}>
        {Icon && <Icon size={15} />} {titulo}
      </div>
      {itens.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{vazio}</p>
      ) : (
        <div className="list">
          {itens.map((item, idx) => (
            <div className="item" key={idx} style={{ alignItems: 'center', gap: 10 }}>
              {!semMedalha && idx < 3 ? (
                <span className="dash-medalha" style={{ background: MEDALHA[idx] }}>{idx + 1}</span>
              ) : (
                !semMedalha && <span className="dash-medalha dash-medalha--vazia">{idx + 1}</span>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {renderLinha(item)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoIcone({ icon: Icon, cor, titulo, valor }) {
  return (
    <div className="card dash-stat-card">
      <div className="dash-stat-card__icone" style={{ background: `color-mix(in srgb, ${cor} 14%, white)`, color: cor }}>
        <Icon size={17} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>{titulo}</p>
        <p className="tabular" style={{ fontSize: 19, fontWeight: 800, margin: '2px 0 0' }}>{valor}</p>
      </div>
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
