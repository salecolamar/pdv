import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { money } from '../utils/format';

const ACAO_LABEL = {
  abrir_caixa: 'Abriu caixa',
  fechar_caixa: 'Fechou caixa',
  desconto: 'Deu desconto',
  alterar_preco: 'Alterou preço',
  cancelar_venda: 'Cancelou venda',
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
      <p className="muted" style={{ fontSize: 13 }}>Últimas 100 ações sensíveis registradas no sistema.</p>

      {logs === null ? (
        <p className="muted">Carregando…</p>
      ) : logs.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="list">
          {logs.map((log) => (
            <div key={log.id} className="item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <div className="row" style={{ width: '100%' }}>
                <span style={{ fontWeight: 600 }}>{ACAO_LABEL[log.acao] || log.acao}</span>
                <span className="muted" style={{ fontSize: 11 }}>{new Date(log.criado_em).toLocaleString('pt-BR')}</span>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>{resumoDetalhes(log)}</span>
              <span className="muted" style={{ fontSize: 11 }}>{log.usuarios?.nome || 'Usuário removido'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
