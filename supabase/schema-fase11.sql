-- Fase 11: regra de fidelidade configurável por empresa (antes era fixo
-- em 1 ponto por R$1). Admin edita em Clientes > Regra de fidelidade.

alter table empresas add column fidelidade_pontos_por_real numeric(6, 2) not null default 1;
alter table empresas add column fidelidade_valor_por_ponto numeric(6, 2) not null default 0.10;

-- Redeclara os triggers de fidelidade pra usar o percentual configurado
-- na empresa da venda, em vez do fixo "1 ponto por R$1".
create or replace function fidelidade_somar_pontos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pontos_por_real numeric;
begin
  if new.cliente_id is not null and new.cancelada = false then
    select fidelidade_pontos_por_real into v_pontos_por_real from empresas where id = new.empresa_id;
    update clientes set pontos_fidelidade = pontos_fidelidade + floor(new.total * coalesce(v_pontos_por_real, 1))::int
    where id = new.cliente_id;
  end if;
  return new;
end;
$$;

create or replace function fidelidade_estornar_pontos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pontos_por_real numeric;
begin
  if new.cancelada = true and old.cancelada = false and new.cliente_id is not null then
    select fidelidade_pontos_por_real into v_pontos_por_real from empresas where id = new.empresa_id;
    update clientes set pontos_fidelidade = greatest(0, pontos_fidelidade - floor(new.total * coalesce(v_pontos_por_real, 1))::int)
    where id = new.cliente_id;
  end if;
  return new;
end;
$$;
