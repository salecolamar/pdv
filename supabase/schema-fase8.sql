-- Fase 8: reservas de mesa, juntar mesas, comissão de garçom.

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table reservas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  mesa_id uuid references mesas(id) on delete set null,
  nome_cliente text not null,
  telefone text,
  horario timestamptz not null,
  observacao text,
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'cancelada')),
  criado_por uuid references usuarios(id),
  criado_em timestamptz not null default now()
);
alter table reservas enable row level security;
create policy "reservas_isolamento" on reservas for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());
create index reservas_horario_idx on reservas (horario);

-- ---------------------------------------------------------------------
-- Juntar mesas: pedidos.mesas_juntadas guarda mesas extras vinculadas à
-- mesma comanda, além da mesa_id principal.
-- ---------------------------------------------------------------------
alter table pedidos add column mesas_juntadas uuid[] not null default '{}';

create or replace function juntar_mesas(p_pedido_id uuid, p_mesa_ids uuid[])
returns void
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_mesa_id uuid;
  v_mesa mesas%rowtype;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null or v_pedido.status <> 'aberto' then
    raise exception 'Comanda não encontrada ou não está aberta.';
  end if;

  foreach v_mesa_id in array p_mesa_ids
  loop
    if v_mesa_id = v_pedido.mesa_id or v_mesa_id = any(v_pedido.mesas_juntadas) then
      continue;
    end if;
    select * into v_mesa from mesas where id = v_mesa_id;
    if v_mesa is null then
      raise exception 'Mesa não encontrada.';
    end if;
    if v_mesa.status <> 'livre' then
      raise exception '% não está livre.', v_mesa.nome;
    end if;
    update pedidos set mesas_juntadas = array_append(mesas_juntadas, v_mesa_id) where id = p_pedido_id;
    update mesas set status = 'ocupada' where id = v_mesa_id;
  end loop;
end;
$$;

-- separar_mesa: tira uma mesa juntada, devolve ela como livre no mapa,
-- sem mexer no resto da comanda.
create or replace function separar_mesa(p_pedido_id uuid, p_mesa_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if not (p_mesa_id = any(v_pedido.mesas_juntadas)) then
    raise exception 'Essa mesa não está juntada nessa comanda.';
  end if;
  update pedidos set mesas_juntadas = array_remove(mesas_juntadas, p_mesa_id) where id = p_pedido_id;
  update mesas set status = 'livre' where id = p_mesa_id;
end;
$$;

-- finalizar_pedido_mesa redeclarada: libera a mesa principal E as
-- juntadas quando a comanda é paga.
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
  update mesas set status = 'livre' where id = v_pedido.mesa_id or id = any(v_pedido.mesas_juntadas);

  if coalesce(p_desconto, 0) > 0 then
    insert into audit_logs (usuario_id, acao, detalhes)
    values (auth.uid(), 'desconto', jsonb_build_object('venda_id', v_venda_id, 'valor', p_desconto, 'origem', 'comanda'));
  end if;

  return v_venda_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Comissão de garçom
-- ---------------------------------------------------------------------
alter table usuarios add column comissao_percentual numeric(5, 2) not null default 0;
