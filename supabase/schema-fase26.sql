-- ---------------------------------------------------------------------
-- Fase 26: habilita a replicação em tempo real (Realtime) pras tabelas
-- que o app já tentava escutar via supabase.channel(...) — só
-- pedido_rodadas estava de fato na publicação supabase_realtime, então
-- os outros canais (ex: "estoque-produtos" em produtos) nunca disparavam
-- de verdade. Sem isso, qualquer alteração feita pelo admin (preço,
-- estoque, categoria, complemento, cardápio, promoção, mesa, taxa de
-- serviço, cargo/permissão) só chegava pro garçom quando ele saía e
-- voltava na tela — agora chega na hora, com a tela já aberta.
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table produtos;
alter publication supabase_realtime add table categorias;
alter publication supabase_realtime add table promocoes;
alter publication supabase_realtime add table cardapios;
alter publication supabase_realtime add table cardapio_produtos;
alter publication supabase_realtime add table complementos;
alter publication supabase_realtime add table produto_complementos;
alter publication supabase_realtime add table mesas;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table empresas;
alter publication supabase_realtime add table usuarios;
alter publication supabase_realtime add table vendas;
