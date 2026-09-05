-- listar_garcons redeclarada: agora também traz os gerentes (login por PIN,
-- role='gerente'), com a role junto no retorno pra tela de acesso separar
-- em duas listas (Garçom / Gerente) e o usuário escolher qual é.
--
-- create or replace não permite mudar o tipo de retorno de uma função —
-- precisa apagar e recriar.
drop function if exists listar_garcons(uuid);

create or replace function listar_garcons(p_empresa_id uuid)
returns table(id uuid, nome text, email text, role text)
language sql
stable security definer
set search_path = public
as $$
  select id, nome, email, role from usuarios
  where empresa_id = p_empresa_id and role in ('operador', 'gerente') and login_tipo = 'pin' and ativo = true
  order by nome;
$$;
