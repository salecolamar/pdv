import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../supabase';

export default function Reservas() {
  const [aba, setAba] = useState('proximas');
  const [reservas, setReservas] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    carregar();
    supabase
      .from('mesas')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setMesas(data || []));
  }, []);

  async function carregar() {
    const { data } = await supabase.from('reservas').select('*, mesas(nome)').order('horario', { ascending: true });
    setReservas(data || []);
  }

  async function mudarStatus(id, status) {
    await supabase.from('reservas').update({ status }).eq('id', id);
    carregar();
  }

  if (criando) {
    return <NovaReserva mesas={mesas} onVoltar={() => setCriando(false)} onCriada={() => { setCriando(false); carregar(); }} />;
  }

  const agora = Date.now();
  const listaFiltrada = (reservas || []).filter((r) =>
    aba === 'proximas' ? r.status === 'pendente' : r.status !== 'pendente' || new Date(r.horario).getTime() < agora
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setCriando(true)}>
        Nova reserva
      </button>

      <div className="tab-row">
        <button type="button" className="tab" aria-pressed={aba === 'proximas'} onClick={() => setAba('proximas')}>
          Próximas
        </button>
        <button type="button" className="tab" aria-pressed={aba === 'historico'} onClick={() => setAba('historico')}>
          Histórico
        </button>
      </div>

      {reservas === null ? (
        <p className="muted">Carregando…</p>
      ) : listaFiltrada.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {aba === 'proximas' ? 'Nenhuma reserva pendente.' : 'Nenhuma reserva no histórico.'}
        </p>
      ) : (
        <div className="list">
          {listaFiltrada.map((r) => {
            const horario = new Date(r.horario);
            const atrasada = r.status === 'pendente' && horario.getTime() < agora;
            return (
              <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="row">
                  <span style={{ fontWeight: 600 }}>{r.nome_cliente}</span>
                  <span className={'chip ' + (r.status === 'pendente' ? (atrasada ? 'chip-danger' : 'chip-primary') : r.status === 'concluida' ? 'chip-success' : 'chip-danger')}>
                    {r.status === 'pendente' ? (atrasada ? 'Atrasada' : 'Pendente') : r.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {horario.toLocaleDateString('pt-BR')} às {horario.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {r.mesas?.nome ? ` · ${r.mesas.nome}` : ''}
                  {r.telefone ? ` · ${r.telefone}` : ''}
                </div>
                {r.observacao && <div className="muted" style={{ fontSize: 12.5 }}>{r.observacao}</div>}
                {r.status === 'pendente' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => mudarStatus(r.id, 'concluida')}>
                      Cliente chegou
                    </button>
                    <button
                      type="button"
                      onClick={() => mudarStatus(r.id, 'cancelada')}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4, marginLeft: 'auto' }}
                    >
                      <Trash2 size={14} />
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

function NovaReserva({ mesas, onVoltar, onCriada }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [mesaId, setMesaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !data || !hora) {
      setErro('Preencha nome, data e horário.');
      return;
    }
    const horario = new Date(`${data}T${hora}:00`);
    if (Number.isNaN(horario.getTime())) {
      setErro('Data/horário inválidos.');
      return;
    }
    setEnviando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('reservas').insert({
      nome_cliente: nome.trim(),
      telefone: telefone.trim() || null,
      horario: horario.toISOString(),
      mesa_id: mesaId || null,
      observacao: observacao.trim() || null,
      criado_por: user.id,
    });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    onCriada();
  }

  return (
    <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onVoltar}>
        Voltar
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="label">Nome do cliente</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ana" autoFocus />
        <span className="label">Telefone (opcional)</span>
        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Ex: (11) 99999-9999" />
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span className="label">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label">Horário</span>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        <span className="label">Mesa (opcional)</span>
        <select value={mesaId} onChange={(e) => setMesaId(e.target.value)}>
          <option value="">Sem mesa definida</option>
          {mesas.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
        <span className="label">Observação (opcional)</span>
        <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: aniversário, 6 pessoas…" />
      </div>

      {erro && <p className="danger-text" style={{ fontSize: 13 }}>{erro}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Criar reserva'}
      </button>
    </form>
  );
}
