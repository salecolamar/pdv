import { useEffect, useRef, useState } from 'react';
import { ChefHat, Printer, PrinterCheck, X } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';
import {
  configurarImpressoraWifi,
  esquecerImpressora,
  imprimirTexto,
  impressoraConfigurada,
  impressoraWifiIp,
  obterModo,
  parearImpressoraBluetooth,
  suportaImpressaoBluetooth,
  testarImpressoraWifi,
  ticketRodada,
} from '../utils/impressora';

const COLUNAS = [
  { status: 'novo', titulo: 'Novos', acao: 'Iniciar preparo', proximo: 'fazendo' },
  { status: 'fazendo', titulo: 'Fazendo', acao: 'Marcar pronto', proximo: 'pronto' },
  { status: 'pronto', titulo: 'Prontos', acao: null, proximo: null },
];

function inicioDoDia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function tituloMesaDe(rodada) {
  const nomeMesa = rodada.pedidos?.mesas?.nome;
  const numeroMesa = nomeMesa?.match(/\d+/)?.[0];
  return numeroMesa ? `MESA ${numeroMesa}` : nomeMesa ? nomeMesa.toUpperCase() : 'VENDA AVULSA';
}

function agruparPorCategoria(itens) {
  const porCategoria = new Map();
  for (const i of itens) {
    const categoria = i.produtos?.categorias?.nome || 'Sem categoria';
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
    porCategoria.get(categoria).push(i);
  }
  return porCategoria;
}

export default function Cozinha() {
  const [rodadas, setRodadas] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [impressoraPronta, setImpressoraPronta] = useState(() => impressoraConfigurada());
  const [configAberta, setConfigAberta] = useState(false);
  const [erroImpressora, setErroImpressora] = useState('');
  const impressoraProntaRef = useRef(impressoraPronta);
  const imprimindoRef = useRef(new Set());

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15000);

    const canal = supabase
      .channel('pedido_rodadas_novas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedido_rodadas' }, () => carregar())
      .subscribe();

    return () => {
      clearInterval(t);
      supabase.removeChannel(canal);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  async function carregar() {
    const { data } = await supabase
      .from('pedido_rodadas')
      .select('*, pedido_itens(*, produtos(categorias(nome))), pedidos(mesas(nome), clientes(nome)), usuarios(nome)')
      .gte('criado_em', inicioDoDia())
      .order('criado_em');
    setRodadas(data || []);
    imprimirNovas(data || []);
  }

  async function imprimirNovas(lista) {
    if (!impressoraProntaRef.current) return;
    const pendentes = lista.filter((r) => r.status === 'novo' && !r.impresso && !imprimindoRef.current.has(r.id));
    for (const r of pendentes) {
      imprimindoRef.current.add(r.id);
      try {
        const linhas = ticketRodada({
          tituloMesa: tituloMesaDe(r),
          cliente: r.pedidos?.clientes?.nome,
          operador: r.usuarios?.nome,
          horario: new Date(r.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          grupos: [...agruparPorCategoria(r.pedido_itens).entries()],
        });
        await imprimirTexto(linhas);
        await supabase.from('pedido_rodadas').update({ impresso: true }).eq('id', r.id);
        setRodadas((atual) => atual.map((x) => (x.id === r.id ? { ...x, impresso: true } : x)));
        setErroImpressora('');
      } catch (e) {
        setErroImpressora('Falha ao imprimir: ' + e.message);
      } finally {
        imprimindoRef.current.delete(r.id);
      }
    }
  }

  async function mudarStatus(id, status) {
    await supabase.from('pedido_rodadas').update({ status }).eq('id', id);
    carregar();
  }

  function marcarImpressoraPronta(pronta) {
    impressoraProntaRef.current = pronta;
    setImpressoraPronta(pronta);
  }

  function esquecer() {
    esquecerImpressora();
    marcarImpressoraPronta(false);
  }

  const pendentes = (rodadas || []).filter((r) => r.status !== 'pronto').length;

  return (
    <div className="cozinha">
      <header className="cozinha__header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ChefHat size={22} /> Painel de Pedidos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rodadas && pendentes > 0 && <span className="chip chip-primary">{pendentes} em preparo</span>}
          {impressoraPronta ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfigAberta(true)}>
              <PrinterCheck size={14} /> Impressora configurada
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfigAberta(true)}>
              <Printer size={14} /> Configurar impressora
            </button>
          )}
        </div>
      </header>

      {erroImpressora && <p className="danger-text" style={{ fontSize: 12.5, marginTop: -8 }}>{erroImpressora}</p>}

      {configAberta && (
        <ConfigImpressora
          impressoraPronta={impressoraPronta}
          onPronta={() => {
            marcarImpressoraPronta(true);
            carregar();
          }}
          onEsquecer={esquecer}
          onErro={setErroImpressora}
          onFechar={() => setConfigAberta(false)}
        />
      )}

      {rodadas === null ? (
        <p className="muted" style={{ fontSize: 18 }}>Carregando…</p>
      ) : rodadas.length === 0 ? (
        <p className="muted" style={{ fontSize: 18 }}>Nenhum pedido hoje ainda.</p>
      ) : (
        <div className="cozinha__colunas">
          {COLUNAS.map((col) => {
            const itens = rodadas.filter((r) => r.status === col.status);
            return (
              <div key={col.status} className="cozinha__coluna">
                <div className="cozinha__coluna-titulo">
                  {col.titulo} <span className="muted">({itens.length})</span>
                </div>
                <div className="cozinha__coluna-lista">
                  {itens.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>Nenhum ticket aqui.</p>
                  ) : (
                    itens.map((r) => (
                      <TicketCozinha
                        key={r.id}
                        rodada={r}
                        agora={agora}
                        acao={col.acao}
                        onAvancar={col.proximo ? () => mudarStatus(r.id, col.proximo) : null}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfigImpressora({ impressoraPronta, onPronta, onEsquecer, onErro, onFechar }) {
  const [modo, setModo] = useState(() => obterModo());
  const [ip, setIp] = useState(() => impressoraWifiIp());
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');

  async function parearBluetooth() {
    setOcupado(true);
    setMensagem('');
    onErro('');
    try {
      await parearImpressoraBluetooth();
      onPronta();
      onFechar();
    } catch (e) {
      onErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function testarWifi() {
    if (!ip.trim()) return;
    setOcupado(true);
    setMensagem('');
    onErro('');
    try {
      await testarImpressoraWifi(ip.trim());
      setMensagem('Impressora respondeu! Pode salvar.');
    } catch (e) {
      onErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  function salvarWifi() {
    try {
      configurarImpressoraWifi(ip);
      onPronta();
      onFechar();
    } catch (e) {
      onErro(e.message);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
      <div className="row">
        <span style={{ fontWeight: 700 }}>Impressora térmica</span>
        <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
          <X size={16} />
        </button>
      </div>

      {impressoraPronta && (
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onEsquecer}>
          Esquecer impressora configurada
        </button>
      )}

      <div className="tab-row">
        <button type="button" className="tab" aria-pressed={modo === 'bluetooth'} onClick={() => setModo('bluetooth')}>
          Bluetooth
        </button>
        <button type="button" className="tab" aria-pressed={modo === 'wifi'} onClick={() => setModo('wifi')}>
          Wi-Fi
        </button>
      </div>

      {modo === 'bluetooth' ? (
        suportaImpressaoBluetooth() ? (
          <>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Toque no botão, escolha a impressora na lista que o Chrome mostrar e pronto — só precisa fazer isso uma vez.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={parearBluetooth} disabled={ocupado}>
              {ocupado ? 'Pareando…' : 'Parear impressora Bluetooth'}
            </button>
          </>
        ) : (
          <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>
            Este navegador não suporta Bluetooth pra impressão — use o Chrome ou o Edge (Android ou computador).
          </p>
        )
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
            Impressora precisa suportar o protocolo <strong>ePOS-Print</strong> (padrão Epson) e estar na mesma rede
            Wi-Fi deste aparelho. Como este site é HTTPS, o Chrome bloqueia por padrão chamadas pro IP da impressora
            (http://) — pra liberar, abra <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> nesse
            aparelho, cole o endereço <code>http://{ip || 'IP_DA_IMPRESSORA'}</code>, ative e reinicie o Chrome.
          </p>
          <span className="label">IP da impressora</span>
          <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Ex: 192.168.0.50" />
          {mensagem && <p className="success-text" style={{ fontSize: 12.5, margin: 0 }}>{mensagem}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={testarWifi} disabled={ocupado || !ip.trim()}>
              {ocupado ? 'Testando…' : 'Testar'}
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={salvarWifi} disabled={!ip.trim()}>
              Salvar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TicketCozinha({ rodada, agora, acao, onAvancar }) {
  const criadoEm = new Date(rodada.criado_em);
  const minutos = Math.max(0, Math.floor((agora - criadoEm.getTime()) / 60000));
  const urgencia = rodada.status === 'pronto' ? 'pronto' : minutos >= 10 ? 'danger' : minutos >= 5 ? 'atencao' : 'normal';
  const horario = criadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const porCategoria = agruparPorCategoria(rodada.pedido_itens);
  const tituloMesa = tituloMesaDe(rodada);
  const numeroMesa = rodada.pedidos?.mesas?.nome?.match(/\d+/)?.[0];
  const totalRodada = rodada.pedido_itens
    .filter((i) => !i.cancelado)
    .reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const statusLabel = rodada.status === 'pronto' ? 'Pronto' : minutos === 0 ? 'Agora' : `Há ${minutos} min`;

  return (
    <div className={'ticket-cozinha ticket-cozinha--' + urgencia}>
      <div className="ticket-cozinha__header">
        <span className="ticket-cozinha__badge">{numeroMesa || '•'}</span>
        <div className="ticket-cozinha__header-info">
          <span className="ticket-cozinha__mesa">{tituloMesa}</span>
          <span className="ticket-cozinha__cliente">
            {rodada.pedidos?.clientes?.nome || (rodada.usuarios?.nome ? `Op. ${rodada.usuarios.nome}` : 'Balcão')}
          </span>
        </div>
      </div>

      <div className="ticket-cozinha__status-pill">{statusLabel}</div>

      <div className="ticket-cozinha__body">
        <span className="muted" style={{ fontSize: 11.5 }}>
          {horario} · {rodada.usuarios?.nome || 'Operador'}{rodada.impresso ? ' · impresso' : ''}
        </span>

        <div className="ticket-cozinha__grupos">
          {[...porCategoria.entries()].map(([categoria, itens]) => (
            <div key={categoria} className="ticket-cozinha__grupo">
              <div className="ticket-cozinha__categoria">{categoria}</div>
              <ul className="ticket-cozinha__itens">
                {itens.map((i) => (
                  <li key={i.id} style={{ opacity: i.cancelado ? 0.5 : 1, textDecoration: i.cancelado ? 'line-through' : 'none' }}>
                    <span>
                      <span className="ticket-cozinha__qtd">{i.quantidade}x</span> {i.nome_produto}
                    </span>
                    <span className="tabular">{money(i.quantidade * i.preco_unitario)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="ticket-cozinha__total">
          <span>Valor</span>
          <span className="tabular">{money(totalRodada)}</span>
        </div>

        {onAvancar && (
          <button type="button" className="btn btn-primary btn-block ticket-cozinha__btn" onClick={onAvancar}>
            {acao}
          </button>
        )}
      </div>
    </div>
  );
}
