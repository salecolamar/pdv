-- Fase 3: opções de comanda (cancelar item, transferir mesa/item, conta e
-- pagamento parcial) — tudo em cima da estrutura de pedidos/pedido_itens já
-- existente (fase 2).

alter table pedido_itens add column cancelado boolean not null default false;

-- pedido_pagamentos: pagamentos recebidos ENQUANTO a comanda ainda está
-- aberta (pagamento parcial) — abatido do total na hora de finalizar a
-- comanda em finalizar_pedido_mesa.
create table pedido_pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  forma text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  valor numeric(10, 2) not null,
  usuario_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);
alter table pedido_pagamentos enable row level security;
create policy "pedido_pagamentos_isolamento" on pedido_pagamentos for all to authenticated
  using (pedido_id in (select id from pedidos where empresa_id = empresa_id_atual()))
  with check (pedido_id in (select id from pedidos where empresa_id = empresa_id_atual()));

-- cancelar_item_pedido: tira um item da comanda (fica marcado como
-- cancelado, não é deletado, pra manter auditoria) e devolve o estoque.
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
  values (auth.uid(), 'cancelar_item_pedido', jsonb_build_object('item_id', p_item_id, 'pedido_id', v_pedido.id, 'nome_produto', v_item.nome_produto, 'motivo', p_motivo));
end;
$$;

-- transferir_item_pedido: move 1 item pra outra mesa. Se a mesa destino
-- estiver livre, abre uma comanda nova nela (mesmo cliente da origem); se já
-- tiver comanda aberta, o item entra numa rodada nova dessa comanda.
create or replace function transferir_item_pedido(p_item_id uuid, p_mesa_destino_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_item pedido_itens%rowtype;
  v_rodada_origem pedido_rodadas%rowtype;
  v_pedido_origem pedidos%rowtype;
  v_pedido_destino pedidos%rowtype;
  v_rodada_destino_id uuid;
  v_itens_restantes int;
begin
  select * into v_item from pedido_itens where id = p_item_id;
  if v_item is null or v_item.cancelado then
    raise exception 'Item não encontrado.';
  end if;

  select * into v_rodada_origem from pedido_rodadas where id = v_item.rodada_id;
  select * into v_pedido_origem from pedidos where id = v_rodada_origem.pedido_id;
  if v_pedido_origem.status <> 'aberto' then
    raise exception 'Só é possível transferir itens de uma comanda aberta.';
  end if;
  if v_pedido_origem.mesa_id = p_mesa_destino_id then
    raise exception 'Escolha uma mesa diferente da atual.';
  end if;

  select * into v_pedido_destino from pedidos
  where mesa_id = p_mesa_destino_id and status = 'aberto';

  if v_pedido_destino is null then
    insert into pedidos (mesa_id, cliente_id, aberto_por)
    values (p_mesa_destino_id, v_pedido_origem.cliente_id, auth.uid())
    returning * into v_pedido_destino;
    update mesas set status = 'ocupada' where id = p_mesa_destino_id;
  end if;

  insert into pedido_rodadas (pedido_id, operador_id) values (v_pedido_destino.id, auth.uid())
  returning id into v_rodada_destino_id;

  update pedido_itens set rodada_id = v_rodada_destino_id where id = p_item_id;

  select count(*) into v_itens_restantes from pedido_itens where rodada_id = v_rodada_origem.id and not cancelado;
  if v_itens_restantes = 0 then
    delete from pedido_rodadas where id = v_rodada_origem.id;
  end if;
end;
$$;

-- transferir_mesa: move a comanda inteira (todas as rodadas/itens) pra outra
-- mesa que esteja livre.
create or replace function transferir_mesa(p_pedido_id uuid, p_mesa_destino_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_mesa_destino mesas%rowtype;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null or v_pedido.status <> 'aberto' then
    raise exception 'Comanda não encontrada ou não está aberta.';
  end if;

  select * into v_mesa_destino from mesas where id = p_mesa_destino_id;
  if v_mesa_destino is null then
    raise exception 'Mesa de destino não encontrada.';
  end if;
  if v_mesa_destino.status <> 'livre' then
    raise exception 'A mesa de destino precisa estar livre.';
  end if;

  update pedidos set mesa_id = p_mesa_destino_id where id = p_pedido_id;
  update mesas set status = 'livre' where id = v_pedido.mesa_id;
  update mesas set status = 'ocupada' where id = p_mesa_destino_id;
end;
$$;

-- registrar_pagamento_parcial: recebe parte do valor da comanda enquanto ela
-- ainda está aberta (ex: um dos clientes da mesa já quer pagar a parte dele).
create or replace function registrar_pagamento_parcial(p_pedido_id uuid, p_forma text, p_valor numeric)
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

  select coalesce(sum(valor), 0) into v_ja_pago from pedido_pagamentos where pedido_id = p_pedido_id;

  if v_ja_pago + p_valor > v_total + 0.01 then
    raise exception 'Esse valor é maior que o restante da comanda.';
  end if;

  insert into pedido_pagamentos (pedido_id, forma, valor, usuario_id)
  values (p_pedido_id, p_forma, p_valor, auth.uid());
end;
$$;

-- finalizar_pedido_mesa redeclarada: passa a ignorar itens cancelados no
-- total, abater os pagamentos parciais já recebidos, e levar os
-- pedido_pagamentos pro caixa junto com a venda final.
create or replace function finalizar_pedido_mesa(
  p_pedido_id uuid,
  p_pagamentos jsonb,
  p_desconto numeric default 0,
  p_cliente_id uuid default null
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
  if v_pedido.status <> 'fechado' then
    raise exception 'Feche a comanda antes de receber o pagamento.';
  end if;

  select coalesce(sum(pi.quantidade * pi.preco_unitario), 0) into v_subtotal
  from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
  where pr.pedido_id = p_pedido_id and not pi.cancelado;

  if v_subtotal = 0 then
    raise exception 'Essa comanda não tem itens lançados.';
  end if;

  v_total := v_subtotal - coalesce(p_desconto, 0);
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

  insert into vendas (id, cliente_id, caixa_id, operador_id, subtotal, desconto, total)
  values (v_venda_id, coalesce(p_cliente_id, v_pedido.cliente_id), v_caixa_id, auth.uid(), v_subtotal, coalesce(p_desconto, 0), v_total);

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
