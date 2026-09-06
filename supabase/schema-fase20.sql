-- ---------------------------------------------------------------------
-- Fase 20: liberar uma mesa aberta sem nenhum consumo real (todos os
-- itens cancelados, ou nenhum item lançado) — hoje o único jeito de
-- fechar uma comanda era pelo fluxo de pagamento, que rejeita com
-- "Essa comanda não tem itens lançados" quando o subtotal é zero,
-- deixando a mesa presa como ocupada sem forma de liberar pelo app.
-- ---------------------------------------------------------------------

create or replace function fechar_mesa_sem_consumo(p_pedido_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_subtotal numeric := 0;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_pedido.status <> 'aberto' then
    raise exception 'Essa comanda não está mais aberta.';
  end if;

  select coalesce(sum(pi.quantidade * pi.preco_unitario), 0) into v_subtotal
  from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
  where pr.pedido_id = p_pedido_id and not pi.cancelado;

  if v_subtotal <> 0 then
    raise exception 'Essa comanda tem itens lançados — feche recebendo o pagamento.';
  end if;

  update pedidos set status = 'pago', fechado_em = now() where id = p_pedido_id;
  update mesas set status = 'livre' where id = v_pedido.mesa_id or id = any(v_pedido.mesas_juntadas);
end;
$$;
