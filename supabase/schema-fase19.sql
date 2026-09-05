-- ---------------------------------------------------------------------
-- Fase 19: complementos discriminados como subitem no extrato da conta —
-- antes o preço do complemento só ficava embutido no preco_unitario e o
-- nome do complemento virava sufixo do nome_produto ("X + Bacon extra").
-- Agora pedido_itens/venda_itens guardam um jsonb com [{nome, preco}] de
-- cada complemento escolhido, e a UI mostra cada um como uma linha extra
-- indentada embaixo do item, com o preço dele à parte.
-- ---------------------------------------------------------------------

alter table pedido_itens add column if not exists complementos jsonb not null default '[]';
alter table venda_itens add column if not exists complementos jsonb not null default '[]';

-- lancar_pedido_itens redeclarada: cada item do jsonb pode trazer
-- "complementos": [{"nome":..,"preco":..}] pra gravar junto.
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
    insert into pedido_itens (rodada_id, produto_id, nome_produto, quantidade, preco_unitario, complementos)
    values (
      v_rodada_id,
      (v_item->>'produto_id')::uuid,
      v_item->>'nome_produto',
      (v_item->>'quantidade')::numeric,
      (v_item->>'preco_unitario')::numeric,
      coalesce(v_item->'complementos', '[]'::jsonb)
    );

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

-- Remove a assinatura antiga de finalizar_pedido_mesa (sem p_taxa_servico)
-- que ficou sobrecarregada junto com a atual — nunca é chamada pelo
-- front (sempre manda p_taxa_servico), só polui pg_proc.
drop function if exists finalizar_pedido_mesa(uuid, jsonb, numeric, uuid);

-- finalizar_pedido_mesa redeclarada: carrega pi.complementos pra
-- venda_itens junto, pra a discriminação sobreviver no histórico/relatório.
create or replace function finalizar_pedido_mesa(
  p_pedido_id uuid,
  p_pagamentos jsonb,
  p_desconto numeric default 0,
  p_cliente_id uuid default null,
  p_taxa_servico numeric default 0
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_venda_id uuid := gen_random_uuid();
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_ja_pago numeric := 0;
  v_restante numeric := 0;
  v_soma_pagamentos numeric := 0;
  v_pagamento jsonb;
  v_caixa_id uuid;
  v_item record;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_pedido.status not in ('aberto', 'fechado') then
    raise exception 'Essa comanda já foi paga.';
  end if;

  select coalesce(sum(pi.quantidade * pi.preco_unitario), 0) into v_subtotal
  from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
  where pr.pedido_id = p_pedido_id and not pi.cancelado;

  if v_subtotal = 0 then
    raise exception 'Essa comanda não tem itens lançados.';
  end if;

  v_total := v_subtotal - coalesce(p_desconto, 0) + coalesce(p_taxa_servico, 0);
  if v_total < 0 then
    raise exception 'O desconto não pode ser maior que o total da comanda.';
  end if;

  select coalesce(sum(valor), 0) into v_ja_pago from pedido_pagamentos where pedido_id = p_pedido_id;
  v_restante := v_total - v_ja_pago;

  select coalesce(sum((p->>'valor')::numeric), 0) into v_soma_pagamentos
  from jsonb_array_elements(p_pagamentos) p;
  if abs(v_soma_pagamentos - v_restante) > 0.01 then
    raise exception 'O total dos pagamentos (%) não bate com o restante da comanda (%).', v_soma_pagamentos, v_restante;
  end if;

  select id into v_caixa_id from caixas
  where empresa_id = empresa_id_atual() and fechado_em is null
  order by aberto_em desc limit 1;

  insert into vendas (id, cliente_id, caixa_id, operador_id, subtotal, desconto, taxa_servico, total)
  values (v_venda_id, coalesce(p_cliente_id, v_pedido.cliente_id), v_caixa_id, auth.uid(), v_subtotal, coalesce(p_desconto, 0), coalesce(p_taxa_servico, 0), v_total);

  for v_item in
    select pi.produto_id, pi.nome_produto, pi.quantidade, pi.preco_unitario, pi.complementos
    from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
    where pr.pedido_id = p_pedido_id and not pi.cancelado
  loop
    insert into venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_unitario, complementos)
    values (v_venda_id, v_item.produto_id, v_item.nome_produto, v_item.quantidade, v_item.preco_unitario, coalesce(v_item.complementos, '[]'::jsonb));
  end loop;

  for v_pagamento in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into pagamentos (venda_id, forma, valor)
    values (v_venda_id, v_pagamento->>'forma', (v_pagamento->>'valor')::numeric);
  end loop;

  insert into pagamentos (venda_id, forma, valor)
  select v_venda_id, forma, valor from pedido_pagamentos where pedido_id = p_pedido_id;

  update pedidos set status = 'pago', venda_id = v_venda_id where id = p_pedido_id;
  update mesas set status = 'livre' where id = v_pedido.mesa_id or id = any(v_pedido.mesas_juntadas);

  if coalesce(p_desconto, 0) > 0 then
    insert into audit_logs (usuario_id, acao, detalhes)
    values (auth.uid(), 'desconto', jsonb_build_object('venda_id', v_venda_id, 'valor', p_desconto, 'origem', 'comanda'));
  end if;

  return v_venda_id;
end;
$$;
