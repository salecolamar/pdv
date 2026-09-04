import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import IconeMesa from '../components/IconeMesa';
import { conectarMaquininha, dispositivoSalvo, estornarUltimaTransacao, listarAparelhosPareados, pagarNaMaquininha, suportaPagamentoPagBank } from '../utils/pagbank';

const STATUS_LABEL = { livre: 'Livre', ocupada: 'Ocupada', reservada: 'Reservada' };
const STATUS_CHIP = { livre: 'chip-success', ocupada: 'chip-danger', reservada: 'chip-primary' };
const STATUS_COR = { livre: 'var(--success, #2f9e5f)', ocupada: 'var(--danger)', reservada: 'var(--primary)' };

export default function PosPago() {
  const [mesas, setMesas] = useState(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await supabase.from('mesas').select('*').order('nome');
    setMesas(
      (data || []).sort((a, b) => {
        const na = Number(a.nome.match(/\d+/)?.[0]);
        const nb = Number(b.nome.match(/\d+/)?.[0]);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.nome.localeCompare(b.nome);
      })
    );
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setEnviando(true);
    setErro('');
    const { error } = await supabase.from('mesas').insert({ nome: nome.trim() });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNome('');
    carregar();
  }

  async function criarVarias(e) {
    e.preventDefault();
    const qtd = Number(quantidade);
    if (!(qtd > 0)) return;
    setEnviando(true);
    setErro('');
    const maiorNumero = (mesas || []).reduce((max, m) => {
      const n = Number(m.nome.match(/\d+/)?.[0]);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const novas = Array.from({ length: qtd }, (_, i) => ({ nome: `Mesa ${maiorNumero + i + 1}` }));
    const { error } = await supabase.from('mesas').insert(novas);
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setQuantidade('');
    carregar();
  }

  function comecarEdicao(m) {
    setEditandoId(m.id);
    setNomeEditado(m.nome);
    setErro('');
  }

  async function salvarNome(id) {
    if (!nomeEditado.trim()) return;
    setEnviando(true);
    setErro('');
    const { error } = await supabase.from('mesas').update({ nome: nomeEditado.trim() }).eq('id', id);
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditandoId(null);
    carregar();
  }

  async function remover(id) {
    await supabase.from('mesas').delete().eq('id', id);
    carregar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row" style={{ padding: '14px 16px', background: 'linear-gradient(135deg, var(--primary), #6C3CE0)', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <IconeMesa size={18} />
          Cadastre aqui as mesas que o garçom vai usar no mapa de mesas do PDV.
        </span>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <form onSubmit={adicionar} className="row" style={{ gap: 8 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mesa 7" style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}><Plus size={14} /> Adicionar</button>
        </form>
        <form onSubmit={criarVarias} className="row" style={{ gap: 8 }}>
          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Quantidade de mesas"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={enviando}>Criar várias</button>
        </form>
      </div>
      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      {mesas === null ? (
        <p className="muted">Carregando…</p>
      ) : mesas.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma mesa cadastrada ainda.</p>
      ) : (
        <div className="list">
          {mesas.map((m) =>
            editandoId === m.id ? (
              <div key={m.id} className="card row" style={{ alignItems: 'center', gap: 8 }}>
                <input value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} style={{ flex: 1 }} autoFocus />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={enviando} onClick={() => salvarNome(m.id)}>Salvar</button>
              </div>
            ) : (
              <div key={m.id} className="card row" style={{ alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, background: STATUS_COR[m.status] || 'var(--text-dim)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <IconeMesa size={16} />
                </div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{m.nome}</span>
                <span className={'chip ' + (STATUS_CHIP[m.status] || 'chip-danger')}>{STATUS_LABEL[m.status] || m.status}</span>
                <button
                  type="button"
                  onClick={() => comecarEdicao(m)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, marginLeft: 8 }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remover(m.id)}
                  disabled={m.status !== 'livre'}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: m.status === 'livre' ? 'pointer' : 'not-allowed', opacity: m.status === 'livre' ? 1 : 0.35, padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      <TesteMaquininha />
    </div>
  );
}

function TesteMaquininha() {
  const [dispositivo, setDispositivo] = useState(() => dispositivoSalvo());
  const [valor, setValor] = useState('1.00');
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pareados, setPareados] = useState(null);

  const suportado = suportaPagamentoPagBank();

  async function listarPareados() {
    setOcupado(true);
    setErro('');
    setStatus('Buscando aparelhos pareados...');
    try {
      const lista = await listarAparelhosPareados();
      setPareados(lista);
      setStatus(lista.length ? '' : 'Nenhum aparelho pareado. Pareie a Moderninha no Bluetooth do celular primeiro.');
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function conectar() {
    if (!dispositivo.trim()) return;
    setOcupado(true);
    setErro('');
    setStatus('Conectando por Bluetooth...');
    try {
      const resultado = await conectarMaquininha(dispositivo.trim());
      setStatus(resultado.sucesso ? 'Conectado!' : `Falha ao conectar (código ${resultado.codigo}).`);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function pagar() {
    const valorNum = Number(valor.replace(',', '.'));
    if (!(valorNum > 0)) return;
    setOcupado(true);
    setErro('');
    setStatus('Aguardando o cartão na maquininha...');
    try {
      const resultado = await pagarNaMaquininha(valorNum, 'credito', 'TESTE');
      setStatus(resultado.sucesso ? `Pagamento aprovado! ID ${resultado.transacaoId}` : `Recusado: ${resultado.mensagem}`);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function estornar() {
    setOcupado(true);
    setErro('');
    setStatus('Estornando a última transação...');
    try {
      const resultado = await estornarUltimaTransacao();
      setStatus(resultado.sucesso ? 'Estornado!' : `Falha: ${resultado.mensagem}`);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Testar maquininha PagBank (Bluetooth)</div>
      {!suportado && (
        <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>
          Isso só funciona dentro do app Android empacotado (Capacitor) — não funciona aqui no navegador.
        </p>
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={listarPareados} disabled={!suportado || ocupado}>
        Listar aparelhos pareados
      </button>
      {pareados && pareados.length > 0 && (
        <div className="list">
          {pareados.map((d) => (
            <div
              key={d.mac}
              className="item"
              style={{ cursor: 'pointer', alignItems: 'center' }}
              onClick={() => setDispositivo(d.nome || d.mac)}
            >
              <span style={{ flex: 1 }}>{d.nome || '(sem nome)'}</span>
              <span className="muted" style={{ fontSize: 12 }}>{d.mac}</span>
            </div>
          ))}
        </div>
      )}

      <span className="label">Nome Bluetooth da maquininha (toque num item da lista acima, ou digite)</span>
      <input value={dispositivo} onChange={(e) => setDispositivo(e.target.value)} placeholder="P2_XXXXXXXX" disabled={!suportado} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={conectar} disabled={!suportado || ocupado || !dispositivo.trim()}>
        Conectar
      </button>

      <span className="label">Valor de teste (R$)</span>
      <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" disabled={!suportado} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={pagar} disabled={!suportado || ocupado}>
          Cobrar no crédito
        </button>
        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={estornar} disabled={!suportado || ocupado}>
          Estornar última
        </button>
      </div>

      {status && <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{status}</p>}
      {erro && <p className="danger-text" style={{ fontSize: 12.5, margin: 0 }}>{erro}</p>}
    </div>
  );
}
