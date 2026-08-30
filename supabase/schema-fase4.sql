-- Fase 4: KDS com 3 colunas (Novos / Fazendo / Prontos) — os tickets não
-- somem mais da tela quando ficam prontos, só mudam de coluna. O antigo
-- status 'pendente' vira 'novo' (chegou, ninguém começou) + 'fazendo' (a
-- cozinha já está preparando).

alter table pedido_rodadas drop constraint pedido_rodadas_status_check;
alter table pedido_rodadas alter column status set default 'novo';
update pedido_rodadas set status = 'novo' where status = 'pendente';
alter table pedido_rodadas add constraint pedido_rodadas_status_check check (status in ('novo', 'fazendo', 'pronto'));
