-- Schema do PDV multiempresa. Rode este arquivo inteiro no SQL Editor do
-- Supabase (painel do projeto -> SQL Editor -> New query -> colar -> Run).
-- Cobre as tabelas do MVP (seção 27 do documento). Tabelas de fase 2 (mesas,
-- pedidos, promoções) ficam em supabase/schema-fase2.sql, aplicado depois.

-- ---------------------------------------------------------------------
-- empresas e usuarios primeiro (sem RLS ainda) — as funções auxiliares logo
-- abaixo consultam `usuarios`, e funções "language sql" são validadas na
-- criação, então a tabela precisa existir antes da função ser criada.
-- ---------------------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'Bar',
  endereco text,
  telefone text,
  cor_primaria text not null default '#ff6a3d',
  logo_url text,
  criado_em timestamptz not null default now()
);

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  email text not null,
  role text not null default 'operador' check (role in ('admin', 'gerente', 'operador')),
  permissoes jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções auxiliares: empresa/role do usuário logado.
--
-- SECURITY DEFINER é o que evita "infinite recursion detected in policy":
-- sem isso, a política de RLS da própria tabela `usuarios` teria que
-- consultar `usuarios` de novo pra descobrir a empresa, e essa segunda
-- consulta dispararia a mesma política de novo. Rodando como o dono da
-- função (que ignora RLS), a consulta interna acontece uma vez só.
-- ---------------------------------------------------------------------
create or replace function empresa_id_atual()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select empresa_id from usuarios where id = auth.uid()
$$;

create or replace function role_atual()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from usuarios where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- RLS de empresas e usuarios (agora que as funções já existem)
-- ---------------------------------------------------------------------
alter table empresas enable row level security;

-- Qualquer pessoa autenticada pode criar uma empresa (vira o cadastro
-- inicial); só quem já pertence a ela pode ler/editar depois.
create policy "empresas_insert_autenticado" on empresas
  for insert to authenticated
  with check (true);

create policy "empresas_select_membro" on empresas
  for select to authenticated
  using (id = empresa_id_atual());

create policy "empresas_update_admin" on empresas
  for update to authenticated
  using (id = empresa_id_atual() and role_atual() = 'admin');

alter table usuarios enable row level security;

-- Cadastro inicial: o próprio usuário se insere (id = auth.uid()) — é assim
-- que ele vira admin da empresa que acabou de criar. Convite de novos
-- funcionários (fase MVP item 9) é feito por uma rota server-side com a
-- service role key, não direto do cliente, então não precisa de política
-- de insert pra "admin criando outro usuário" aqui.
create policy "usuarios_insert_self" on usuarios
  for insert to authenticated
  with check (id = auth.uid());

create policy "usuarios_select_mesma_empresa" on usuarios
  for select to authenticated
  using (empresa_id = empresa_id_atual());

create policy "usuarios_update_self_ou_admin" on usuarios
  for update to authenticated
  using (id = auth.uid() or (empresa_id = empresa_id_atual() and role_atual() = 'admin'));

-- categorias
create table categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0
);
alter table categorias enable row level security;
create policy "categorias_isolamento" on categorias for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- produtos
create table produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete set null,
  nome text not null,
  descricao text,
  preco numeric(10, 2) not null,
  preco_promocional numeric(10, 2),
  sku text,
  estoque numeric(10, 2), -- null = sem controle de estoque
  estoque_minimo numeric(10, 2),
  unidade text not null default 'un',
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table produtos enable row level security;
create policy "produtos_isolamento" on produtos for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- produto_variacoes (ex: "Corte + Barba" a partir de um preço base)
create table produto_variacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  nome text not null,
  preco_adicional numeric(10, 2) not null default 0
);
alter table produto_variacoes enable row level security;
create policy "produto_variacoes_isolamento" on produto_variacoes for all to authenticated
  using (produto_id in (select id from produtos where empresa_id = empresa_id_atual()))
  with check (produto_id in (select id from produtos where empresa_id = empresa_id_atual()));

-- produto_complementos (ex: "Bacon extra")
create table produto_complementos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  nome text not null,
  preco_adicional numeric(10, 2) not null default 0
);
alter table produto_complementos enable row level security;
create policy "produto_complementos_isolamento" on produto_complementos for all to authenticated
  using (produto_id in (select id from produtos where empresa_id = empresa_id_atual()))
  with check (produto_id in (select id from produtos where empresa_id = empresa_id_atual()));

-- clientes
create table clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  cpf text,
  nascimento date,
  observacoes text,
  criado_em timestamptz not null default now()
);
alter table clientes enable row level security;
create policy "clientes_isolamento" on clientes for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- caixas (sessão de caixa: abertura/fechamento)
create table caixas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  valor_inicial numeric(10, 2) not null default 0,
  aberto_por uuid references usuarios(id),
  aberto_em timestamptz not null default now(),
  fechado_por uuid references usuarios(id),
  fechado_em timestamptz,
  valor_informado numeric(10, 2),
  diferenca numeric(10, 2)
);
alter table caixas enable row level security;
create policy "caixas_isolamento" on caixas for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- caixa_movimentos (sangria, entrada, retirada, despesa)
create table caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references caixas(id) on delete cascade,
  tipo text not null check (tipo in ('sangria', 'entrada', 'retirada', 'despesa')),
  valor numeric(10, 2) not null,
  motivo text,
  usuario_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);
alter table caixa_movimentos enable row level security;
create policy "caixa_movimentos_isolamento" on caixa_movimentos for all to authenticated
  using (caixa_id in (select id from caixas where empresa_id = empresa_id_atual()))
  with check (caixa_id in (select id from caixas where empresa_id = empresa_id_atual()));

-- vendas
create table vendas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  caixa_id uuid references caixas(id),
  operador_id uuid references usuarios(id),
  subtotal numeric(10, 2) not null,
  desconto numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  cancelada boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table vendas enable row level security;
create policy "vendas_isolamento" on vendas for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- venda_itens (guarda nome_produto e preco_unitario como retrato da venda —
-- se o preço do produto mudar depois, a venda antiga não muda)
create table venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  nome_produto text not null,
  quantidade numeric(10, 2) not null,
  preco_unitario numeric(10, 2) not null,
  desconto numeric(10, 2) not null default 0
);
alter table venda_itens enable row level security;
create policy "venda_itens_isolamento" on venda_itens for all to authenticated
  using (venda_id in (select id from vendas where empresa_id = empresa_id_atual()))
  with check (venda_id in (select id from vendas where empresa_id = empresa_id_atual()));

-- pagamentos (uma venda pode ter mais de um — pagamento dividido)
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  forma text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  valor numeric(10, 2) not null
);
alter table pagamentos enable row level security;
create policy "pagamentos_isolamento" on pagamentos for all to authenticated
  using (venda_id in (select id from vendas where empresa_id = empresa_id_atual()))
  with check (venda_id in (select id from vendas where empresa_id = empresa_id_atual()));

-- estoque_movimentos
create table estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(10, 2) not null,
  usuario_id uuid references usuarios(id),
  motivo text,
  criado_em timestamptz not null default now()
);
alter table estoque_movimentos enable row level security;
create policy "estoque_movimentos_isolamento" on estoque_movimentos for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- audit_logs
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
alter table audit_logs enable row level security;
create policy "audit_logs_isolamento" on audit_logs for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- Índices usados pelas telas de PDV/relatórios (buscar por empresa + período,
-- e listar produto/cliente por nome).
create index vendas_empresa_criado_em_idx on vendas (empresa_id, criado_em desc);
create index produtos_empresa_ativo_idx on produtos (empresa_id, ativo);
create index clientes_empresa_nome_idx on clientes (empresa_id, nome);

-- ---------------------------------------------------------------------
-- finalizar_venda: fecha uma venda inteira numa transação só — valida
-- estoque, cria a venda, os itens e os pagamentos, e baixa o estoque dos
-- produtos controlados. Se qualquer parte falhar (estoque insuficiente,
-- pagamentos que não batem com o total), a função inteira desfaz sozinha.
-- ---------------------------------------------------------------------
create or replace function finalizar_venda(
  p_itens jsonb,
  p_pagamentos jsonb,
  p_desconto numeric default 0,
  p_cliente_id uuid default null
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
begin
  if jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa ter ao menos um item.';
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

  v_total := v_subtotal - coalesce(p_desconto, 0);
  if v_total < 0 then
    raise exception 'O desconto não pode ser maior que o total da venda.';
  end if;

  select coalesce(sum((p->>'valor')::numeric), 0) into v_soma_pagamentos
  from jsonb_array_elements(p_pagamentos) p;
  if abs(v_soma_pagamentos - v_total) > 0.01 then
    raise exception 'O total dos pagamentos (%) não bate com o valor da venda (%).', v_soma_pagamentos, v_total;
  end if;

  insert into vendas (id, cliente_id, operador_id, subtotal, desconto, total)
  values (v_venda_id, p_cliente_id, auth.uid(), v_subtotal, coalesce(p_desconto, 0), v_total);

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

    update produtos set estoque = estoque - (v_item->>'quantidade')::numeric
    where id = (v_item->>'produto_id')::uuid and estoque is not null;
  end loop;

  for v_pagamento in select * from jsonb_array_elements(p_pagamentos)
  loop
    insert into pagamentos (venda_id, forma, valor)
    values (v_venda_id, v_pagamento->>'forma', (v_pagamento->>'valor')::numeric);
  end loop;

  return v_venda_id;
end;
$$;
