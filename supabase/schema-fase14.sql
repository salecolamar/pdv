-- ---------------------------------------------------------------------
-- Fase 14: cancelar_item_pedido passa a registrar quantidade/valor no
-- audit_logs, pra alimentar o relatório de cancelamentos sem precisar de
-- outra consulta.
-- ---------------------------------------------------------------------

create or replace function cancelar_item_pedido(p_item_id uuid, p_motivo text default null)
returns void
language plpgsql
security invoker
as $$
declare
  v_item pedido_itens%rowtype;
  v_pedido pedidos%rowtype;
begin
  select pi.* into v_item from pedido_itens pi where pi.id = p_item_id;
  if v_item is null then
    raise exception 'Item não encontrado.';
  end if;
  if v_item.cancelado then
    raise exception 'Esse item já está cancelado.';
  end if;

  select p.* into v_pedido from pedidos p
  join pedido_rodadas pr on pr.pedido_id = p.id
  where pr.id = v_item.rodada_id;

  if v_pedido.status <> 'aberto' then
    raise exception 'Só é possível cancelar itens de uma comanda aberta.';
  end if;

  update pedido_itens set cancelado = true where id = p_item_id;

  if v_item.produto_id is not null then
    update produtos set estoque = estoque + v_item.quantidade
    where id = v_item.produto_id and estoque is not null;

    if found then
      insert into estoque_movimentos (produto_id, tipo, quantidade, usuario_id, motivo)
      values (v_item.produto_id, 'entrada', v_item.quantidade, auth.uid(), 'Cancelamento de item da comanda');
    end if;
  end if;

  insert into audit_logs (usuario_id, acao, detalhes)
  values (
    auth.uid(),
    'cancelar_item_pedido',
    jsonb_build_object(
      'item_id', p_item_id,
      'pedido_id', v_pedido.id,
      'nome_produto', v_item.nome_produto,
      'quantidade', v_item.quantidade,
      'preco_unitario', v_item.preco_unitario,
      'valor', v_item.quantidade * v_item.preco_unitario,
      'motivo', p_motivo
    )
  );
end;
$$;
