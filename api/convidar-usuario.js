import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const PAPEIS_CONVIDAVEIS = ['gerente', 'operador'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
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

  const { data: chamador } = await admin.from('usuarios').select('empresa_id, role').eq('id', user.id).maybeSingle();
  if (!chamador || chamador.role !== 'admin') {
    res.status(403).json({ error: 'Só o admin pode convidar novos usuários.' });
    return;
  }

  const { nome, tipo } = req.body || {};
  if (!nome) {
    res.status(400).json({ error: 'Informe o nome.' });
    return;
  }

  let email, senha, role, permissoes, loginTipo;

  if (tipo === 'garcom') {
    const { pin } = req.body || {};
    if (!/^\d{6}$/.test(pin || '')) {
      res.status(400).json({ error: 'O PIN precisa ter exatamente 6 dígitos numéricos.' });
      return;
    }
    email = `garcom-${randomUUID()}@garcons.pdv.internal`;
    senha = pin;
    role = 'operador';
    permissoes = { realizar_vendas: true };
    loginTipo = 'pin';
  } else {
    ({ email, senha, role, permissoes } = req.body || {});
    if (!email || !senha || !PAPEIS_CONVIDAVEIS.includes(role)) {
      res.status(400).json({ error: 'Preencha nome, email, senha e um papel válido.' });
      return;
    }
    loginTipo = 'email';
  }

  const { data: novoUsuario, error: createError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (createError) {
    res.status(400).json({ error: createError.message });
    return;
  }

  const { error: insertError } = await admin.from('usuarios').insert({
    id: novoUsuario.user.id,
    empresa_id: chamador.empresa_id,
    nome,
    email,
    role,
    permissoes: permissoes || {},
    login_tipo: loginTipo,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(novoUsuario.user.id);
    res.status(400).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ id: novoUsuario.user.id });
}
