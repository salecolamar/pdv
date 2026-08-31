-- Fase 7: corrige regressão — "Receber pagamento" numa comanda aberta não
-- pode fechar ela antes da hora. Antes o cliente chamava fecharComanda()
-- pra poder abrir a tela de pagamento, e se o garçom voltasse sem pagar a
-- comanda ficava travada em 'fechado' (sumia o botão "Lançar itens").
-- Agora finalizar_pedido_mesa aceita tanto 'aberto' quanto 'fechado'
-- diretamente — o cliente não precisa mais fechar a comanda antes de pagar.
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
    select pi.produto_id, pi.nome_produto, pi.quantidade, pi.preco_unitario
    from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
    where pr.pedido_id = p_pedido_id and not pi.cancelado
  loop
    insert into venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    values (v_venda_id, v_item.produto_id, v_item.nome_produto, v_item.quantidade, v_item.preco_unitario);
  end loop;

  for v_pagamento in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into pagamentos (venda_id, forma, valor)
    values (v_venda_id, v_pagamento->>'forma', (v_pagamento->>'valor')::numeric);
  end loop;

  insert into pagamentos (venda_id, forma, valor)
  select v_venda_id, forma, valor from pedido_pagamentos where pedido_id = p_pedido_id;

  update pedidos set status = 'pago', venda_id = v_venda_id where id = p_pedido_id;
  update mesas set status = 'livre' where id = v_pedido.mesa_id;

  if coalesce(p_desconto, 0) > 0 then
    insert into audit_logs (usuario_id, acao, detalhes)
    values (auth.uid(), 'desconto', jsonb_build_object('venda_id', v_venda_id, 'valor', p_desconto, 'origem', 'comanda'));
  end if;

  return v_venda_id;
end;
$$;
