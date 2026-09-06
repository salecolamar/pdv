import { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { supabase } from '../supabase';

const MENSAGEM_INICIAL = {
  role: 'assistant',
  content: 'Oi! Sou o suporte do sistema. Pode perguntar qualquer coisa — como usar uma tela, como resolver um problema, onde encontrar alguma função.',
};

export default function Ajuda() {
  const [mensagens, setMensagens] = useState([MENSAGEM_INICIAL]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  async function enviar(e) {
    e.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || enviando) return;

    const historico = [...mensagens, { role: 'user', content: pergunta }];
    setMensagens(historico);
    setTexto('');
    setErro('');
    setEnviando(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/suporte-bot', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ mensagens: historico }),
      });
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.error || 'Não consegui falar com o suporte agora.');
        return;
      }
      setMensagens((atual) => [...atual, { role: 'assistant', content: dados.resposta }]);
    } catch {
      setErro('Falha de conexão. Confira sua internet e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ajuda">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <LifeBuoy size={22} /> Suporte
      </h1>

      <div className="ajuda-chat">
        <div className="ajuda-chat__mensagens">
          {mensagens.map((m, idx) => (
            <div key={idx} className={'ajuda-bolha ajuda-bolha--' + m.role}>
              {m.content}
            </div>
          ))}
          {enviando && (
            <div className="ajuda-bolha ajuda-bolha--assistant ajuda-bolha--digitando">
              <span className="ajuda-ponto" />
              <span className="ajuda-ponto" />
              <span className="ajuda-ponto" />
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {erro && <p className="danger-text" style={{ fontSize: 12.5, padding: '0 16px' }}>{erro}</p>}

        <form className="ajuda-chat__input" onSubmit={enviar}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite sua dúvida sobre o sistema…"
            disabled={enviando}
          />
          <button type="submit" className="btn btn-primary" disabled={enviando || !texto.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
