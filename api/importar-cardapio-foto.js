import { createClient } from '@supabase/supabase-js';

const MODELO = 'gemini-3.6-flash';

const PROMPT = `Você vai ler a foto de um cardápio de bar/restaurante e extrair os itens.

Devolva SOMENTE um array JSON (sem markdown, sem texto antes ou depois), no formato:
[{"nome": "...", "preco": 00.00, "categoria": "..."}]

Regras:
- "nome": nome do produto, sem o preço nem a descrição junto.
- "preco": número (use ponto decimal, nunca vírgula). Se não conseguir ler o preço com certeza, use null.
- "categoria": a categoria/seção do cardápio onde o item está (ex: "Bebidas", "Petiscos", "Pratos"). Se o cardápio não tiver seções, tente inferir uma categoria curta e comum (ex: "Bebidas", "Comidas"). Nunca deixe em branco.
- Ignore títulos, propaganda, número de telefone e qualquer texto que não seja um item de menu.
- Se dois preços aparecerem pro mesmo item (ex: tamanhos P/G), crie um item pra cada, com o nome indicando o tamanho.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Importação por foto ainda não foi configurada (falta a chave da IA).' });
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

  const { data: perfil } = await admin.from('usuarios').select('role').eq('id', user.id).maybeSingle();
  if (!perfil || perfil.role !== 'admin') {
    res.status(403).json({ error: 'Só o admin pode importar o cardápio.' });
    return;
  }

  const { imagemBase64, mimeType } = req.body || {};
  if (!imagemBase64 || !mimeType) {
    res.status(400).json({ error: 'Envie a foto do cardápio.' });
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType, data: imagemBase64 } }, { text: PROMPT }],
          },
        ],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error('Erro na API da IA:', resposta.status, detalhe);
      res.status(502).json({ error: 'Não consegui ler essa foto agora. Tente de novo em instantes.' });
      return;
    }

    const dados = await resposta.json();
    const texto = (dados.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const jsonLimpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim();

    let itens;
    try {
      itens = JSON.parse(jsonLimpo);
    } catch {
      const inicio = jsonLimpo.indexOf('[');
      const fim = jsonLimpo.lastIndexOf(']');
      if (inicio === -1 || fim === -1) throw new Error('sem JSON na resposta');
      itens = JSON.parse(jsonLimpo.slice(inicio, fim + 1));
    }

    if (!Array.isArray(itens)) throw new Error('formato inesperado');

    res.status(200).json({ itens });
  } catch (e) {
    console.error('Falha ao ler cardápio por foto:', e);
    res.status(502).json({ error: 'Não consegui entender essa foto como um cardápio. Tente uma foto mais nítida.' });
  }
}
