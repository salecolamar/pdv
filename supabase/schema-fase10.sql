-- Fase 10: programa de fidelidade simples (1 ponto por R$1 gasto).
-- Some pontos automaticamente via trigger em `vendas` — funciona tanto pra
-- venda avulsa (Ficha) quanto pra comanda de mesa, já que as duas caem na
-- mesma tabela `vendas` (ver finalizar_venda / finalizar_pedido_mesa).

alter table clientes add column pontos_fidelidade integer not null default 0;

create or replace function fidelidade_somar_pontos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cliente_id is not null and new.cancelada = false then
    update clientes set pontos_fidelidade = pontos_fidelidade + floor(new.total)::int
    where id = new.cliente_id;
  end if;
  return new;
end;
$$;

create trigger vendas_fidelidade_somar
  after insert on vendas
  for each row
  execute function fidelidade_somar_pontos();

-- Se a venda for cancelada depois, devolve os pontos que ela tinha dado
-- (sem deixar o saldo ir negativo).
create or replace function fidelidade_estornar_pontos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cancelada = true and old.cancelada = false and new.cliente_id is not null then
    update clientes set pontos_fidelidade = greatest(0, pontos_fidelidade - floor(new.total)::int)
    where id = new.cliente_id;
  end if;
  return new;
end;
$$;

create trigger vendas_fidelidade_estornar
  after update of cancelada on vendas
  for each row
  execute function fidelidade_estornar_pontos();

-- resgatar_pontos_fidelidade: uso manual pelo admin/gerente quando o
-- cliente troca os pontos por algo no balcão (desconto, brinde, etc). Só
-- desconta o saldo — o valor do resgate é combinado fora do sistema.
create or replace function resgatar_pontos_fidelidade(p_cliente_id uuid, p_pontos int)
returns void
language plpgsql
security invoker
as $$
declare
  v_saldo int;
begin
  if p_pontos <= 0 then
    raise exception 'Informe uma quantidade de pontos válida.';
  end if;

  select pontos_fidelidade into v_saldo from clientes where id = p_cliente_id;
  if v_saldo is null then
    raise exception 'Cliente não encontrado.';
  end if;
  if v_saldo < p_pontos then
    raise exception 'O cliente só tem % pontos.', v_saldo;
  end if;

  update clientes set pontos_fidelidade = pontos_fidelidade - p_pontos where id = p_cliente_id;

  insert into audit_logs (usuario_id, acao, detalhes)
  values (auth.uid(), 'resgate_fidelidade', jsonb_build_object('cliente_id', p_cliente_id, 'pontos', p_pontos));
end;
$$;
