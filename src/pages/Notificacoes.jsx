import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../supabase';

const LIMITE_CAIXA_HORAS = 8;
const LIMITE_COMANDA_HORAS = 2;

export default function Notificacoes() {
  const [aberto, setAberto] = useState(false);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    return () => clearInterval(t);
  }, []);

  async function carregar() {
    const agora = Date.now();
    const [prodResp, caixaResp, pedidosResp] = await Promise.all([
      supabase.from('produtos').select('nome, estoque, estoque_minimo').eq('ativo', true).not('estoque', 'is', null),
      supabase.from('caixas').select('aberto_em').is('fechado_em', null).order('aberto_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('pedidos').select('aberto_em, mesas(nome)').eq('status', 'aberto'),
    ]);

    const lista = [];

    for (const p of prodResp.data || []) {
      if (Number(p.estoque) <= 0) {
        lista.push({ nivel: 'danger', texto: `"${p.nome}" está sem estoque.` });
      } else if (p.estoque_minimo != null && Number(p.estoque) <= Number(p.estoque_minimo)) {
        lista.push({ nivel: 'atencao', texto: `"${p.nome}" com estoque baixo (${p.estoque}).` });
      }
    }

    const caixa = caixaResp.data;
    if (caixa) {
      const horas = (agora - new Date(caixa.aberto_em).getTime()) / 3600000;
      if (horas >= LIMITE_CAIXA_HORAS) {
        lista.push({ nivel: 'atencao', texto: `Caixa aberto há ${Math.floor(horas)}h — não esqueça de fechar.` });
      }
    }

    for (const ped of pedidosResp.data || []) {
      const horas = (agora - new Date(ped.aberto_em).getTime()) / 3600000;
      if (horas >= LIMITE_COMANDA_HORAS) {
        lista.push({ nivel: 'atencao', texto: `${ped.mesas?.nome || 'Mesa'} com comanda aberta há ${Math.floor(horas)}h.` });
      }
    }

    setAlertas(lista);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ position: 'relative' }}
        onClick={() => setAberto((a) => !a)}
      >
        <Bell size={14} />
        {alertas.length > 0 && (
          <span
            className="tabular"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {alertas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            width: 280,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>Notificações</div>
          {alertas.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhum alerta no momento.</p>
          ) : (
            alertas.map((a, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}>
                <span
                  style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    background: a.nivel === 'danger' ? 'var(--danger)' : 'var(--atencao)',
                  }}
                />
                <span>{a.texto}</span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
