import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Cozinha() {
  const [rodadas, setRodadas] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  async function carregar() {
    const { data } = await supabase
      .from('pedido_rodadas')
      .select('*, pedido_itens(*, produtos(categorias(nome))), pedidos(mesas(nome), clientes(nome))')
      .eq('status', 'pendente')
      .order('criado_em');
    setRodadas(data || []);
  }

  async function marcarPronta(id) {
    await supabase.from('pedido_rodadas').update({ status: 'pronto' }).eq('id', id);
    carregar();
  }

  return (
    <div className="cozinha">
      <header className="cozinha__header">
        <h1>Cozinha</h1>
        <span className="muted">{rodadas ? `${rodadas.length} pendente${rodadas.length === 1 ? '' : 's'}` : ''}</span>
      </header>

      {rodadas === null ? (
        <p className="muted" style={{ fontSize: 18 }}>Carregando…</p>
      ) : rodadas.length === 0 ? (
        <p className="muted" style={{ fontSize: 18 }}>Nenhum pedido pendente.</p>
      ) : (
        <div className="cozinha__grid">
          {rodadas.map((r) => (
            <TicketCozinha key={r.id} rodada={r} agora={agora} onPronto={() => marcarPronta(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCozinha({ rodada, agora, onPronto }) {
  const criadoEm = new Date(rodada.criado_em);
  const minutos = Math.max(0, Math.floor((agora - criadoEm.getTime()) / 60000));
  const urgencia = minutos >= 10 ? 'danger' : minutos >= 5 ? 'atencao' : 'normal';
  const horario = criadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const porCategoria = new Map();
  for (const i of rodada.pedido_itens) {
    const categoria = i.produtos?.categorias?.nome || 'Sem categoria';
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
    porCategoria.get(categoria).push(i);
  }

  return (
    <div className={'ticket-cozinha ticket-cozinha--' + urgencia}>
      <div className="ticket-cozinha__topo">
        <span className="ticket-cozinha__mesa">{rodada.pedidos?.mesas?.nome || 'Mesa'}</span>
        <span className="ticket-cozinha__tempo">{horario} · {minutos === 0 ? 'agora' : `há ${minutos} min`}</span>
      </div>
      {rodada.pedidos?.clientes?.nome && (
        <span className="muted" style={{ fontSize: 13, marginTop: -6 }}>Cliente: {rodada.pedidos.clientes.nome}</span>
      )}
      <div className="ticket-cozinha__grupos">
        {[...porCategoria.entries()].map(([categoria, itens]) => (
          <div key={categoria} style={{ marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
              {categoria}
            </div>
            <ul className="ticket-cozinha__itens" style={{ marginBottom: 0 }}>
              {itens.map((i) => (
                <li key={i.id}>
                  <span className="ticket-cozinha__qtd">{i.quantidade}x</span> {i.nome_produto}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block ticket-cozinha__btn" onClick={onPronto}>
        Pronto
      </button>
    </div>
  );
}
