import { createClient } from '@supabase/supabase-js';
import { CONHECIMENTO_SISTEMA } from './_conhecimento-sistema.js';

const MODELO = 'gemini-2.5-flash';
const MAX_MENSAGENS = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
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

  const historico = mensagens
    .slice(-MAX_MENSAGENS)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 4000) }],
    }))
    .filter((_, idx, arr) => !(idx === 0 && arr[0].role === 'model'));

  const systemPrompt = `${CONHECIMENTO_SISTEMA}

## Contexto de quem está perguntando agora

Empresa: ${perfil.empresas?.nome || 'desconhecida'} (${perfil.empresas?.categoria || 'sem categoria informada'})
Quem pergunta: ${perfil.nome}, papel: ${perfil.role}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: historico,
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error('Erro na API da IA:', resposta.status, detalhe);
      res.status(502).json({ error: 'O suporte não respondeu. Tente de novo em instantes.' });
      return;
    }

    const dados = await resposta.json();
    const texto = (dados.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    res.status(200).json({ resposta: texto || 'Não consegui gerar uma resposta agora. Pode reformular a pergunta?' });
  } catch (e) {
    console.error('Falha ao chamar a IA:', e);
    res.status(502).json({ error: 'O suporte não respondeu. Tente de novo em instantes.' });
  }
}
