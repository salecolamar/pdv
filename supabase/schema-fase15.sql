-- ---------------------------------------------------------------------
-- Fase 15: autorização de gerente pra cancelamento — qualquer garçom vê o
-- botão de cancelar, mas pra confirmar precisa escolher um usuário com
-- permissão (admin/gerente ou operador com permissoes.cancelar_venda) e
-- digitar a senha/PIN dele. Verificação roda no banco (nunca expõe hash).
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

create or replace function verificar_autorizacao_cancelamento(p_usuario_id uuid, p_senha text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row usuarios%rowtype;
  v_ok boolean;
begin
  select * into v_row from usuarios where id = p_usuario_id and empresa_id = empresa_id_atual();
  if v_row is null then
    raise exception 'Usuário não encontrado.';
  end if;
  if v_row.ativo = false then
    raise exception 'Esse usuário está inativo.';
  end if;
  if not (v_row.role in ('admin', 'gerente') or coalesce((v_row.permissoes->>'cancelar_venda')::boolean, false)) then
    raise exception 'Esse usuário não tem permissão para autorizar cancelamentos.';
  end if;

  select (encrypted_password = extensions.crypt(p_senha, encrypted_password)) into v_ok
  from auth.users where id = p_usuario_id;

  if v_ok is not true then
    raise exception 'Senha incorreta.';
  end if;

  return true;
end;
$$;
