-- Fase 2 do PDV: mesas/comandas com pedidos e status de preparo (cozinha).
-- Rode este arquivo inteiro no SQL Editor do Supabase DEPOIS de schema.sql.

-- mesas
create table mesas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  status text not null default 'livre' check (status in ('livre', 'ocupada')),
  criado_em timestamptz not null default now()
);
alter table mesas enable row level security;
create policy "mesas_isolamento" on mesas for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- pedidos (a comanda de uma mesa; vira uma venda normal quando é paga)
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  mesa_id uuid not null references mesas(id) on delete cascade,
  status text not null default 'aberto' check (status in ('aberto', 'fechado', 'pago')),
  venda_id uuid references vendas(id),
  aberto_por uuid references usuarios(id),
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz
);
alter table pedidos enable row level security;
create policy "pedidos_isolamento" on pedidos for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- Só pode existir 1 comanda ativa (aberta ou aguardando pagamento) por mesa.
create unique index pedidos_uma_ativa_por_mesa on pedidos (mesa_id) where status in ('aberto', 'fechado');

-- pedido_rodadas: cada leva de itens lançada de uma vez vira um ticket na
-- cozinha (mesma mesa pode ter várias rodadas — uma por pedido do garçom).
create table pedido_rodadas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'pronto')),
  operador_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);
alter table pedido_rodadas enable row level security;
create policy "pedido_rodadas_isolamento" on pedido_rodadas for all to authenticated
  using (pedido_id in (select id from pedidos where empresa_id = empresa_id_atual()))
  with check (pedido_id in (select id from pedidos where empresa_id = empresa_id_atual()));

-- pedido_itens (retrato do produto no momento do pedido, igual venda_itens)
create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references pedido_rodadas(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  nome_produto text not null,
  quantidade numeric(10, 2) not null,
  preco_unitario numeric(10, 2) not null
);
alter table pedido_itens enable row level security;
create policy "pedido_itens_isolamento" on pedido_itens for all to authenticated
  using (rodada_id in (select id from pedido_rodadas where pedido_id in (select id from pedidos where empresa_id = empresa_id_atual())))
  with check (rodada_id in (select id from pedido_rodadas where pedido_id in (select id from pedidos where empresa_id = empresa_id_atual())));

create index pedido_rodadas_pedido_idx on pedido_rodadas (pedido_id);
create index pedido_itens_rodada_idx on pedido_itens (rodada_id);

-- lancar_pedido_itens: registra uma rodada (ticket de cozinha) com os itens
-- pedidos e já baixa o estoque na hora (igual uma comanda de restaurante de
-- verdade: o insumo é consumido quando o pedido é feito, não só quando a
-- conta é paga — uma comanda pode ficar aberta por horas).
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
    insert into pedido_itens (rodada_id, produto_id, nome_produto, quantidade, preco_unitario)
    values (
      v_rodada_id,
      (v_item->>'produto_id')::uuid,
      v_item->>'nome_produto',
      (v_item->>'quantidade')::numeric,
      (v_item->>'preco_unitario')::numeric
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

-- finalizar_pedido_mesa: fecha a comanda em venda de verdade — reaproveita a
-- mesma estrutura de vendas/venda_itens/pagamentos/caixa do PDV avulso. Não
-- baixa estoque de novo (já foi baixado em lancar_pedido_itens).
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
  where pr.pedido_id = p_pedido_id;

  if v_subtotal = 0 then
    raise exception 'Essa comanda não tem itens lançados.';
  end if;

  v_total := v_subtotal - coalesce(p_desconto, 0);
  if v_total < 0 then
    raise exception 'O desconto não pode ser maior que o total da comanda.';
  end if;

  select coalesce(sum((p->>'valor')::numeric), 0) into v_soma_pagamentos
  from jsonb_array_elements(p_pagamentos) p;
  if abs(v_soma_pagamentos - v_total) > 0.01 then
    raise exception 'O total dos pagamentos (%) não bate com o valor da comanda (%).', v_soma_pagamentos, v_total;
  end if;

  select id into v_caixa_id from caixas
  where empresa_id = empresa_id_atual() and fechado_em is null
  order by aberto_em desc limit 1;

  insert into vendas (id, cliente_id, caixa_id, operador_id, subtotal, desconto, total)
  values (v_venda_id, p_cliente_id, v_caixa_id, auth.uid(), v_subtotal, coalesce(p_desconto, 0), v_total);

  for v_item in
    select pi.produto_id, pi.nome_produto, pi.quantidade, pi.preco_unitario
    from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
    where pr.pedido_id = p_pedido_id
  loop
    insert into venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    values (v_venda_id, v_item.produto_id, v_item.nome_produto, v_item.quantidade, v_item.preco_unitario);
  end loop;

  for v_pagamento in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into pagamentos (venda_id, forma, valor)
    values (v_venda_id, v_pagamento->>'forma', (v_pagamento->>'valor')::numeric);
  end loop;

  update pedidos set status = 'pago', venda_id = v_venda_id where id = p_pedido_id;
  update mesas set status = 'livre' where id = v_pedido.mesa_id;

  return v_venda_id;
end;
$$;

-- promocoes: desconto automático por produto ou categoria inteira, com
-- vigência opcional por dia da semana, horário (happy hour) e/ou período.
-- Campo em branco = sem restrição naquele critério (ex: sem hora = dia
-- inteiro, sem dias_semana = todo dia da semana).
create table promocoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('percentual', 'fixo')),
  valor numeric(10, 2) not null,
  produto_id uuid references produtos(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete cascade,
  dias_semana int[],
  hora_inicio time,
  hora_fim time,
  data_inicio date,
  data_fim date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint promocoes_tem_alvo check (produto_id is not null or categoria_id is not null)
);
alter table promocoes enable row level security;
create policy "promocoes_isolamento" on promocoes for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());
