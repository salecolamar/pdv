-- ---------------------------------------------------------------------
-- Fase 21: marcar itens como pagos quando o garçom usa "Pagar
-- selecionados" — antes só existia um valor avulso em pedido_pagamentos,
-- sem ligação com quais itens ele cobria, então o item continuava
-- aparecendo na lista igual a um item em aberto mesmo já pago.
-- ---------------------------------------------------------------------

alter table pedido_itens add column if not exists pago boolean not null default false;

-- Remove a assinatura antiga (sem p_item_ids) antes de recriar com o 5º
-- parâmetro — senão ficam as duas sobrecarregadas e uma chamada sem
-- p_item_ids vira ambígua pro PostgREST.
drop function if exists registrar_pagamento_parcial(uuid, text, numeric, numeric);

create or replace function registrar_pagamento_parcial(
  p_pedido_id uuid,
  p_forma text,
  p_valor numeric,
  p_taxa_servico numeric default 0,
  p_item_ids uuid[] default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_total numeric;
  v_ja_pago numeric;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor válido.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null or v_pedido.status not in ('aberto', 'fechado') then
    raise exception 'Comanda não encontrada ou já paga.';
  end if;

  select coalesce(sum(pi.quantidade * pi.preco_unitario), 0) into v_total
  from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
  where pr.pedido_id = p_pedido_id and not pi.cancelado;

  v_total := v_total + coalesce(p_taxa_servico, 0);

  select coalesce(sum(valor), 0) into v_ja_pago from pedido_pagamentos where pedido_id = p_pedido_id;

  if v_ja_pago + p_valor > v_total + 0.01 then
    raise exception 'Esse valor é maior que o restante da comanda.';
  end if;

  insert into pedido_pagamentos (pedido_id, forma, valor, usuario_id)
  values (p_pedido_id, p_forma, p_valor, auth.uid());

  if p_item_ids is not null and array_length(p_item_ids, 1) > 0 then
    update pedido_itens pi set pago = true
    from pedido_rodadas pr
    where pi.rodada_id = pr.id and pr.pedido_id = p_pedido_id and pi.id = any(p_item_ids);
  end if;
end;
$$;
