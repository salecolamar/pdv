import { createClient } from '@supabase/supabase-js';
import { CONHECIMENTO_SISTEMA } from './_conhecimento-sistema.js';

const MODELO = 'claude-sonnet-5';
const MAX_MENSAGENS = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Suporte por chat ainda não foi configurado (falta a chave da IA).' });
    return;
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }

  const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }

  const { data: perfil } = await admin.from('usuarios').select('nome, role, empresas(nome, categoria)').eq('id', user.id).maybeSingle();
  if (!perfil) {
    res.status(403).json({ error: 'Usuário não encontrado.' });
    return;
  }

  const { mensagens } = req.body || {};
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    res.status(400).json({ error: 'Envie ao menos uma mensagem.' });
    return;
  }

  const historico = mensagens.slice(-MAX_MENSAGENS).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000),
  }));

  const systemPrompt = `${CONHECIMENTO_SISTEMA}

## Contexto de quem está perguntando agora

Empresa: ${perfil.empresas?.nome || 'desconhecida'} (${perfil.empresas?.categoria || 'sem categoria informada'})
Quem pergunta: ${perfil.nome}, papel: ${perfil.role}`;

  try {
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 1024,
        system: systemPrompt,
        messages: historico,
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error('Erro na API da IA:', resposta.status, detalhe);
      res.status(502).json({ error: 'O suporte não respondeu. Tente de novo em instantes.' });
      return;
    }

    const dados = await resposta.json();
    const texto = (dados.content || []).map((bloco) => (bloco.type === 'text' ? bloco.text : '')).join('').trim();
    res.status(200).json({ resposta: texto || 'Não consegui gerar uma resposta agora. Pode reformular a pergunta?' });
  } catch (e) {
    console.error('Falha ao chamar a IA:', e);
    res.status(502).json({ error: 'O suporte não respondeu. Tente de novo em instantes.' });
  }
}
