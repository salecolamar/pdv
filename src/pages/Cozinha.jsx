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
      .select('*, pedido_itens(*), pedidos(mesas(nome))')
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
  const minutos = Math.max(0, Math.floor((agora - new Date(rodada.criado_em).getTime()) / 60000));
  const urgencia = minutos >= 10 ? 'danger' : minutos >= 5 ? 'atencao' : 'normal';

  return (
    <div className={'ticket-cozinha ticket-cozinha--' + urgencia}>
      <div className="ticket-cozinha__topo">
        <span className="ticket-cozinha__mesa">{rodada.pedidos?.mesas?.nome || 'Mesa'}</span>
        <span className="ticket-cozinha__tempo">{minutos === 0 ? 'agora' : `há ${minutos} min`}</span>
      </div>
      <ul className="ticket-cozinha__itens">
        {rodada.pedido_itens.map((i) => (
          <li key={i.id}>
            <span className="ticket-cozinha__qtd">{i.quantidade}x</span> {i.nome_produto}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary btn-block ticket-cozinha__btn" onClick={onPronto}>
        Pronto
      </button>
    </div>
  );
}
