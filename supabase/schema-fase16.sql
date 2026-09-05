-- registrar_pagamento_parcial redeclarada: o teto de validação (v_total)
-- não incluía a taxa de serviço, só o subtotal dos itens. Isso fazia o
-- pagamento parcial (ou "pagar selecionados", que já embute a taxa
-- proporcional no valor) ser rejeitado pelo banco assim que a soma paga
-- sem taxa chegava perto do subtotal — mesmo com "restante" (calculado no
-- front, COM taxa) ainda positivo. O garçom via a tela pedir um valor que
-- na prática nunca era aceito, e a mesa continuava com o valor cheio.
--
-- Remove a assinatura antiga (3 parâmetros) antes de recriar com o 4º
-- parâmetro — senão ficam as duas funções sobrecarregadas ao mesmo tempo
-- e uma chamada sem p_taxa_servico vira ambígua pro PostgREST.
drop function if exists registrar_pagamento_parcial(uuid, text, numeric);

create or replace function registrar_pagamento_parcial(p_pedido_id uuid, p_forma text, p_valor numeric, p_taxa_servico numeric default 0)
returns void
language plpgsql
security invoker
as $$
declare
  v_pedido pedidos%rowtype;
  v_total numeric;
  v_ja_pago numeric;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor válido.';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id;
  if v_pedido is null or v_pedido.status not in ('aberto', 'fechado') then
    raise exception 'Comanda não encontrada ou já paga.';
  end if;

  select coalesce(sum(pi.quantidade * pi.preco_unitario), 0) into v_total
  from pedido_itens pi join pedido_rodadas pr on pr.id = pi.rodada_id
  where pr.pedido_id = p_pedido_id and not pi.cancelado;

  v_total := v_total + coalesce(p_taxa_servico, 0);

  select coalesce(sum(valor), 0) into v_ja_pago from pedido_pagamentos where pedido_id = p_pedido_id;

  if v_ja_pago + p_valor > v_total + 0.01 then
    raise exception 'Esse valor é maior que o restante da comanda.';
  end if;

  insert into pedido_pagamentos (pedido_id, forma, valor, usuario_id)
  values (p_pedido_id, p_forma, p_valor, auth.uid());
end;
$$;
