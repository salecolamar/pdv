-- ---------------------------------------------------------------------
-- Fase 22: lançar "2x Coca Cola" virava UMA linha em pedido_itens com
-- quantidade=2 — se o garçom lançasse errado e precisasse cancelar só
-- uma das duas, não dava, porque cancelar_item_pedido cancela a linha
-- inteira. Agora cada unidade vira sua própria linha (quantidade=1),
-- então cada uma pode ser selecionada/cancelada independente das outras.
-- Os totais continuam batendo igual (soma de quantidade*preco não muda).
-- ---------------------------------------------------------------------

create or replace function lancar_pedido_itens(p_pedido_id uuid, p_itens jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_rodada_id uuid := gen_random_uuid();
  v_item jsonb;
  v_produto produtos%rowtype;
  v_unidade int;
begin
  if jsonb_array_length(p_itens) = 0 then
    raise exception 'A rodada precisa ter ao menos um item.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_pedido.status <> 'aberto' then
    raise exception 'Essa comanda não está mais aberta para novos pedidos.';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    select * into v_produto from produtos where id = (v_item->>'produto_id')::uuid;
    if v_produto is null then
      raise exception 'Produto não encontrado.';
    end if;
    if v_produto.estoque is not null and v_produto.estoque < (v_item->>'quantidade')::numeric then
      raise exception 'Estoque insuficiente de "%". Disponível: %.', v_produto.nome, v_produto.estoque;
    end if;
  end loop;

  insert into pedido_rodadas (id, pedido_id, operador_id) values (v_rodada_id, p_pedido_id, auth.uid());

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    for v_unidade in 1..greatest(1, round((v_item->>'quantidade')::numeric)::int)
    loop
      insert into pedido_itens (rodada_id, produto_id, nome_produto, quantidade, preco_unitario, complementos)
      values (
        v_rodada_id,
        (v_item->>'produto_id')::uuid,
        v_item->>'nome_produto',
        1,
        (v_item->>'preco_unitario')::numeric,
        coalesce(v_item->'complementos', '[]'::jsonb)
      );
    end loop;

    select * into v_produto from produtos where id = (v_item->>'produto_id')::uuid;
    if v_produto.estoque is not null then
      update produtos set estoque = estoque - (v_item->>'quantidade')::numeric where id = v_produto.id;
      insert into estoque_movimentos (produto_id, tipo, quantidade, usuario_id, motivo)
      values (v_produto.id, 'saida', -(v_item->>'quantidade')::numeric, auth.uid(), 'Pedido de mesa');
    end if;
  end loop;

  update mesas set status = 'ocupada' where id = v_pedido.mesa_id;

  return v_rodada_id;
end;
$$;
