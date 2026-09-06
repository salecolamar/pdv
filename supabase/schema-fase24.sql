-- ---------------------------------------------------------------------
-- Fase 24: permitir escolher quais produtos aparecem no Painel de
-- Pedidos (KDS) — produtos que não vão pra cozinha/preparo (ex: taxas,
-- itens avulsos) não precisam poluir o painel.
-- ---------------------------------------------------------------------

alter table produtos add column if not exists exibir_no_kds boolean not null default true;
