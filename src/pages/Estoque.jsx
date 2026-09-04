import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { supabase } from '../supabase';

export default function Estoque() {
  const [produtos, setProdutos] = useState(null);
  const [movimentandoId, setMovimentandoId] = useState(null);
  const [tipo, setTipo] = useState('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [historico, setHistorico] = useState(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase.from('produtos').select('*').order('nome');
    setProdutos((data || []).filter((p) => p.estoque !== null));
  }

  function abrirMovimento(p, tipoInicial) {
    setMovimentandoId(p.id);
    setTipo(tipoInicial);
    setQuantidade('');
    setMotivo('');
    setErro('');
  }

  async function confirmarMovimento(p) {
    setErro('');
    const qtd = Number(quantidade.replace(',', '.'));
    if (!(qtd >= 0)) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.rpc('registrar_movimento_estoque', {
      p_produto_id: p.id,
      p_tipo: tipo,
      p_quantidade: qtd,
      p_motivo: motivo.trim() || null,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message.replace('P0001: ', ''));
      return;
    }
    setMovimentandoId(null);
    carregar();
  }

  async function abrirHistorico() {
    setMostrarHistorico(true);
    const { data } = await supabase
      .from('estoque_movimentos')
      .select('*, produtos(nome), usuarios(nome)')
      .order('criado_em', { ascending: false })
      .limit(50);
    setHistorico(data || []);
  }

  if (mostrarHistorico) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMostrarHistorico(false)}>
          Voltar
        </button>
        <div style={{ fontWeight: 700 }}>Últimas movimentações</div>
        {historico === null ? (
          <p className="muted">Carregando…</p>
        ) : historico.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nenhuma movimentação registrada ainda.</p>
        ) : (
          <div className="list">
            {historico.map((m) => (
              <div className="item" key={m.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <div className="row" style={{ width: '100%' }}>
                  <span>{m.produtos?.nome}</span>
                  <span className={'tabular ' + (Number(m.quantidade) >= 0 ? 'success-text' : 'danger-text')}>
                    {Number(m.quantidade) >= 0 ? '+' : ''}{m.quantidade}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  {tipoLabel(m.tipo)} {m.motivo ? `— ${m.motivo}` : ''} · {m.usuarios?.nome || 'sistema'} ·{' '}
                  {new Date(m.criado_em).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-block" onClick={abrirHistorico}>
        <History size={15} /> Ver histórico de movimentações
      </button>

      {produtos === null ? (
        <p className="muted">Carregando…</p>
      ) : produtos.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          Nenhum produto com controle de estoque. Cadastre um estoque em Produtos pra ele aparecer aqui.
        </p>
      ) : (
        <div className="list">
          {produtos.map((p) => {
            const semEstoque = Number(p.estoque) <= 0;
            const baixo = !semEstoque && p.estoque_minimo != null && Number(p.estoque) <= Number(p.estoque_minimo);
            return (
              <div key={p.id} className="card">
                <div className="row">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.nome}</div>
                    <span className={'chip ' + (semEstoque || baixo ? 'chip-danger' : 'chip-success')} style={{ marginTop: 3 }}>
                      {semEstoque ? 'Sem estoque' : baixo ? 'Estoque baixo' : 'Estoque ok'}
                    </span>
                  </div>
                  <span className="tabular" style={{ fontSize: 22, fontWeight: 800, color: semEstoque || baixo ? 'var(--danger)' : 'var(--text)' }}>{p.estoque}</span>
                </div>
                {movimentandoId === p.id ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="tab-row">
                      {[
                        ['entrada', 'Entrada'],
                        ['saida', 'Saída'],
                        ['ajuste', 'Ajuste'],
                      ].map(([id, label]) => (
                        <button key={id} type="button" className="tab" aria-pressed={tipo === id} onClick={() => setTipo(id)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="label">{tipo === 'ajuste' ? 'Novo valor do estoque' : 'Quantidade'}</span>
                    <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" />
                    <span className="label">Motivo (opcional)</span>
                    <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: compra do fornecedor, quebra, contagem…" />
                    {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMovimentandoId(null)}>
                        Cancelar
                      </button>
                      <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={enviando} onClick={() => confirmarMovimento(p)}>
                        {enviando ? 'Salvando…' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirMovimento(p, 'entrada')}>
                      Entrada
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirMovimento(p, 'saida')}>
                      Saída
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirMovimento(p, 'ajuste')}>
                      Ajustar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function tipoLabel(tipo) {
  return { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' }[tipo] || tipo;
}
