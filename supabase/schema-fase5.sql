-- Fase 5: impressão automática do pedido na cozinha (impressora térmica
-- Bluetooth pareada num tablet/celular Android fixo perto da impressora).

alter table pedido_rodadas add column impresso boolean not null default false;

-- Tempo real na tabela de rodadas: o Painel de Pedidos escuta por INSERTs
-- pra imprimir na hora, em vez de esperar o próximo ciclo de atualização.
alter publication supabase_realtime add table pedido_rodadas;
