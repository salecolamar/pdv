import { useEffect, useState } from 'react';
import { Percent, Settings, ShieldCheck, UserCog, Users2 } from 'lucide-react';
import { supabase } from '../supabase';
import Switch from '../components/Switch';

export default function Configuracoes() {
  const [empresaId, setEmpresaId] = useState(null);

  useEffect(() => {
    supabase.from('usuarios').select('empresa_id').limit(1).maybeSingle().then(({ data }) => setEmpresaId(data?.empresa_id || null));
  }, []);

  if (!empresaId) return <p className="muted">Carregando…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row" style={{ padding: '14px 16px', background: 'linear-gradient(135deg, var(--primary), #6C3CE0)', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <Settings size={18} />
          Ajustes gerais do sistema — taxa de serviço, visibilidade de vendas e cargos.
        </span>
      </div>

      <TaxaServico empresaId={empresaId} />
      <VisibilidadeVendasGarcom empresaId={empresaId} />

      <div className="card">
        <div className="dash-card-titulo"><UserCog size={15} /> Cargos</div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
          Ao cadastrar ou editar um garçom em <strong>Usuários</strong>, escolha o cargo: <strong>Garçom</strong> segue o
          padrão de sempre (só lança pedidos e recebe pagamento); <strong>Gerente</strong> também pode cancelar venda ou
          item lançado errado, dar desconto e reimprimir vendas de Ficha.
        </p>
      </div>
      <div className="card">
        <div className="dash-card-titulo"><ShieldCheck size={15} /> Admins e usuários</div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
          Cadastro de novos admins, gerentes e garçons fica na tela <strong>Usuários</strong> — lá em "Convidar usuário",
          escolha "Gerente/Admin (e-mail)" e o papel "Admin" pra dar acesso total ao portal.
        </p>
      </div>
    </div>
  );
}

function TaxaServico({ empresaId }) {
  const [percentual, setPercentual] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    supabase
      .from('empresas')
      .select('taxa_servico_percentual')
      .eq('id', empresaId)
      .maybeSingle()
      .then(({ data }) => {
        setPercentual(String(data?.taxa_servico_percentual ?? 10));
        setCarregado(true);
      });
  }, [empresaId]);

  async function salvar(e) {
    e.preventDefault();
    const valor = Number(percentual.replace(',', '.'));
    if (!(valor >= 0)) return;
    setSalvando(true);
    await supabase.from('empresas').update({ taxa_servico_percentual: valor }).eq('id', empresaId);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  if (!carregado) return null;

  return (
    <form onSubmit={salvar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="dash-card-titulo" style={{ marginBottom: 0 }}><Percent size={15} /> Taxa de serviço</div>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        Percentual sugerido na hora de fechar a conta (o garçom pode desativar por venda, na tela de pagamento). Deixe 0 pra não cobrar.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <input value={percentual} onChange={(e) => setPercentual(e.target.value.replace(/[^\d,.-]/g, ''))} inputMode="decimal" style={{ width: 90 }} />
        <span className="muted">%</span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={salvando} style={{ marginLeft: 'auto' }}>
          {salvando ? 'Salvando…' : salvo ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

function VisibilidadeVendasGarcom({ empresaId }) {
  const [mostrar, setMostrar] = useState(true);
  const [carregado, setCarregado] = useState(false);
  const [garcons, setGarcons] = useState([]);

  useEffect(() => {
    carregar();
  }, [empresaId]);

  async function carregar() {
    const [empresaResp, garconsResp] = await Promise.all([
      supabase.from('empresas').select('mostrar_vendas_garcom').eq('id', empresaId).maybeSingle(),
      supabase.from('usuarios').select('id, nome, ocultar_vendas').eq('role', 'operador').order('nome'),
    ]);
    setMostrar(empresaResp.data?.mostrar_vendas_garcom ?? true);
    setGarcons(garconsResp.data || []);
    setCarregado(true);
  }

  async function alternarGeral(valor) {
    setMostrar(valor);
    await supabase.from('empresas').update({ mostrar_vendas_garcom: valor }).eq('id', empresaId);
  }

  async function alternarGarcom(usuario) {
    const novoValor = !usuario.ocultar_vendas;
    setGarcons((atual) => atual.map((g) => (g.id === usuario.id ? { ...g, ocultar_vendas: novoValor } : g)));
    await supabase.from('usuarios').update({ ocultar_vendas: novoValor }).eq('id', usuario.id);
  }

  if (!carregado) return null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row">
        <div>
          <div className="dash-card-titulo" style={{ marginBottom: 2 }}><Users2 size={15} /> Mostrar "quanto vendi" pro garçom</div>
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
            Exibe no PDV do garçom uma caixa com o total que ele vendeu no dia.
          </p>
        </div>
        <Switch checked={mostrar} onChange={alternarGeral} />
      </div>

      {mostrar && garcons.length > 0 && (
        <>
          <span className="label" style={{ marginTop: 4 }}>Bloquear individualmente (mesmo com a opção geral ligada)</span>
          <div className="list">
            {garcons.map((g) => (
              <label key={g.id} className="row" style={{ fontSize: 13, cursor: 'pointer' }}>
                <span>{g.nome}</span>
                <input type="checkbox" checked={!!g.ocultar_vendas} onChange={() => alternarGarcom(g)} />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
