-- Fase 9: reserva pode travar mais de uma mesa de uma vez, deixando elas
-- indisponíveis (status 'reservada') até o cliente chegar ou a reserva ser
-- cancelada.

alter table mesas drop constraint mesas_status_check;
alter table mesas add constraint mesas_status_check check (status in ('livre', 'ocupada', 'reservada'));

alter table reservas drop column mesa_id;
alter table reservas add column mesa_ids uuid[] not null default '{}';
