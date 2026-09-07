-- ---------------------------------------------------------------------
-- Fase 25: caixa passa a ser obrigatório pra vender. Sem um caixa aberto
-- (aberto só por gerente ou admin), nenhuma venda — mesa ou ficha avulsa,
-- parcial ou total — pode ser fechada. O gerente/admin abre e fecha o
-- caixa direto na tela de seleção de garçom/gerente (sem precisar logar
-- de verdade como aquele usuário), com autorização por senha/PIN, do
-- mesmo jeito que já autoriza cancelamento — e não pode fechar o caixa
-- se ainda tiver mesa com comanda em aberto.
-- ---------------------------------------------------------------------

-- Só um caixa aberto por empresa por vez (trava a nível de banco, além
-- da regra de aplicação).
create unique index if not exists caixas_uma_aberta_por_empresa on caixas (empresa_id) where fechado_em is null;

-- Verifica se o usuário pode autorizar abertura/fechamento de caixa
-- (só admin ou gerente) sem precisar logar como ele — mesmo padrão da
-- verificar_autorizacao_cancelamento, mas chamável antes do login
-- (recebe p_empresa_id em vez de usar empresa_id_atual()).
create or replace function verificar_autorizacao_caixa(p_empresa_id uuid, p_usuario_id uuid, p_senha text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row usuarios%rowtype;
  v_ok boolean;
begin
  select * into v_row from usuarios where id = p_usuario_id and empresa_id = p_empresa_id;
  if v_row is null then
    raise exception 'Usuário não encontrado.';
  end if;
  if v_row.ativo = false then
    raise exception 'Esse usuário está inativo.';
  end if;
  if v_row.role not in ('admin', 'gerente') then
    raise exception 'Só um gerente ou administrador pode abrir ou fechar o caixa.';
  end if;

  select (encrypted_password = extensions.crypt(p_senha, encrypted_password)) into v_ok
  from auth.users where id = p_usuario_id;

  if v_ok is not true then
    raise exception 'Senha incorreta.';
  end if;

  return true;
end;
$$;

-- Lista quem pode autorizar abertura/fechamento de caixa (admin/gerente
-- ativos da empresa) — pra popular o seletor na tela pré-login.
create or replace function listar_autorizadores_caixa(p_empresa_id uuid)
returns table(id uuid, nome text, role text)
language sql
stable security definer
set search_path = public
as $$
  select id, nome, role from usuarios
  where empresa_id = p_empresa_id and role in ('admin', 'gerente') and ativo = true
  order by nome;
$$;

-- Resumo do caixa aberto da empresa (ou nenhuma linha, se não tiver
-- nenhum aberto) — usado tanto na tela pré-login (decidir "abrir" vs
-- "fechar" e mostrar o valor esperado antes de fechar) quanto, depois,
-- pro garçom/gerente ver quem abriu e quando.
create or replace function resumo_caixa_aberto(p_empresa_id uuid)
returns table(
  caixa_id uuid,
  aberto_em timestamptz,
  aberto_por_nome text,
  valor_inicial numeric,
  vendas_dinheiro numeric,
  movimentos numeric,
  esperado numeric,
  mesas_abertas int
)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_caixa caixas%rowtype;
begin
  select * into v_caixa from caixas
  where empresa_id = p_empresa_id and fechado_em is null
  order by aberto_em desc limit 1;

  if v_caixa is null then
    return;
  end if;

  return query
  select
    v_caixa.id,
    v_caixa.aberto_em,
    (select nome from usuarios where id = v_caixa.aberto_por),
    v_caixa.valor_inicial,
    (
      select coalesce(sum(pg.valor), 0) from pagamentos pg
      join vendas v on v.id = pg.venda_id
      where v.caixa_id = v_caixa.id and pg.forma = 'dinheiro' and v.cancelada = false
    ),
    (
      select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0)
      from caixa_movimentos where caixa_movimentos.caixa_id = v_caixa.id
    ),
    v_caixa.valor_inicial
      + (
          select coalesce(sum(pg.valor), 0) from pagamentos pg
          join vendas v on v.id = pg.venda_id
          where v.caixa_id = v_caixa.id and pg.forma = 'dinheiro' and v.cancelada = false
        )
      + (
          select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0)
          from caixa_movimentos where caixa_movimentos.caixa_id = v_caixa.id
        ),
    (select count(*)::int from pedidos where empresa_id = p_empresa_id and status in ('aberto', 'fechado'));
end;
$$;

-- Abre o caixa do dia com autorização de gerente/admin, sem precisar
-- logar como ele.
create or replace function abrir_caixa_autorizado(p_empresa_id uuid, p_usuario_id uuid, p_senha text, p_valor_inicial numeric)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_ja_existe boolean;
  v_id uuid;
begin
  perform verificar_autorizacao_caixa(p_empresa_id, p_usuario_id, p_senha);

  select exists(select 1 from caixas where empresa_id = p_empresa_id and fechado_em is null) into v_ja_existe;
  if v_ja_existe then
    raise exception 'Já existe um caixa aberto pra essa empresa.';
  end if;

  insert into caixas (empresa_id, valor_inicial, aberto_por)
  values (p_empresa_id, coalesce(p_valor_inicial, 0), p_usuario_id)
  returning id into v_id;

  insert into audit_logs (empresa_id, usuario_id, acao, detalhes)
  values (p_empresa_id, p_usuario_id, 'abrir_caixa', jsonb_build_object('valor_inicial', p_valor_inicial));

  return v_id;
end;
$$;

-- Fecha o caixa do dia com autorização de gerente/admin, sem precisar
-- logar como ele — bloqueia se ainda tiver mesa com comanda em aberto.
create or replace function fechar_caixa_autorizado(p_empresa_id uuid, p_usuario_id uuid, p_senha text, p_valor_informado numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caixa caixas%rowtype;
  v_mesas_abertas int;
  v_vendas_dinheiro numeric := 0;
  v_movimentos numeric := 0;
  v_esperado numeric;
  v_diferenca numeric;
begin
  perform verificar_autorizacao_caixa(p_empresa_id, p_usuario_id, p_senha);

  select * into v_caixa from caixas
  where empresa_id = p_empresa_id and fechado_em is null
  order by aberto_em desc limit 1;
  if v_caixa is null then
    raise exception 'Nenhum caixa aberto pra essa empresa.';
  end if;

  select count(*) into v_mesas_abertas from pedidos where empresa_id = p_empresa_id and status in ('aberto', 'fechado');
  if v_mesas_abertas > 0 then
    raise exception 'Existem % mesa(s) com comanda em aberto. Feche todas antes de fechar o caixa.', v_mesas_abertas;
  end if;

  select coalesce(sum(pg.valor), 0) into v_vendas_dinheiro
  from pagamentos pg join vendas v on v.id = pg.venda_id
  where v.caixa_id = v_caixa.id and pg.forma = 'dinheiro' and v.cancelada = false;

  select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0) into v_movimentos
  from caixa_movimentos where caixa_id = v_caixa.id;

  v_esperado := v_caixa.valor_inicial + v_vendas_dinheiro + v_movimentos;
  v_diferenca := p_valor_informado - v_esperado;

  update caixas
  set fechado_em = now(), fechado_por = p_usuario_id, valor_informado = p_valor_informado, diferenca = v_diferenca
  where id = v_caixa.id;

  insert into audit_logs (empresa_id, usuario_id, acao, detalhes)
  values (p_empresa_id, p_usuario_id, 'fechar_caixa', jsonb_build_object('caixa_id', v_caixa.id, 'esperado', v_esperado, 'informado', p_valor_informado, 'diferenca', v_diferenca));

  return jsonb_build_object('esperado', v_esperado, 'diferenca', v_diferenca);
end;
$$;

-- fechar_caixa (fluxo autenticado do admin, já existente) ganha a mesma
-- trava de mesa em aberto.
create or replace function fechar_caixa(p_caixa_id uuid, p_valor_informado numeric)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_caixa caixas%rowtype;
  v_mesas_abertas int;
  v_vendas_dinheiro numeric := 0;
  v_movimentos numeric := 0;
  v_esperado numeric;
  v_diferenca numeric;
begin
  select * into v_caixa from caixas where id = p_caixa_id;
  if v_caixa is null then
    raise exception 'Caixa não encontrado.';
  end if;
  if v_caixa.fechado_em is not null then
    raise exception 'Esse caixa já está fechado.';
  end if;

  select count(*) into v_mesas_abertas from pedidos where empresa_id = v_caixa.empresa_id and status in ('aberto', 'fechado');
  if v_mesas_abertas > 0 then
    raise exception 'Existem % mesa(s) com comanda em aberto. Feche todas antes de fechar o caixa.', v_mesas_abertas;
  end if;

  select coalesce(sum(pg.valor), 0) into v_vendas_dinheiro
  from pagamentos pg
  join vendas v on v.id = pg.venda_id
  where v.caixa_id = p_caixa_id and pg.forma = 'dinheiro' and v.cancelada = false;

  select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0) into v_movimentos
  from caixa_movimentos where caixa_id = p_caixa_id;

  v_esperado := v_caixa.valor_inicial + v_vendas_dinheiro + v_movimentos;
  v_diferenca := p_valor_informado - v_esperado;

  update caixas
  set fechado_em = now(), fechado_por = auth.uid(), valor_informado = p_valor_informado, diferenca = v_diferenca
  where id = p_caixa_id;

  insert into audit_logs (usuario_id, acao, detalhes)
  values (auth.uid(), 'fechar_caixa', jsonb_build_object('caixa_id', p_caixa_id, 'esperado', v_esperado, 'informado', p_valor_informado, 'diferenca', v_diferenca));

  return jsonb_build_object('esperado', v_esperado, 'diferenca', v_diferenca);
end;
$$;

-- finalizar_pedido_mesa (pagamento total da comanda de mesa) passa a
-- exigir caixa aberto.
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
  if v_caixa_id is null then
    raise exception 'Nenhum caixa aberto. Peça pro gerente ou admin abrir o caixa antes de receber pagamentos.';
  end if;

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

-- registrar_pagamento_parcial (pagamento parcial/"pagar selecionados" da
-- comanda de mesa) passa a exigir caixa aberto também.
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
  v_caixa_id uuid;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor válido.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null or v_pedido.status not in ('aberto', 'fechado') then
    raise exception 'Comanda não encontrada ou já paga.';
  end if;

  select id into v_caixa_id from caixas
  where empresa_id = empresa_id_atual() and fechado_em is null
  order by aberto_em desc limit 1;
  if v_caixa_id is null then
    raise exception 'Nenhum caixa aberto. Peça pro gerente ou admin abrir o caixa antes de receber pagamentos.';
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

-- finalizar_venda (venda avulsa/Ficha, fora de mesa) passa a exigir
-- caixa aberto também.
create or replace function finalizar_venda(
  p_itens jsonb,
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
  v_venda_id uuid := gen_random_uuid();
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_soma_pagamentos numeric := 0;
  v_item jsonb;
  v_pagamento jsonb;
  v_produto produtos%rowtype;
  v_qtd numeric;
  v_caixa_id uuid;
begin
  if jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa ter ao menos um item.';
  end if;

  select id into v_caixa_id from caixas
  where empresa_id = empresa_id_atual() and fechado_em is null
  order by aberto_em desc limit 1;
  if v_caixa_id is null then
    raise exception 'Nenhum caixa aberto. Peça pro gerente ou admin abrir o caixa antes de vender.';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := (v_item->>'quantidade')::numeric;
    select * into v_produto from produtos where id = (v_item->>'produto_id')::uuid;
    if v_produto is null then
      raise exception 'Produto não encontrado.';
    end if;
    if v_produto.estoque is not null and v_produto.estoque < v_qtd then
      raise exception 'Estoque insuficiente de "%". Disponível: %.', v_produto.nome, v_produto.estoque;
    end if;
    v_subtotal := v_subtotal + (v_qtd * (v_item->>'preco_unitario')::numeric);
  end loop;

  v_total := v_subtotal - coalesce(p_desconto, 0) + coalesce(p_taxa_servico, 0);
  if v_total < 0 then
    raise exception 'O desconto não pode ser maior que o total da venda.';
  end if;

  select coalesce(sum((p->>'valor')::numeric), 0) into v_soma_pagamentos
  from jsonb_array_elements(p_pagamentos) p;
  if abs(v_soma_pagamentos - v_total) > 0.01 then
    raise exception 'O total dos pagamentos (%) não bate com o total da venda (%).', v_soma_pagamentos, v_total;
  end if;

  insert into vendas (id, cliente_id, caixa_id, operador_id, subtotal, desconto, taxa_servico, total)
  values (v_venda_id, p_cliente_id, v_caixa_id, auth.uid(), v_subtotal, coalesce(p_desconto, 0), coalesce(p_taxa_servico, 0), v_total);

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    insert into venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    values (
      v_venda_id,
      (v_item->>'produto_id')::uuid,
      v_item->>'nome_produto',
      (v_item->>'quantidade')::numeric,
      (v_item->>'preco_unitario')::numeric
    );

    select * into v_produto from produtos where id = (v_item->>'produto_id')::uuid;
    if v_produto.estoque is not null then
      update produtos set estoque = estoque - (v_item->>'quantidade')::numeric
      where id = (v_item->>'produto_id')::uuid;

      insert into estoque_movimentos (produto_id, tipo, quantidade, usuario_id, motivo)
      values ((v_item->>'produto_id')::uuid, 'saida', -(v_item->>'quantidade')::numeric, auth.uid(), 'Venda');
    end if;
  end loop;

  for v_pagamento in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into pagamentos (venda_id, forma, valor)
    values (v_venda_id, v_pagamento->>'forma', (v_pagamento->>'valor')::numeric);
  end loop;

  if coalesce(p_desconto, 0) > 0 then
    insert into audit_logs (usuario_id, acao, detalhes)
    values (auth.uid(), 'desconto', jsonb_build_object('venda_id', v_venda_id, 'valor', p_desconto, 'origem', 'pdv'));
  end if;

  return v_venda_id;
end;
$$;
