import { useEffect, useState } from 'react';
import { Ban, DoorClosed, DoorOpen, History, Percent, Star, Tag, Wallet } from 'lucide-react';
import { supabase } from '../supabase';
import { money } from '../utils/format';

const ACAO_LABEL = {
  abrir_caixa: 'Abriu caixa',
  fechar_caixa: 'Fechou caixa',
  desconto: 'Deu desconto',
  alterar_preco: 'Alterou preço',
  cancelar_venda: 'Cancelou venda',
  cancelar_item_pedido: 'Cancelou item da comanda',
  resgate_fidelidade: 'Resgatou pontos de fidelidade',
};

const ACAO_ICONE = {
  abrir_caixa: [DoorOpen, 'var(--success, #2f9e5f)'],
  fechar_caixa: [DoorClosed, 'var(--text-dim)'],
  desconto: [Percent, 'var(--atencao)'],
  alterar_preco: [Tag, 'var(--primary)'],
  cancelar_venda: [Ban, 'var(--danger)'],
  cancelar_item_pedido: [Ban, 'var(--danger)'],
  resgate_fidelidade: [Star, 'var(--atencao)'],
};

function resumoDetalhes(log) {
  const d = log.detalhes || {};
  switch (log.acao) {
    case 'abrir_caixa':
      return `Valor inicial: ${money(d.valor_inicial)}`;
    case 'fechar_caixa':
      return `Esperado ${money(d.esperado)} · informado ${money(d.informado)} · diferença ${money(d.diferenca)}`;
    case 'desconto':
      return `${money(d.valor)} (${d.origem === 'comanda' ? 'comanda' : 'PDV'})`;
    case 'alterar_preco':
      return `"${d.produto}": ${money(d.preco_antigo)} → ${money(d.preco_novo)}`;
    case 'cancelar_venda':
      return `Total ${money(d.total)}${d.motivo ? ` · Motivo: ${d.motivo}` : ''}`;
    case 'cancelar_item_pedido':
      return `"${d.nome_produto}" · ${money(d.valor)}${d.motivo ? ` · Motivo: ${d.motivo}` : ''}`;
    case 'resgate_fidelidade':
      return `${d.pontos} ponto${d.pontos === 1 ? '' : 's'}`;
    default:
      return JSON.stringify(d);
  }
}

export default function Auditoria() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*, usuarios(nome)')
      .order('criado_em', { ascending: false })
      .limit(100)
      .then(({ data }) => setLogs(data || []));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row" style={{ padding: '10px 14px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <History size={15} style={{ color: 'var(--text-dim)' }} />
          Últimas 100 ações sensíveis registradas no sistema.
        </span>
      </div>

      {logs === null ? (
        <p className="muted">Carregando…</p>
      ) : logs.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="list">
          {logs.map((log) => {
            const [Icon, cor] = ACAO_ICONE[log.acao] || [Wallet, 'var(--text-dim)'];
            return (
              <div key={log.id} className="card row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 10, background: cor, color: '#fff', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                  }}
                >
                  <Icon size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="row">
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{ACAO_LABEL[log.acao] || log.acao}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{new Date(log.criado_em).toLocaleString('pt-BR')}</span>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>{resumoDetalhes(log)}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{log.usuarios?.nome || 'Usuário removido'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
