-- ---------------------------------------------------------------------
-- Fase 12: observação em produtos, complementos (produto ligado a outro
-- produto já cadastrado) e "cardápios" (subconjuntos de produtos).
-- ---------------------------------------------------------------------

alter table produtos add column if not exists observacoes text;

-- produto_complementos_permitidos: quais produtos já cadastrados podem ser
-- oferecidos como complemento/acréscimo de outro produto (ex: hambúrguer
-- aceita "bacon extra" e "queijo extra", ambos já cadastrados no cardápio).
create table if not exists produto_complementos_permitidos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  complemento_produto_id uuid not null references produtos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (produto_id, complemento_produto_id),
  check (produto_id <> complemento_produto_id)
);
alter table produto_complementos_permitidos enable row level security;
create policy "produto_complementos_isolamento" on produto_complementos_permitidos for all to authenticated
  using (produto_id in (select id from produtos where empresa_id = empresa_id_atual()))
  with check (produto_id in (select id from produtos where empresa_id = empresa_id_atual()));

-- cardapios: subconjuntos de produtos (ex: "Cardápio de eventos", "Cardápio
-- de happy hour") que o garçom pode escolher na hora de lançar itens.
create table if not exists cardapios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table cardapios enable row level security;
create policy "cardapios_isolamento" on cardapios for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

create table if not exists cardapio_produtos (
  id uuid primary key default gen_random_uuid(),
  cardapio_id uuid not null references cardapios(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  unique (cardapio_id, produto_id)
);
alter table cardapio_produtos enable row level security;
create policy "cardapio_produtos_isolamento" on cardapio_produtos for all to authenticated
  using (cardapio_id in (select id from cardapios where empresa_id = empresa_id_atual()))
  with check (cardapio_id in (select id from cardapios where empresa_id = empresa_id_atual()));
