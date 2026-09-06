-- ---------------------------------------------------------------------
-- Fase 23: alertar o garçom no mapa de mesas quando um pedido fica
-- pronto na cozinha (KDS) — precisa de um jeito de saber se aquele
-- "pronto" já foi visto, senão o alerta nunca desliga.
-- ---------------------------------------------------------------------

alter table pedido_rodadas add column if not exists visto boolean not null default false;
