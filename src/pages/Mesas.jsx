import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Calendar, ChevronDown, CreditCard, Lock, Mail, Minus, Package, Phone, Plus, Printer, Receipt, RefreshCw, Search, ShieldCheck, ShoppingCart, Table2, Trash2, User, Users2, Wallet, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money, mascararTelefone, mascararCpf, mascararDataBr, dataBrParaIso, metodoLabel } from '../utils/format';
import { precoEfetivo } from '../utils/promocoes';
import { inicioDoDia } from '../utils/datas';
import Switch from '../components/Switch';
import FormasPagamento from '../components/FormasPagamento';
import EscolhaCard from '../components/EscolhaCard';
import Pdv from './Pdv';

const STATUS_LABEL = { livre: 'Disponível', ocupada: 'Ocupada', reservada: 'Reservada' };
const LIMITE_SEM_PEDIDO_MS = 20 * 60 * 1000;

export default function Mesas() {
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const [abaPdv, setAbaPdv] = useState('mesa');
  const [mesas, setMesas] = useState(null);
  const [ultimoPedidoPorMesa, setUltimoPedidoPorMesa] = useState(new Map());
  const [grupoPorMesa, setGrupoPorMesa] = useState(new Map());
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function carregar() {
    const [mesasResp, pedidosResp] = await Promise.all([
      supabase.from('mesas').select('*').order('nome'),
      supabase.from('pedidos').select('mesa_id, mesas_juntadas, aberto_em, pedido_rodadas(criado_em)').eq('status', 'aberto'),
    ]);
    const listaMesas = (mesasResp.data || []).sort((a, b) => {
      const na = Number(a.nome.match(/\d+/)?.[0]);
      const nb = Number(b.nome.match(/\d+/)?.[0]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.nome.localeCompare(b.nome);
    });
    setMesas(listaMesas);

    const mapaNomes = new Map(listaMesas.map((m) => [m.id, m.nome]));
    const mapaUltimo = new Map();
    const mapaGrupo = new Map();
    for (const p of pedidosResp.data || []) {
      const horarios = (p.pedido_rodadas || []).map((r) => new Date(r.criado_em).getTime());
      const ultimo = horarios.length ? Math.max(...horarios) : new Date(p.aberto_em).getTime();
      const grupo = [p.mesa_id, ...(p.mesas_juntadas || [])];
      const nomesGrupo = grupo.map((id) => mapaNomes.get(id)).filter(Boolean);
      for (const mesaId of grupo) {
        mapaUltimo.set(mesaId, ultimo);
        if (grupo.length > 1) mapaGrupo.set(mesaId, nomesGrupo);
      }
    }
    setUltimoPedidoPorMesa(mapaUltimo);
    setGrupoPorMesa(mapaGrupo);
  }

  if (mesaSelecionada) {
    return (
      <Comanda
        mesa={mesaSelecionada}
        mesas={mesas || []}
        onDadosAlterados={carregar}
        onVoltar={() => {
          setMesaSelecionada(null);
          carregar();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <VendasDoGarcom />
      <div className="row" style={{ gap: 8 }}>
        <div className="tab-row" style={{ flex: 1 }}>
          <button type="button" className="tab" aria-pressed={abaPdv === 'mesa'} onClick={() => setAbaPdv('mesa')}>
            <Table2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Mesa
          </button>
          <button type="button" className="tab" aria-pressed={abaPdv === 'ficha'} onClick={() => setAbaPdv('ficha')}>
            <ShoppingCart size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Ficha
          </button>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={carregar} title="Atualizar dados">
          <RefreshCw size={14} />
        </button>
      </div>

      {abaPdv === 'ficha' ? (
        <Pdv />
      ) : (
        <MapaMesas mesas={mesas} ultimoPedidoPorMesa={ultimoPedidoPorMesa} grupoPorMesa={grupoPorMesa} agora={agora} onAbrirMesa={setMesaSelecionada} />
      )}
    </div>
  );
}

function VendasDoGarcom() {
  const [resumo, setResumo] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil } = await supabase.from('usuarios').select('role, ocultar_vendas, empresas(mostrar_vendas_garcom)').eq('id', user.id).maybeSingle();
      if (cancelado || !perfil || perfil.role !== 'operador' || perfil.ocultar_vendas || !perfil.empresas?.mostrar_vendas_garcom) return;

      const { data: vendas } = await supabase
        .from('vendas')
        .select('total, taxa_servico')
        .eq('operador_id', user.id)
        .eq('cancelada', false)
        .gte('criado_em', inicioDoDia().toISOString());
      if (cancelado) return;
      const total = (vendas || []).reduce((s, v) => s + Number(v.total), 0);
      const taxaServico = (vendas || []).reduce((s, v) => s + Number(v.taxa_servico || 0), 0);
      setResumo({ total, taxaServico, quantidade: vendas?.length || 0 });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (!resumo) return null;

  return (
    <div className="card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, var(--primary), #6C3CE0)', color: '#fff' }}>
      <div className="row">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Suas vendas hoje ({resumo.quantidade})</span>
        <span className="tabular" style={{ fontSize: 18, fontWeight: 800 }}>{money(resumo.total)}</span>
      </div>
      {resumo.taxaServico > 0 && (
        <div className="row" style={{ marginTop: 2 }}>
          <span style={{ fontSize: 11.5, opacity: 0.85 }}>Taxa de serviço</span>
          <span className="tabular" style={{ fontSize: 12.5, fontWeight: 700 }}>{money(resumo.taxaServico)}</span>
        </div>
      )}
    </div>
  );
}

export function HistoricoPDV() {
  const [vendas, setVendas] = useState(null);
  const [produtosAbertos, setProdutosAbertos] = useState(null);
  const [itensPorVenda, setItensPorVenda] = useState(new Map());
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase
      .from('vendas')
      .select('id, total, criado_em, cancelada, clientes(nome), usuarios(nome), pedidos(mesas(nome)), pagamentos(forma)')
      .gte('criado_em', inicioDoDia().toISOString())
      .order('criado_em', { ascending: false });
    setVendas(data || []);
  }

  async function verProdutos(vendaId) {
    if (produtosAbertos === vendaId) {
      setProdutosAbertos(null);
      return;
    }
    setProdutosAbertos(vendaId);
    if (!itensPorVenda.has(vendaId)) {
      const { data } = await supabase.from('venda_itens').select('nome_produto, quantidade, preco_unitario').eq('venda_id', vendaId);
      setItensPorVenda((atual) => new Map(atual).set(vendaId, data || []));
    }
  }

  async function confirmarCancelamento(id) {
    const motivoComAutorizacao = `${motivo.trim()} (autorizado por ${autorizadoPor.nome})`.trim();
    const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: id, p_motivo: motivoComAutorizacao });
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    setCancelandoId(null);
    setAutorizadoPor(null);
    setMotivo('');
    setErro('');
    carregar();
  }

  if (vendas === null) return <p className="muted">Carregando…</p>;
  if (vendas.length === 0) return <p className="muted" style={{ fontSize: 13 }}>Nenhuma movimentação de pagamento hoje ainda.</p>;

  return (
    <div className="list">
      {vendas.map((v) => {
        const mesaNome = v.pedidos?.[0]?.mesas?.nome;
        const formas = [...new Set((v.pagamentos || []).map((p) => metodoLabel(p.forma)))].join(', ');
        return (
          <div key={v.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: v.cancelada ? 0.5 : 1 }}>
            <div className="row">
              <span>
                <span className={'chip ' + (mesaNome ? 'chip-primary' : 'chip-info')} style={{ marginRight: 6 }}>{mesaNome ? `MESA ${mesaNome.match(/\d+/)?.[0] || mesaNome}` : 'FICHA'}</span>
                {v.clientes?.nome || 'Sem cliente'}
                {v.cancelada && <span className="danger-text" style={{ fontSize: 11, marginLeft: 6 }}>(cancelada)</span>}
              </span>
              <span className="tabular" style={{ fontWeight: 700 }}>{money(v.total)}</span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {new Date(v.criado_em).toLocaleString('pt-BR')} · {v.usuarios?.nome || 'Sem operador'} · {formas || '—'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => verProdutos(v.id)}>
                <Package size={13} /> Produtos
              </button>
              {!v.cancelada && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCancelandoId(v.id); setAutorizadoPor(null); setMotivo(''); setErro(''); }}>
                  Cancelar
                </button>
              )}
            </div>
            {produtosAbertos === v.id && (
              <div className="list" style={{ marginTop: 4, borderTop: '1px solid var(--border-soft)', paddingTop: 6 }}>
                {(itensPorVenda.get(v.id) || []).map((i, idx) => (
                  <div key={idx} className="row" style={{ fontSize: 12.5 }}>
                    <span>{i.quantidade}x {i.nome_produto}</span>
                    <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
                  </div>
                ))}
              </div>
            )}
            {cancelandoId === v.id && !autorizadoPor && (
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 6 }}>
                <AutorizacaoGerente
                  titulo="Autorizar cancelamento da venda"
                  onAutorizado={(usuario) => setAutorizadoPor(usuario)}
                  onVoltar={() => setCancelandoId(null)}
                />
              </div>
            )}
            {cancelandoId === v.id && autorizadoPor && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-soft)', paddingTop: 6 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Autorizado por <strong>{autorizadoPor.nome}</strong></span>
                <span className="label">Motivo do cancelamento (opcional)</span>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setCancelandoId(null)}>
                    Voltar
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => confirmarCancelamento(v.id)}>
                    Confirmar cancelamento
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function corMesa(mesa, ultimoPedidoPorMesa, agora) {
  if (mesa.status === 'livre') return { cor: 'var(--success)', chip: 'chip-success', label: 'Disponível' };
  if (mesa.status === 'reservada') return { cor: 'var(--info)', chip: 'chip-info', label: 'Reservada' };
  const ultimo = ultimoPedidoPorMesa.get(mesa.id);
  if (ultimo && agora - ultimo > LIMITE_SEM_PEDIDO_MS) {
    return { cor: 'var(--atencao)', chip: 'chip-atencao', label: `Sem pedido há ${Math.floor((agora - ultimo) / 60000)}min` };
  }
  return { cor: 'var(--danger)', chip: 'chip-danger', label: 'Ocupada' };
}

function IconeMesa() {
  return (
    <svg viewBox="0 0 24 24" fill="#fff" width="100%" height="100%">
      <rect x="2.3" y="4.6" width="3.2" height="8" rx="1.4" />
      <rect x="18.5" y="4.6" width="3.2" height="8" rx="1.4" />
      <path d="M2.6 12.4c.4 2.6 1.4 6.5 1.4 6.5h1.8s.7-4 .9-6.5z" />
      <path d="M21.4 12.4c-.4 2.6-1.4 6.5-1.4 6.5h-1.8s-.7-4-.9-6.5z" />
      <rect x="6.8" y="9.6" width="10.4" height="2.6" rx="1.3" />
      <rect x="10.8" y="12.2" width="2.4" height="4.6" />
      <rect x="8.6" y="16.8" width="6.8" height="1.6" rx="0.8" />
    </svg>
  );
}

function MapaMesas({ mesas, ultimoPedidoPorMesa, grupoPorMesa, agora, onAbrirMesa }) {
  if (mesas === null) return <p className="muted">Carregando…</p>;
  if (mesas.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa cadastrada ainda. Peça pro admin cadastrar em Mapa de Mesas.</p>;
  }

  return (
    <div className="mesa-grid">
      {mesas.map((m) => {
        const { cor, label } = corMesa(m, ultimoPedidoPorMesa, agora);
        const numero = (m.nome.match(/\d+/) || [m.nome])[0];
        const grupo = grupoPorMesa.get(m.id);
        return (
          <button
            key={m.id}
            type="button"
            className="mesa-card"
            disabled={m.status === 'reservada'}
            style={{ '--mesa-cor': cor }}
            onClick={() => onAbrirMesa(m)}
          >
            <span className="mesa-card__numero">{numero}</span>
            <span className="mesa-card__icon-wrap">
              <IconeMesa />
            </span>
            <span className="mesa-card__nome">MESA {numero}</span>
            {grupo && <span className="muted" style={{ fontSize: 10 }}>junto com {grupo.filter((n) => n !== m.nome).join(', ')}</span>}
            <span className="mesa-card__status">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Comanda({ mesa, mesas, onVoltar, onDadosAlterados }) {
  const [pedido, setPedido] = useState(undefined);
  const [precisaCliente, setPrecisaCliente] = useState(false);
  const [rodadas, setRodadas] = useState([]);
  const [pagamentosParciais, setPagamentosParciais] = useState([]);
  const [lancando, setLancando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [vendoConta, setVendoConta] = useState(false);
  const [transferindoMesa, setTransferindoMesa] = useState(false);
  const [juntandoMesas, setJuntandoMesas] = useState(false);
  const [transferindoItem, setTransferindoItem] = useState(null);
  const [pagamentoParcialAberto, setPagamentoParcialAberto] = useState(false);
  const [pagandoSelecionados, setPagandoSelecionados] = useState(false);
  const [toast, setToast] = useState(null);
  const [taxaPercentual, setTaxaPercentual] = useState(0);
  const [taxaAtiva, setTaxaAtiva] = useState(true);
  const [colapsadas, setColapsadas] = useState(new Set());
  const [itensSelecionados, setItensSelecionados] = useState(new Set());
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState(null);
  const [permissoesAtual, setPermissoesAtual] = useState({ role: 'admin', permissoes: {} });
  const [cancelando, setCancelando] = useState(false);

  function alternarSelecaoItem(itemId) {
    setItensSelecionados((atual) => {
      const nova = new Set(atual);
      if (nova.has(itemId)) nova.delete(itemId);
      else nova.add(itemId);
      return nova;
    });
  }

  async function confirmarCancelamentoSelecionados(motivo) {
    setCancelando(true);
    for (const itemId of itensSelecionados) {
      await supabase.rpc('cancelar_item_pedido', { p_item_id: itemId, p_motivo: motivo || null });
    }
    setCancelando(false);
    setConfirmandoCancelamento(false);
    setItensSelecionados(new Set());
    avisar('Item(ns) cancelado(s).', 'success');
    carregarRodadas(pedido.id);
  }

  function alternarColapso(rodadaId) {
    setColapsadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(rodadaId)) nova.delete(rodadaId);
      else nova.add(rodadaId);
      return nova;
    });
  }

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('empresas(taxa_servico_percentual)')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTaxaPercentual(Number(data?.empresas?.taxa_servico_percentual) || 0));
  }, []);

  useEffect(() => {
    verificarPedido();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('usuarios')
        .select('role, permissoes')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setPermissoesAtual({ role: data.role, permissoes: data.permissoes || {} });
        });
    });
  }, []);

  const podeCancelar = permissoesAtual.role !== 'operador' || !!permissoesAtual.permissoes.cancelar_venda;
  const podeDarDesconto = permissoesAtual.role !== 'operador' || !!permissoesAtual.permissoes.dar_desconto;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function avisar(msg, kind) {
    setToast({ msg, kind, key: Date.now() });
  }

  async function verificarPedido() {
    const { data: existente } = await supabase
      .from('pedidos')
      .select('*, clientes(nome)')
      .or(`mesa_id.eq.${mesa.id},mesas_juntadas.cs.{${mesa.id}}`)
      .in('status', ['aberto', 'fechado', 'pago'])
      .order('aberto_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente && existente.status !== 'pago') {
      setPedido(existente);
      carregarRodadas(existente.id);
      carregarPagamentosParciais(existente.id);
      return;
    }

    setPrecisaCliente(true);
  }

  async function abrirComCliente(dadosCliente) {
    const { data: cliente, error: erroCliente } = await supabase
      .from('clientes')
      .insert(dadosCliente)
      .select()
      .single();
    if (erroCliente) {
      avisar(erroCliente.message, 'danger');
      return false;
    }

    const { data: novo, error } = await supabase
      .from('pedidos')
      .insert({ mesa_id: mesa.id, cliente_id: cliente.id })
      .select('*, clientes(nome)')
      .single();
    if (error) {
      avisar(error.message, 'danger');
      return false;
    }

    setPrecisaCliente(false);
    setPedido(novo);
    setRodadas([]);
    return true;
  }

  async function carregarRodadas(pedidoId) {
    const { data } = await supabase
      .from('pedido_rodadas')
      .select('*, pedido_itens(*), usuarios(nome)')
      .eq('pedido_id', pedidoId)
      .order('criado_em');
    setRodadas(data || []);
  }

  async function carregarPagamentosParciais(pedidoId) {
    const { data } = await supabase
      .from('pedido_pagamentos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('criado_em');
    setPagamentosParciais(data || []);
  }

  async function cancelarItem(itemId) {
    if (!window.confirm('Cancelar esse item da comanda? O estoque volta a subir.')) return;
    const motivo = window.prompt('Motivo do cancelamento (opcional):') || null;
    const { error } = await supabase.rpc('cancelar_item_pedido', { p_item_id: itemId, p_motivo: motivo });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    avisar('Item cancelado.', 'success');
    carregarRodadas(pedido.id);
  }

  async function juntarMesas(mesaIds) {
    const { error } = await supabase.rpc('juntar_mesas', { p_pedido_id: pedido.id, p_mesa_ids: mesaIds });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    setJuntandoMesas(false);
    avisar('Mesas juntadas!', 'success');
    verificarPedido();
    onDadosAlterados?.();
  }

  async function separarMesa(mesaId) {
    const { error } = await supabase.rpc('separar_mesa', { p_pedido_id: pedido.id, p_mesa_id: mesaId });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    avisar('Mesa separada.', 'success');
    verificarPedido();
    onDadosAlterados?.();
  }

  async function transferirMesaPara(mesaDestinoId) {
    const { error } = await supabase.rpc('transferir_mesa', { p_pedido_id: pedido.id, p_mesa_destino_id: mesaDestinoId });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return;
    }
    setTransferindoMesa(false);
    onDadosAlterados?.();
    onVoltar();
  }

  async function transferirItemPara(itens, mesaDestinoId) {
    for (const item of itens) {
      const { error } = await supabase.rpc('transferir_item_pedido', { p_item_id: item.id, p_mesa_destino_id: mesaDestinoId });
      if (error) {
        avisar(error.message.replace('P0001: ', ''), 'danger');
        return;
      }
    }
    setTransferindoItem(null);
    setItensSelecionados(new Set());
    avisar(itens.length > 1 ? `${itens.length} itens transferidos.` : 'Item transferido.', 'success');
    carregarRodadas(pedido.id);
    onDadosAlterados?.();
  }

  async function registrarPagamentoParcial(forma, valor) {
    const { error } = await supabase.rpc('registrar_pagamento_parcial', { p_pedido_id: pedido.id, p_forma: forma, p_valor: valor });
    if (error) {
      avisar(error.message.replace('P0001: ', ''), 'danger');
      return false;
    }
    setPagamentoParcialAberto(false);
    avisar('Pagamento parcial registrado.', 'success');
    carregarPagamentosParciais(pedido.id);
    return true;
  }

  async function fecharEReceberPagamento() {
    await supabase.from('pedidos').update({ status: 'fechado', fechado_em: new Date().toISOString() }).eq('id', pedido.id);
    setPedido((p) => ({ ...p, status: 'fechado' }));
    setPagando(true);
  }

  function irParaPagamento() {
    setPagando(true);
  }

  async function reabrirComanda() {
    await supabase.from('pedidos').update({ status: 'aberto', fechado_em: null }).eq('id', pedido.id);
    setPedido((p) => ({ ...p, status: 'aberto' }));
    avisar('Comanda reaberta.', 'success');
  }

  if (precisaCliente) {
    return <FormAbrirMesa mesa={mesa} onAbrir={abrirComCliente} onVoltar={onVoltar} />;
  }

  if (pedido === undefined) return <p className="muted">Carregando…</p>;
  if (pedido === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="muted">Não foi possível abrir essa mesa.</p>
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
          <X size={14} /> Voltar ao mapa
        </button>
      </div>
    );
  }

  const total = rodadas.reduce(
    (s, r) => s + r.pedido_itens.filter((i) => !i.cancelado).reduce((si, i) => si + i.quantidade * i.preco_unitario, 0),
    0
  );
  const taxaValor = taxaAtiva ? Math.round(total * (taxaPercentual / 100) * 100) / 100 : 0;
  const totalComTaxa = total + taxaValor;
  const valorPago = pagamentosParciais.reduce((s, p) => s + Number(p.valor), 0);
  const restante = Math.max(0, totalComTaxa - valorPago);
  const grupoMesasIds = [pedido.mesa_id, ...(pedido.mesas_juntadas || [])];
  const mesasEnvolvidas = grupoMesasIds.map((id) => mesas.find((m) => m.id === id)).filter(Boolean);
  const tituloComanda = mesasEnvolvidas.length > 1
    ? mesasEnvolvidas.map((m) => `MESA ${(m.nome.match(/\d+/) || [m.nome])[0]}`).join(' + ')
    : `MESA ${(mesa.nome.match(/\d+/) || [mesa.nome])[0]}`;
  const mesasDestinoTransferirMesa = mesas.filter((m) => !grupoMesasIds.includes(m.id) && m.status === 'livre');
  const mesasDestinoTransferirItem = mesas.filter((m) => !grupoMesasIds.includes(m.id));
  const mesasDestinoJuntar = mesas.filter((m) => !grupoMesasIds.includes(m.id) && m.status === 'livre');

  if (vendoConta) {
    return (
      <ContaMesa
        mesa={mesa}
        pedido={pedido}
        rodadas={rodadas}
        total={total}
        taxaPercentual={taxaPercentual}
        taxaAtiva={taxaAtiva}
        valorPago={valorPago}
        onVoltar={() => setVendoConta(false)}
      />
    );
  }

  if (transferindoMesa) {
    return (
      <TransferirMesaForm
        mesa={mesa}
        mesasDestino={mesasDestinoTransferirMesa}
        onConfirmar={transferirMesaPara}
        onVoltar={() => setTransferindoMesa(false)}
      />
    );
  }

  if (juntandoMesas) {
    return (
      <JuntarMesasForm
        mesasDestino={mesasDestinoJuntar}
        onConfirmar={juntarMesas}
        onVoltar={() => setJuntandoMesas(false)}
      />
    );
  }

  if (transferindoItem) {
    return (
      <TransferirItemForm
        itens={transferindoItem}
        mesa={mesa}
        mesasDestino={mesasDestinoTransferirItem}
        onConfirmar={(mesaDestinoId) => transferirItemPara(transferindoItem, mesaDestinoId)}
        onVoltar={() => setTransferindoItem(null)}
      />
    );
  }

  if (pagamentoParcialAberto) {
    return (
      <PagamentoParcialForm
        restante={restante}
        onConfirmar={registrarPagamentoParcial}
        onVoltar={() => setPagamentoParcialAberto(false)}
      />
    );
  }

  if (pagandoSelecionados) {
    const itens = rodadas
      .flatMap((r) => r.pedido_itens)
      .filter((i) => itensSelecionados.has(i.id) && !i.cancelado);
    return (
      <PagamentoParcialForm
        restante={restante}
        itensSelecionados={itens}
        taxaPercentual={taxaAtiva ? taxaPercentual : 0}
        onConfirmar={async (forma, valor) => {
          const ok = await registrarPagamentoParcial(forma, valor);
          if (ok) {
            setPagandoSelecionados(false);
            setItensSelecionados(new Set());
          }
          return ok;
        }}
        onVoltar={() => setPagandoSelecionados(false)}
      />
    );
  }

  if (lancando) {
    return (
      <LancarItens
        pedido={pedido}
        tituloComanda={tituloComanda}
        onVoltar={() => setLancando(false)}
        onLancado={() => {
          setLancando(false);
          carregarRodadas(pedido.id);
          avisar('Itens lançados na cozinha!', 'success');
        }}
      />
    );
  }

  if (pagando) {
    return (
      <FinalizarPedido
        pedido={pedido}
        rodadas={rodadas}
        total={total}
        valorPago={valorPago}
        taxaPercentual={taxaPercentual}
        taxaAtiva={taxaAtiva}
        onAlternarTaxa={setTaxaAtiva}
        podeCancelar={podeCancelar}
        podeDarDesconto={podeDarDesconto}
        onCancelarItem={async (itemId) => {
          await cancelarItem(itemId);
        }}
        onVoltar={() => setPagando(false)}
        onConcluido={() => {
          onVoltar();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
          <X size={14} /> Voltar ao mapa
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          title="Atualizar dados (preços, itens, mesa)"
          onClick={() => { verificarPedido(); carregarRodadas(pedido.id); carregarPagamentosParciais(pedido.id); }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {((pedido.status !== 'pago' && restante > 0) || (pedido.status === 'aberto' && itensSelecionados.size > 0)) && (
        <div className="tab-row">
          {pedido.status !== 'pago' && restante > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPagamentoParcialAberto(true)}>
              <Wallet size={14} /> Pagamento parcial
            </button>
          )}
          {pedido.status === 'aberto' && itensSelecionados.size > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPagandoSelecionados(true)}>
              <Wallet size={14} /> Pagar selecionados ({itensSelecionados.size})
            </button>
          )}
        </div>
      )}

      {pedido.status === 'aberto' && itensSelecionados.size > 0 && (
        <div className="tab-row" style={{ background: 'var(--panel-2)', borderRadius: 12, padding: 6 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const itens = rodadas
                .flatMap((r) => r.pedido_itens)
                .filter((i) => itensSelecionados.has(i.id) && !i.cancelado);
              setTransferindoItem(itens);
            }}
          >
            <ArrowRightLeft size={14} /> Transferir ({itensSelecionados.size})
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => { setAutorizadoPor(null); setMotivoCancelamento(''); setConfirmandoCancelamento(true); }}
          >
            <Trash2 size={14} /> Cancelar ({itensSelecionados.size})
          </button>
        </div>
      )}

      <div className="tab-row">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setVendoConta(true)}>
          <Receipt size={14} /> Imprimir conta
        </button>
        {pedido.status === 'aberto' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setTransferindoMesa(true)} disabled={rodadas.length === 0}>
            <ArrowRightLeft size={14} /> Transferir mesa
          </button>
        )}
        {pedido.status === 'aberto' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setJuntandoMesas(true)} disabled={mesasDestinoJuntar.length === 0}>
            <Users2 size={14} /> Juntar mesa
          </button>
        )}
      </div>

      {pedido.status === 'aberto' && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => setLancando(true)}>
          Lançar itens
        </button>
      )}

      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>{tituloComanda}</h1>
        {pedido.clientes?.nome && (
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', margin: '2px 0 0' }}>{pedido.clientes.nome}</p>
        )}
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {pedido.status === 'aberto' ? 'Comanda aberta' : pedido.status === 'fechado' ? 'Aguardando pagamento' : 'Paga'}
        </p>
        {mesasEnvolvidas.length > 1 && pedido.status === 'aberto' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {mesasEnvolvidas.filter((m) => m.id !== pedido.mesa_id).map((m) => (
              <button key={m.id} type="button" className="chip chip-primary" style={{ border: 'none', cursor: 'pointer' }} onClick={() => separarMesa(m.id)}>
                {m.nome} ✕
              </button>
            ))}
          </div>
        )}
      </div>

      {taxaPercentual > 0 && (
        <div className="card row" style={{ padding: '8px 12px' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>Taxa de serviço ({taxaPercentual}%) {taxaAtiva ? money(taxaValor) : money(0)}</span>
          <Switch checked={taxaAtiva} onChange={setTaxaAtiva} />
        </div>
      )}

      <div className="list">
        {rodadas.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhum item lançado ainda.</p>
        ) : (
          rodadas.map((r) => {
            const dataHora = new Date(r.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const colapsada = colapsadas.has(r.id);
            const subtotalRodada = r.pedido_itens.filter((i) => !i.cancelado).reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
            return (
              <div key={r.id} className="card rodada-card">
                <div className="rodada-card__header" onClick={() => alternarColapso(r.id)}>
                  <ChevronDown size={16} className={'rodada-card__chevron' + (colapsada ? ' is-colapsado' : '')} />
                  <div className="rodada-card__meta">
                    <span className="rodada-card__operador">{r.usuarios?.nome || 'Operador'}</span>
                    <span className="rodada-card__data">{dataHora}</span>
                  </div>
                  <span className={'chip ' + (r.status === 'pronto' ? 'chip-success' : 'chip-primary')}>
                    {r.status === 'pronto' ? 'Pronto' : 'Na cozinha'}
                  </span>
                </div>
                {!colapsada && (
                  <>
                    {r.pedido_itens.map((i) => (
                      <div className="rodada-item" key={i.id} style={{ opacity: i.cancelado ? 0.5 : 1 }}>
                        {pedido.status === 'aberto' && !i.cancelado ? (
                          <input
                            type="checkbox"
                            className="rodada-item__check"
                            title="Selecionar pra cancelar"
                            checked={itensSelecionados.has(i.id)}
                            onChange={() => alternarSelecaoItem(i.id)}
                          />
                        ) : (
                          <span style={{ width: 16 }} />
                        )}
                        <span className="rodada-item__nome" style={{ textDecoration: i.cancelado ? 'line-through' : 'none' }}>
                          {i.quantidade}x {i.nome_produto}{i.cancelado ? ' (cancelado)' : ''}
                        </span>
                        <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
                        {pedido.status === 'aberto' && !i.cancelado && (
                          <button
                            type="button"
                            title="Transferir item"
                            onClick={() => setTransferindoItem([i])}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 2 }}
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="rodada-card__subtotal">
                      <span>Valor total</span>
                      <span className="tabular">{money(subtotalRodada)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {valorPago > 0 && (
        <div className="card row" style={{ fontSize: 13 }}>
          <span className="muted">Valor já pago</span>
          <span className="tabular success-text">{money(valorPago)}</span>
        </div>
      )}

      {toast && (
        <div className={'toast is-visible' + (toast.kind ? ' is-' + toast.kind : '')} key={toast.key}>
          {toast.msg}
        </div>
      )}

      {pedido.status === 'fechado' && (
        <button type="button" className="btn btn-secondary btn-block" onClick={reabrirComanda}>
          Reabrir comanda (lançar mais itens)
        </button>
      )}

      {pedido.status === 'pago' && (
        <p className="success-text" style={{ textAlign: 'center' }}>Comanda paga — mesa liberada para o próximo grupo.</p>
      )}

      {pedido.status !== 'pago' && (
        <div className="comanda-bottombar">
          <div className="comanda-bottombar__stats">
            <div className="comanda-bottombar__stat">
              <span className="comanda-bottombar__stat-label">Consumido</span>
              <span className="comanda-bottombar__stat-value">{money(total)}</span>
            </div>
            <div className="comanda-bottombar__stat">
              <span className="comanda-bottombar__stat-label">Valor a pagar</span>
              <span className="comanda-bottombar__stat-value">{money(restante)}</span>
            </div>
          </div>
          <button
            type="button"
            className="comanda-bottombar__btn"
            disabled={rodadas.length === 0}
            onClick={pedido.status === 'aberto' ? fecharEReceberPagamento : irParaPagamento}
          >
            Pagar
          </button>
        </div>
      )}

      {confirmandoCancelamento && !autorizadoPor && (
        <div className="modal-overlay" onClick={() => !cancelando && setConfirmandoCancelamento(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <AutorizacaoGerente
              titulo={`Autorizar cancelamento de ${itensSelecionados.size} ${itensSelecionados.size === 1 ? 'item' : 'itens'}`}
              onAutorizado={(usuario) => setAutorizadoPor(usuario)}
              onVoltar={() => setConfirmandoCancelamento(false)}
            />
          </div>
        </div>
      )}

      {confirmandoCancelamento && autorizadoPor && (
        <div className="modal-overlay" onClick={() => !cancelando && setConfirmandoCancelamento(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Cancelar {itensSelecionados.size} {itensSelecionados.size === 1 ? 'item' : 'itens'}?</h2>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Autorizado por <strong>{autorizadoPor.nome}</strong>. O estoque volta a subir e o valor sai da comanda. Essa ação não pode ser desfeita.
            </p>
            <span className="label">Motivo do cancelamento (opcional)</span>
            <input
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: pedido errado, cliente desistiu…"
              autoFocus
            />
            <div className="modal-box__actions">
              <button type="button" className="btn btn-secondary" disabled={cancelando} onClick={() => setConfirmandoCancelamento(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={cancelando}
                onClick={() => {
                  confirmarCancelamentoSelecionados(`${motivoCancelamento.trim()} (autorizado por ${autorizadoPor.nome})`.trim());
                  setMotivoCancelamento('');
                }}
              >
                {cancelando ? 'Cancelando…' : 'Cancelar itens'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AutorizacaoGerente({ titulo, onAutorizado, onVoltar }) {
  const [autorizadores, setAutorizadores] = useState(null);
  const [usuarioId, setUsuarioId] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('id, nome, role, permissoes')
      .eq('ativo', true)
      .then(({ data }) => {
        const elegiveis = (data || []).filter((u) => u.role === 'admin' || u.role === 'gerente' || u.permissoes?.cancelar_venda);
        setAutorizadores(elegiveis);
        if (elegiveis.length > 0) setUsuarioId(elegiveis[0].id);
      });
  }, []);

  async function confirmar(e) {
    e.preventDefault();
    setErro('');
    if (!usuarioId) {
      setErro('Nenhum usuário disponível pra autorizar.');
      return;
    }
    if (!senha) {
      setErro('Digite a senha (ou PIN).');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.rpc('verificar_autorizacao_cancelamento', { p_usuario_id: usuarioId, p_senha: senha });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      setSenha('');
      return;
    }
    const usuario = autorizadores.find((u) => u.id === usuarioId);
    onAutorizado(usuario);
  }

  return (
    <form onSubmit={confirmar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--atencao)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Lock size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16.5 }}>{titulo || 'Autorização necessária'}</h2>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Precisa de um gerente ou admin pra confirmar.</p>
        </div>
      </div>

      {autorizadores === null ? (
        <p className="muted" style={{ fontSize: 13 }}>Carregando…</p>
      ) : autorizadores.length === 0 ? (
        <p className="danger-text" style={{ fontSize: 13 }}>Nenhum usuário com permissão de cancelamento cadastrado.</p>
      ) : (
        <>
          <span className="label">Autorizado por</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {autorizadores.map((u) => (
              <EscolhaCard
                key={u.id}
                selecionado={usuarioId === u.id}
                onClick={() => setUsuarioId(u.id)}
                icon={u.role === 'admin' ? ShieldCheck : User}
                titulo={u.nome}
                descricao={u.role === 'admin' ? 'Admin' : u.role === 'gerente' ? 'Gerente' : 'Garçom gerente'}
              />
            ))}
          </div>
          <span className="label">Senha (ou PIN)</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••"
            autoFocus
          />
        </>
      )}

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <div className="modal-box__actions">
        <button type="button" className="btn btn-secondary" disabled={enviando} onClick={onVoltar}>
          Voltar
        </button>
        <button type="submit" className="btn btn-primary" disabled={enviando || !autorizadores?.length}>
          {enviando ? 'Verificando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  );
}

function ContaMesa({ mesa, pedido, rodadas, total, taxaPercentual, taxaAtiva, valorPago, onVoltar }) {
  const itens = rodadas.flatMap((r) => r.pedido_itens.filter((i) => !i.cancelado).map((i) => ({ ...i, rodada: r })));

  const taxaValor = taxaAtiva ? Math.round(total * (taxaPercentual / 100) * 100) / 100 : 0;
  const totalComTaxa = total + taxaValor;
  const restanteComTaxa = Math.max(0, totalComTaxa - valorPago);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{mesa.nome}</h1>
          {pedido.clientes?.nome && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Cliente: {pedido.clientes.nome}</p>}
        </div>

        <div className="list">
          {itens.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Nenhum item lançado.</p>
          ) : (
            itens.map((i) => (
              <div key={i.id} className="row" style={{ fontSize: 13, padding: '3px 0' }}>
                <span>{i.quantidade}x {i.nome_produto}</span>
                <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
              </div>
            ))
          )}
        </div>

        <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 13 }}>
          <span className="muted">Subtotal</span>
          <span className="tabular">{money(total)}</span>
        </div>
        {taxaPercentual > 0 && (
          <div className="row" style={{ fontSize: 13 }}>
            <span className="muted">Taxa de serviço ({taxaPercentual}%){!taxaAtiva && ' — desativada'}</span>
            <span className="tabular">{money(taxaValor)}</span>
          </div>
        )}
        <div className="row">
          <span style={{ fontWeight: 700 }}>Total</span>
          <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{money(totalComTaxa)}</span>
        </div>
        {valorPago > 0 && (
          <>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">Já pago</span>
              <span className="tabular success-text">{money(valorPago)}</span>
            </div>
            <div className="row" style={{ fontSize: 13 }}>
              <span className="muted">Restante</span>
              <span className="tabular" style={{ fontWeight: 700 }}>{money(restanteComTaxa)}</span>
            </div>
          </>
        )}
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => window.print()}>
        <Printer size={15} /> Imprimir
      </button>
    </div>
  );
}

function TransferirMesaForm({ mesa, mesasDestino, onConfirmar, onVoltar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Transferir {mesa.nome}</h1>
        <p className="muted" style={{ fontSize: 13 }}>Escolha uma mesa livre para levar toda a comanda.</p>
      </div>
      {mesasDestino.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa livre no momento.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {mesasDestino.map((m) => (
            <EscolhaCard key={m.id} selecionado={false} onClick={() => onConfirmar(m.id)} icon={Table2} titulo={m.nome} />
          ))}
        </div>
      )}
    </div>
  );
}

function JuntarMesasForm({ mesasDestino, onConfirmar, onVoltar }) {
  const [selecionadas, setSelecionadas] = useState([]);

  function alternar(id) {
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Juntar mesas</h1>
        <p className="muted" style={{ fontSize: 13 }}>Escolha quais mesas livres entram nessa comanda.</p>
      </div>
      {mesasDestino.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa livre no momento.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {mesasDestino.map((m) => (
            <EscolhaCard
              key={m.id}
              selecionado={selecionadas.includes(m.id)}
              onClick={() => alternar(m.id)}
              icon={Table2}
              titulo={m.nome}
              descricao={selecionadas.includes(m.id) ? 'Selecionada' : undefined}
            />
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={selecionadas.length === 0} onClick={() => onConfirmar(selecionadas)}>
        Juntar {selecionadas.length > 0 ? `(${selecionadas.length})` : ''}
      </button>
    </div>
  );
}

function TransferirItemForm({ itens, mesa, mesasDestino, onConfirmar, onVoltar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>{itens.length > 1 ? `Transferir ${itens.length} itens` : 'Transferir item'}</h1>
        <p className="muted" style={{ fontSize: 13 }}>de {mesa.nome} para qual mesa?</p>
      </div>
      <div className="list">
        {itens.map((item) => (
          <div key={item.id} className="card row" style={{ padding: '8px 12px', fontSize: 13 }}>
            <span>{item.quantidade}x {item.nome_produto}</span>
            <span className="tabular">{money(item.quantidade * item.preco_unitario)}</span>
          </div>
        ))}
      </div>
      {mesasDestino.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma outra mesa cadastrada.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {mesasDestino.map((m) => (
            <EscolhaCard
              key={m.id}
              selecionado={false}
              onClick={() => onConfirmar(m.id)}
              icon={Table2}
              titulo={m.nome}
              descricao={STATUS_LABEL[m.status] || m.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PagamentoParcialForm({ restante, itensSelecionados, taxaPercentual = 0, onConfirmar, onVoltar }) {
  const subtotalSelecionado = itensSelecionados
    ? itensSelecionados.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
    : restante;
  const taxaSelecionada = itensSelecionados && taxaPercentual > 0 ? Math.round(subtotalSelecionado * (taxaPercentual / 100) * 100) / 100 : 0;
  const valorSugerido = Math.min(subtotalSelecionado + taxaSelecionada, restante);
  const [forma, setForma] = useState('dinheiro');
  const [valor, setValor] = useState(valorSugerido.toFixed(2));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const travado = !!itensSelecionados;

  async function confirmar() {
    setErro('');
    const num = Number(valor.replace(',', '.'));
    if (!(num > 0)) {
      setErro('Informe um valor válido.');
      return;
    }
    if (num > restante + 0.01) {
      setErro('Esse valor é maior que o restante da comanda.');
      return;
    }
    setEnviando(true);
    const ok = await onConfirmar(forma, num);
    setEnviando(false);
    if (!ok) setErro('Não foi possível registrar o pagamento.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="pay-stats-grid">
        <div className="pay-stat">
          <span className="pay-stat__label">Restante da comanda</span>
          <span className="pay-stat__value">{money(restante)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">{travado ? 'Itens selecionados' : 'Pagamento parcial'}</span>
          <span className="pay-stat__value">{money(valorSugerido)}</span>
        </div>
      </div>

      {itensSelecionados && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">Itens a pagar</span>
          {itensSelecionados.map((item) => (
            <div key={item.id} className="row" style={{ fontSize: 13 }}>
              <span>{item.quantidade}x {item.nome_produto}</span>
              <span className="tabular">{money(item.quantidade * item.preco_unitario)}</span>
            </div>
          ))}
          {taxaSelecionada > 0 && (
            <div className="row" style={{ fontSize: 13, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
              <span className="muted">Taxa de serviço ({taxaPercentual}%)</span>
              <span className="tabular">{money(taxaSelecionada)}</span>
            </div>
          )}
        </div>
      )}

      <div className="pay-big-value">
        {travado ? (
          <div className="pay-big-value__amount tabular">{money(Number(valor.replace(',', '.')) || 0)}</div>
        ) : (
          <input
            className="pay-big-value__amount tabular"
            style={{ border: 'none', background: 'none', width: '100%', textAlign: 'center' }}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
          />
        )}
      </div>
      <FormasPagamento value={forma} onChange={setForma} />

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={confirmar}>
        {enviando ? 'Registrando…' : 'Registrar pagamento'}
      </button>
    </div>
  );
}

function CampoComIcone({ icon: Icon, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
      <input {...props} style={{ paddingLeft: 34, ...(props.style || {}) }} />
    </div>
  );
}

function FormAbrirMesa({ mesa, onAbrir, onVoltar }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false);

  useEffect(() => {
    const digitos = cpf.replace(/\D/g, '');
    if (digitos.length !== 11) {
      setClienteEncontrado(false);
      return;
    }
    let cancelado = false;
    setBuscandoCpf(true);
    supabase
      .from('clientes')
      .select('nome, telefone, nascimento, email')
      .eq('cpf', cpf)
      .limit(1)
      .then(({ data: linhas }) => {
        if (cancelado) return;
        setBuscandoCpf(false);
        const data = linhas?.[0];
        if (data) {
          setClienteEncontrado(true);
          setNome(data.nome || '');
          setTelefone(data.telefone ? mascararTelefone(data.telefone) : '');
          setNascimento(data.nascimento ? mascararDataBr(data.nascimento.split('-').reverse().join('')) : '');
          setEmail(data.email || '');
        } else {
          setClienteEncontrado(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [cpf]);

  async function abrir(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }
    if (nascimento && !dataBrParaIso(nascimento)) {
      setErro('Data de nascimento inválida.');
      return;
    }
    setEnviando(true);
    const ok = await onAbrir({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      cpf: cpf.trim() || null,
      nascimento: dataBrParaIso(nascimento),
      email: email.trim() || null,
    });
    setEnviando(false);
    if (!ok) setErro('Não foi possível abrir a mesa. Tente de novo.');
  }

  return (
    <form onSubmit={abrir} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar ao mapa
      </button>

      <div className="row" style={{ gap: 10 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Table2 size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{mesa.nome}</h1>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>Antes de abrir, informe quem está sentando na mesa.</p>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="label">Nome do cliente</span>
        <CampoComIcone icon={User} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ana" autoFocus />
        <span className="label">Telefone (opcional)</span>
        <CampoComIcone icon={Phone} value={telefone} onChange={(e) => setTelefone(mascararTelefone(e.target.value))} inputMode="numeric" placeholder="(11) 99999-9999" />
        <span className="label">CPF (opcional)</span>
        <CampoComIcone icon={CreditCard} value={cpf} onChange={(e) => setCpf(mascararCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
        {buscandoCpf && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Buscando cliente…</p>}
        {!buscandoCpf && clienteEncontrado && (
          <p style={{ fontSize: 12, margin: 0, color: 'var(--success, #1a9d5c)', fontWeight: 600 }}>
            Cliente encontrado — dados preenchidos automaticamente
          </p>
        )}
        <span className="label">Data de nascimento (opcional)</span>
        <CampoComIcone icon={Calendar} value={nascimento} onChange={(e) => setNascimento(mascararDataBr(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" />
        <span className="label">E-mail (opcional)</span>
        <CampoComIcone icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="nome@email.com" />
      </div>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Abrindo…' : 'Abrir mesa'}
      </button>
    </form>
  );
}

const PLACEHOLDER_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' rx='10' fill='#f0eafa'/></svg>";
const PLACEHOLDER_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(PLACEHOLDER_SVG);
const CATEGORIA_TODAS = 'Todos';

function LancarItens({ pedido, tituloComanda, onVoltar, onLancado }) {
  const [produtos, setProdutos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [promocoes, setPromocoes] = useState([]);
  const [cardapios, setCardapios] = useState([]);
  const [cardapioAtivo, setCardapioAtivo] = useState('');
  const [complementosPorProduto, setComplementosPorProduto] = useState(new Map());
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIA_TODAS);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [confirmandoPedido, setConfirmandoPedido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const toqueInicioX = useRef(null);

  useEffect(() => {
    carregarProdutos();
    Promise.all([
      supabase.from('categorias').select('*').order('ordem').order('nome'),
      supabase.from('promocoes').select('*').eq('ativo', true),
      supabase.from('cardapios').select('*, cardapio_produtos(produto_id)').eq('ativo', true).order('nome'),
      supabase.from('produto_complementos_permitidos').select('produto_id, produtos:complemento_produto_id(id, nome, preco, preco_promocional)'),
    ]).then(([catResp, promoResp, cardapiosResp, complResp]) => {
      setCategorias(catResp.data || []);
      setPromocoes(promoResp.data || []);
      setCardapios(cardapiosResp.data || []);
      const mapa = new Map();
      for (const c of complResp.data || []) {
        if (!c.produtos) continue;
        const atual = mapa.get(c.produto_id) || [];
        atual.push(c.produtos);
        mapa.set(c.produto_id, atual);
      }
      setComplementosPorProduto(mapa);
    });

    // Estoque é compartilhado entre todos os garçons — qualquer venda em
    // outro celular deve atualizar a quantidade aqui em tempo real.
    const canal = supabase
      .channel('estoque-produtos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, carregarProdutos)
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []);

  async function carregarProdutos() {
    const { data } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
    setProdutos(data || []);
  }

  function adicionar(p, delta = 1) {
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.produto_id === p.id);
      const qtdAtual = existente?.quantidade || 0;
      if (delta > 0 && p.estoque !== null && qtdAtual >= p.estoque) return atual;
      if (existente) {
        return atual.map((i) => (i.produto_id === p.id ? { ...i, quantidade: i.quantidade + delta } : i)).filter((i) => i.quantidade > 0);
      }
      if (delta <= 0) return atual;
      return [...atual, { produto_id: p.id, nome: p.nome, preco: precoEfetivo(p, promocoes), quantidade: 1, estoque: p.estoque }];
    });
  }

  function quantidadeNoCarrinho(produtoId) {
    return carrinho.find((i) => i.produto_id === produtoId)?.quantidade || 0;
  }

  const categoriasComTodos = [CATEGORIA_TODAS, ...categorias.map((c) => c.nome)];
  const indiceCategoria = categoriasComTodos.indexOf(categoriaAtiva);

  function trocarCategoria(direcao) {
    const proximo = indiceCategoria + direcao;
    if (proximo >= 0 && proximo < categoriasComTodos.length) setCategoriaAtiva(categoriasComTodos[proximo]);
  }

  function onTouchStart(e) {
    toqueInicioX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (toqueInicioX.current === null) return;
    const delta = e.changedTouches[0].clientX - toqueInicioX.current;
    if (Math.abs(delta) > 60) trocarCategoria(delta < 0 ? 1 : -1);
    toqueInicioX.current = null;
  }

  const cardapioSelecionado = cardapios.find((c) => c.id === cardapioAtivo);
  const idsCardapio = cardapioSelecionado ? new Set(cardapioSelecionado.cardapio_produtos.map((cp) => cp.produto_id)) : null;

  const produtosFiltrados = (produtos === null ? [] : produtos)
    .filter((p) => categoriaAtiva === CATEGORIA_TODAS || categorias.find((c) => c.id === p.categoria_id)?.nome === categoriaAtiva)
    .filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter((p) => !idsCardapio || idsCardapio.has(p.id));

  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);

  async function confirmar() {
    setErro('');
    setEnviando(true);
    const { error } = await supabase.rpc('lancar_pedido_itens', {
      p_pedido_id: pedido.id,
      p_itens: carrinho.map((i) => ({ produto_id: i.produto_id, nome_produto: i.nome, quantidade: i.quantidade, preco_unitario: i.preco })),
    });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    onLancado();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="search-input-wrap">
        <Search size={15} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." />
      </div>

      {cardapios.length > 0 && (
        <select value={cardapioAtivo} onChange={(e) => setCardapioAtivo(e.target.value)}>
          <option value="">Cardápio: Todos os produtos</option>
          {cardapios.map((c) => (
            <option key={c.id} value={c.id}>Cardápio: {c.nome}</option>
          ))}
        </select>
      )}

      <div className="tab-row">
        {categoriasComTodos.map((c) => (
          <button key={c} type="button" className="tab" aria-pressed={categoriaAtiva === c} onClick={() => setCategoriaAtiva(c)}>
            {c}
          </button>
        ))}
      </div>

      {produtos === null ? (
        <p className="muted">Carregando…</p>
      ) : produtosFiltrados.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum produto encontrado.</p>
      ) : (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}
        >
          {produtosFiltrados.map((p) => {
            const preco = precoEfetivo(p, promocoes);
            const emPromocao = preco < Number(p.preco);
            const qtd = quantidadeNoCarrinho(p.id);
            const esgotado = p.estoque !== null && p.estoque <= 0;
            return (
              <div key={p.id} className="card" style={{ opacity: esgotado ? 0.5 : 1 }}>
                <img src={p.foto_url || PLACEHOLDER_FOTO} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: 8, objectFit: 'cover', background: 'var(--panel-2)', marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span className="tabular" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{money(preco)}</span>
                  {emPromocao && <span className="tabular muted" style={{ fontSize: 11, textDecoration: 'line-through' }}>{money(p.preco)}</span>}
                </div>
                {p.estoque !== null && (
                  <div className={'muted tabular'} style={{ fontSize: 11, marginTop: 2 }}>
                    {esgotado ? 'Esgotado' : `Estoque: ${p.estoque}`}
                  </div>
                )}
                <div className="stepper-mini" style={{ marginTop: 6, justifyContent: 'center', width: '100%' }}>
                  <button type="button" className="stepper-mini-btn" disabled={qtd === 0} onClick={() => adicionar(p, -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="stepper-qty tabular">{qtd}</span>
                  <button type="button" className="stepper-mini-btn" disabled={esgotado || (p.estoque !== null && qtd >= p.estoque)} onClick={() => adicionar(p, 1)}>
                    <Plus size={12} />
                  </button>
                </div>
                {qtd > 0 && (complementosPorProduto.get(p.id) || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {(complementosPorProduto.get(p.id) || []).map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        className="chip"
                        style={{ cursor: 'pointer', fontSize: 10.5, border: '1px dashed var(--primary)' }}
                        onClick={() => adicionar(produtos.find((prod) => prod.id === comp.id) || comp, 1)}
                        title={`Adicionar ${comp.nome} (${money(precoEfetivo(comp, promocoes))})`}
                      >
                        + {comp.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {carrinho.length > 0 && (
        <div className="card" style={{ position: 'sticky', bottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="list">
            {carrinho.map((i) => (
              <div key={i.produto_id} className="item" style={{ alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{i.nome}</span>
                <div className="stepper">
                  <button type="button" className="stepper-btn" onClick={() => adicionar(produtos.find((p) => p.id === i.produto_id), -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="stepper-qty tabular">{i.quantidade}</span>
                  <button type="button" className="stepper-btn" onClick={() => adicionar(produtos.find((p) => p.id === i.produto_id), 1)}>
                    <Plus size={12} />
                  </button>
                </div>
                <span className="tabular" style={{ width: 70, textAlign: 'right' }}>{money(i.preco * i.quantidade)}</span>
              </div>
            ))}
          </div>
          <div className="row">
            <span style={{ fontWeight: 700 }}>Total da rodada</span>
            <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{money(total)}</span>
          </div>
          {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
          <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={() => setConfirmandoPedido(true)}>
            Enviar para a cozinha
          </button>
        </div>
      )}

      {confirmandoPedido && (
        <div className="modal-overlay" onClick={() => !enviando && setConfirmandoPedido(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center' }}>
              <span className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>Confirmar pedido pra</span>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)' }}>{tituloComanda}</h2>
            </div>
            <div className="list">
              {carrinho.map((i) => (
                <div key={i.produto_id} className="row" style={{ fontSize: 14, padding: '3px 0' }}>
                  <span>{i.quantidade}x {i.nome}</span>
                  <span className="tabular">{money(i.preco * i.quantidade)}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
              <span style={{ fontWeight: 700 }}>Total da rodada</span>
              <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{money(total)}</span>
            </div>
            {erro && <p className="danger-text" style={{ fontSize: 13, margin: 0 }}>{erro}</p>}
            <div className="modal-box__actions">
              <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => setConfirmandoPedido(false)}>
                Voltar
              </button>
              <button type="button" className="btn btn-primary" disabled={enviando} onClick={confirmar}>
                {enviando ? 'Enviando…' : 'Confirmar e enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinalizarPedido({ pedido, rodadas, total, valorPago, taxaPercentual, taxaAtiva, onAlternarTaxa, podeCancelar = true, podeDarDesconto = true, onCancelarItem, onVoltar, onConcluido }) {
  // pagamentos[i].auto = true enquanto o valor ainda não foi editado à mão
  // pelo garçom — nesse caso ele sempre reflete o valor a pagar mais
  // recente (some com desconto/taxa/pagamento parcial na hora). Assim que
  // o garçom mexe no campo (ou divide o pagamento), vira manual.
  const [pagamentos, setPagamentos] = useState([{ forma: 'dinheiro', valor: '0.00', auto: true }]);
  const [desconto, setDesconto] = useState('0');
  const [editandoDesconto, setEditandoDesconto] = useState(false);
  const [dividirPor, setDividirPor] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pontosCliente, setPontosCliente] = useState(0);
  const [valorPorPonto, setValorPorPonto] = useState(0);
  const [usarFidelidade, setUsarFidelidade] = useState(true);
  const [fidelidadeCarregada, setFidelidadeCarregada] = useState(false);

  useEffect(() => {
    if (!pedido.cliente_id) {
      setFidelidadeCarregada(true);
      return;
    }
    Promise.all([
      supabase.from('clientes').select('pontos_fidelidade').eq('id', pedido.cliente_id).maybeSingle(),
      supabase.from('usuarios').select('empresas(fidelidade_valor_por_ponto)').limit(1).maybeSingle(),
    ]).then(([clienteResp, empresaResp]) => {
      setPontosCliente(Number(clienteResp.data?.pontos_fidelidade) || 0);
      setValorPorPonto(Number(empresaResp.data?.empresas?.fidelidade_valor_por_ponto) || 0);
      setFidelidadeCarregada(true);
    });
  }, [pedido.cliente_id]);

  const valorMaximoFidelidade = pontosCliente * valorPorPonto;
  const descontoFidelidadeDisponivel = Math.max(0, Math.min(valorMaximoFidelidade, total));
  const temFidelidadeDisponivel = fidelidadeCarregada && pontosCliente > 0 && valorPorPonto > 0;

  // Assim que os pontos carregam, já aplica o desconto de fidelidade
  // automaticamente (o garçom pode desligar no switch se o cliente não
  // quiser usar dessa vez).
  useEffect(() => {
    if (temFidelidadeDisponivel && usarFidelidade) {
      setDesconto(descontoFidelidadeDisponivel.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temFidelidadeDisponivel]);

  function alternarFidelidade(ligar) {
    setUsarFidelidade(ligar);
    setDesconto(ligar ? descontoFidelidadeDisponivel.toFixed(2) : '0');
  }

  const descontoNum = Number(desconto.replace(',', '.')) || 0;
  const totalComDesconto = Math.max(0, total - descontoNum);
  const taxaValor = taxaAtiva ? Math.round(totalComDesconto * (taxaPercentual / 100) * 100) / 100 : 0;
  const totalFinal = totalComDesconto + taxaValor;
  const totalAPagarAgora = Math.max(0, totalFinal - valorPago);

  function valorEfetivo(p) {
    return p.auto ? totalAPagarAgora.toFixed(2) : p.valor;
  }

  const somaPagamentos = pagamentos.reduce((s, p) => s + (Number(valorEfetivo(p).replace(',', '.')) || 0), 0);
  const restante = totalAPagarAgora - somaPagamentos;

  function atualizarPagamento(idx, campo, valor) {
    setPagamentos((atual) => atual.map((p, i) => (i === idx ? { ...p, [campo]: valor, auto: campo === 'valor' ? false : p.auto } : p)));
  }

  function adicionarPagamento() {
    setPagamentos((atual) => [
      ...atual.map((p) => (p.auto ? { ...p, valor: totalAPagarAgora.toFixed(2), auto: false } : p)),
      { forma: 'pix', valor: Math.max(0, restante).toFixed(2), auto: false },
    ]);
    setDividirPor((n) => n + 1);
  }

  function removerPagamento(idx) {
    setPagamentos((atual) => atual.filter((_, i) => i !== idx));
    setDividirPor((n) => Math.max(1, n - 1));
  }

  function mudarDivisao(delta) {
    const n = Math.max(1, dividirPor + delta);
    setDividirPor(n);
    if (n === 1) {
      setPagamentos([{ forma: pagamentos[0]?.forma || 'dinheiro', valor: totalAPagarAgora.toFixed(2), auto: true }]);
      return;
    }
    const base = Math.floor((totalAPagarAgora / n) * 100) / 100;
    const ultimoValor = Math.round((totalAPagarAgora - base * (n - 1)) * 100) / 100;
    setPagamentos(
      Array.from({ length: n }, (_, i) => ({
        forma: 'dinheiro',
        valor: (i === n - 1 ? ultimoValor : base).toFixed(2),
        auto: false,
      }))
    );
  }

  async function confirmar() {
    setErro('');
    if (Math.abs(restante) > 0.01) {
      setErro('A soma das formas de pagamento precisa bater com o total.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.rpc('finalizar_pedido_mesa', {
      p_pedido_id: pedido.id,
      p_pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: Number(valorEfetivo(p).replace(',', '.')) || 0 })),
      p_desconto: descontoNum,
      p_taxa_servico: taxaValor,
    });
    if (error) {
      setEnviando(false);
      setErro(error.message.replace('P0001: ', ''));
      return;
    }

    // Se algum desconto de fidelidade foi de fato aplicado, desconta os
    // pontos usados do saldo do cliente (o novo saldo/pontos ganhos por
    // essa venda são tratados à parte, pelo trigger no banco).
    if (usarFidelidade && descontoNum > 0 && valorPorPonto > 0 && pedido.cliente_id) {
      const pontosUsados = Math.min(pontosCliente, Math.round(descontoNum / valorPorPonto));
      if (pontosUsados > 0) {
        await supabase.rpc('resgatar_pontos_fidelidade', { p_cliente_id: pedido.cliente_id, p_pontos: pontosUsados });
      }
    }

    setEnviando(false);
    onConcluido();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        <X size={14} /> Voltar
      </button>

      <div className="pay-stats-grid">
        <div className="pay-stat">
          <span className="pay-stat__label">Total</span>
          <span className="pay-stat__value">{money(totalFinal)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">Restante</span>
          <span className={'pay-stat__value' + (Math.abs(restante) > 0.01 ? ' is-danger' : ' is-success')}>{money(restante)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">Pago</span>
          <span className="pay-stat__value">{money(valorPago)}</span>
        </div>
        <div className="pay-stat">
          <span className="pay-stat__label">Desconto</span>
          {!podeDarDesconto ? (
            <span className="pay-stat__value">{money(descontoNum)}</span>
          ) : editandoDesconto ? (
            <input
              autoFocus
              className="pay-stat__value is-editable"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              onBlur={() => setEditandoDesconto(false)}
              inputMode="decimal"
            />
          ) : (
            <button type="button" className="pay-stat__value is-editable" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setEditandoDesconto(true)}>
              {money(descontoNum)}
            </button>
          )}
        </div>
      </div>

      {temFidelidadeDisponivel && (
        <div className="card row" style={{ padding: '8px 12px' }}>
          <span style={{ fontSize: 12.5 }}>
            <strong>★ {pontosCliente} pontos</strong>
            <span className="muted"> — desconto de fidelidade disponível: {money(descontoFidelidadeDisponivel)}</span>
          </span>
          <Switch checked={usarFidelidade} onChange={alternarFidelidade} />
        </div>
      )}

      {podeCancelar && rodadas && rodadas.some((r) => r.pedido_itens.some((i) => !i.cancelado)) && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">Itens lançados — marque pra cancelar algum lançado errado</span>
          {rodadas.flatMap((r) => r.pedido_itens.filter((i) => !i.cancelado).map((i) => (
            <label key={i.id} className="row" style={{ fontSize: 13, cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" onChange={() => onCancelarItem(i.id)} />
                {i.quantidade}x {i.nome_produto}
              </span>
              <span className="tabular muted">{money(i.quantidade * i.preco_unitario)}</span>
            </label>
          )))}
        </div>
      )}

      {taxaPercentual > 0 && (
        <div className="card row" style={{ padding: '8px 12px' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>Taxa de serviço ({taxaPercentual}%) {taxaAtiva ? money(taxaValor) : money(0)}</span>
          <Switch checked={taxaAtiva} onChange={onAlternarTaxa} />
        </div>
      )}

      <div className="pay-divider-row">
        <span style={{ fontWeight: 700, fontSize: 13 }}>Dividir por</span>
        <div className="pay-divider-stepper">
          <button type="button" className="pay-divider-btn" onClick={() => mudarDivisao(-1)} disabled={dividirPor <= 1}>
            <Minus size={14} />
          </button>
          <span className="pay-divider-count">{dividirPor}</span>
          <button type="button" className="pay-divider-btn" onClick={() => mudarDivisao(1)}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      {pagamentos.length === 1 ? (
        <>
          <div className="pay-big-value">
            <div className="pay-big-value__amount tabular">{money(Number(valorEfetivo(pagamentos[0]).replace(',', '.')) || 0)}</div>
          </div>
          <FormasPagamento value={pagamentos[0].forma} onChange={(f) => atualizarPagamento(0, 'forma', f)} />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagamentos.map((p, idx) => (
            <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row">
                <span className="muted tabular" style={{ fontSize: 11 }}>Pessoa {idx + 1}</span>
                <input value={valorEfetivo(p)} onChange={(e) => atualizarPagamento(idx, 'valor', e.target.value)} inputMode="decimal" style={{ width: 100, textAlign: 'right', marginLeft: 'auto' }} />
                <button type="button" onClick={() => removerPagamento(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <FormasPagamento value={p.forma} onChange={(f) => atualizarPagamento(idx, 'forma', f)} />
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={adicionarPagamento}>
            + Adicionar pessoa
          </button>
        </div>
      )}

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={enviando} onClick={confirmar}>
        {enviando ? 'Finalizando…' : 'Confirmar pagamento'}
      </button>
    </div>
  );
}
