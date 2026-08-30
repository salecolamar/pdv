import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

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
      .select('*, pedido_itens(*, produtos(categorias(nome))), pedidos(mesas(nome), clientes(nome)), usuarios(nome)')
      .gte('criado_em', inicioDoDia())
      .order('criado_em');
    setRodadas(data || []);
  }

  async function mudarStatus(id, status) {
    await supabase.from('pedido_rodadas').update({ status }).eq('id', id);
    carregar();
  }

  const pendentes = (rodadas || []).filter((r) => r.status !== 'pronto').length;

  return (
    <div className="cozinha">
      <header className="cozinha__header">
        <h1>Cozinha</h1>
        <span className="muted">{rodadas ? `${pendentes} em preparo` : ''}</span>
      </header>

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

function TicketCozinha({ rodada, agora, acao, onAvancar }) {
  const criadoEm = new Date(rodada.criado_em);
  const minutos = Math.max(0, Math.floor((agora - criadoEm.getTime()) / 60000));
  const urgencia = rodada.status === 'pronto' ? 'pronto' : minutos >= 10 ? 'danger' : minutos >= 5 ? 'atencao' : 'normal';
  const data = criadoEm.toLocaleDateString('pt-BR');
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
        <span className="ticket-cozinha__tempo">{minutos === 0 ? 'agora' : `há ${minutos} min`}</span>
      </div>
      <span className="muted" style={{ fontSize: 12, marginTop: -8 }}>
        {data} {horario} · {rodada.usuarios?.nome || 'Operador'}
      </span>
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
                <li key={i.id} style={{ opacity: i.cancelado ? 0.5 : 1, textDecoration: i.cancelado ? 'line-through' : 'none' }}>
                  <span className="ticket-cozinha__qtd">{i.quantidade}x</span> {i.nome_produto}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {onAvancar && (
        <button type="button" className="btn btn-primary btn-block ticket-cozinha__btn" onClick={onAvancar}>
          {acao}
        </button>
      )}
    </div>
  );
}
