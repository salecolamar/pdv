-- ---------------------------------------------------------------------
-- Fase 28: cadastro de empresa nova (onboarding) deixa de fazer dois
-- inserts separados (empresas, depois usuarios) direto do cliente.
-- Se o segundo insert falhasse por qualquer motivo transitório, a
-- empresa ficava criada "pela metade" — sem usuário admin, sem RLS que
-- deixasse limpar aquilo, e com o e-mail já "gasto" no Supabase Auth
-- (signUp não deixa repetir), travando o cadastro pra sempre. Agora as
-- duas inserções acontecem numa transação só: se uma falhar, as duas
-- desfazem.
-- ---------------------------------------------------------------------
create or replace function criar_empresa_admin(
  p_empresa_id uuid,
  p_nome_empresa text,
  p_categoria text,
  p_nome_admin text,
  p_email text
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into empresas (id, nome, categoria)
  values (p_empresa_id, coalesce(nullif(trim(p_nome_empresa), ''), 'Minha Empresa'), coalesce(nullif(trim(p_categoria), ''), 'Bar'));

  insert into usuarios (id, empresa_id, nome, email, role)
  values (auth.uid(), p_empresa_id, coalesce(nullif(trim(p_nome_admin), ''), 'Administrador'), p_email, 'admin');
end;
$$;
