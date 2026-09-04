-- ---------------------------------------------------------------------
-- Fase 13: visibilidade de "quanto o garçom está vendendo" no PDV
-- (liga/desliga geral por empresa + bloqueio individual por garçom).
-- ---------------------------------------------------------------------

alter table empresas add column if not exists mostrar_vendas_garcom boolean not null default true;
alter table usuarios add column if not exists ocultar_vendas boolean not null default false;
