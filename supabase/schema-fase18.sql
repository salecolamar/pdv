-- ---------------------------------------------------------------------
-- Fase 18: catálogo próprio de Complementos (nome + preço, sem estoque
-- nem categoria) — substitui o antigo esquema em que um complemento era
-- só "outro produto já cadastrado". Complementos agora vivem soltos, são
-- escolhidos na edição do produto a partir dessa lista, e o preço deles
-- soma no valor do item lançado (não viram uma linha separada na conta).
-- ---------------------------------------------------------------------

create table if not exists complementos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default empresa_id_atual() references empresas(id) on delete cascade,
  nome text not null,
  preco numeric not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table complementos enable row level security;
create policy "complementos_isolamento" on complementos for all to authenticated
  using (empresa_id = empresa_id_atual()) with check (empresa_id = empresa_id_atual());

-- produto_complementos_permitidos nunca teve dado real (feature nova, 0
-- linhas em produção) — substituída direto, sem precisar migrar dados.
drop table if exists produto_complementos_permitidos;

create table if not exists produto_complementos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  complemento_id uuid not null references complementos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (produto_id, complemento_id)
);
alter table produto_complementos enable row level security;
create policy "produto_complementos_isolamento" on produto_complementos for all to authenticated
  using (produto_id in (select id from produtos where empresa_id = empresa_id_atual()))
  with check (produto_id in (select id from produtos where empresa_id = empresa_id_atual()));
