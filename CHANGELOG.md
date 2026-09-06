# Changelog

Histórico de mudanças do PDV, mais recente primeiro.

## 2026-09-05 (fim de tarde) — Alertas do KDS e configuração do painel

- **Painel de Pedidos**: nova opção para escolher quais produtos ou categorias aparecem no painel — cada produto tem um checkbox, com atalho "Ocultar/Mostrar todos" por categoria. Produtos ocultos somem dos tickets; se uma rodada ficar sem nenhum item visível, o ticket inteiro some.
- **Mapa de mesas**: quando um pedido fica "pronto" na cozinha, a mesa correspondente ganha um ícone de alerta pulsante — some automaticamente quando o garçom abre a comanda daquela mesa.
- Corrigido um bug em que uma atualização de "visto" no banco nunca era enviada (faltava aguardar a resposta da chamada).

## 2026-09-05 (tarde) — Itens separados, pagamento por item e ajustes de preço

- Itens iguais lançados juntos (ex: "2x Coca-Cola") agora viram linhas separadas e independentes — dá pra cancelar uma unidade sem mexer nas outras.
- Quando um item específico é pago via "Pagar selecionados", ele ganha um selo "Pago" ao lado do nome na lista.
- Corrigido o valor exibido dos itens com complemento/adicional: a linha do produto mostra só o preço base dele, e o complemento aparece separado com seu próprio valor — antes o total parecia somar em dobro.
- Logo da tela de login trocada pela logo da Three Solutions (mesma do menu).

## 2026-09-05 (manhã) — QA geral, gerente, e ajustes de mesa

- Feita uma varredura completa pelo aplicativo (todas as telas) e corrigidos os problemas encontrados, incluindo um bug real de fechamento de caixa que apontava diferença mesmo com o caixa batendo certo.
- Nova opção **"Entrar como gerente"** nas telas de escolha de acesso (tanto a pública quanto a interna), listando só os usuários com esse cargo.
- Botão **"Fechar mesa (sem consumo)"**: libera a mesa quando não há nenhum item lançado (ou tudo foi cancelado), sem precisar passar pelo fluxo de pagamento.
- Popup de seleção de complementos: preço do complemento soma no total e aparece discriminado como sub-item na conta, em vez de ser embutido no nome/preço do produto.
- Lista de autorização de cancelamento (gerente/admin) reorganizada em coluna vertical, mais fácil de ler.
- Cartões de entrada do PDV simplificados: "Garçom", "Gerente", "Administrador", sem subtítulo.

## 2026-09-04 — Cargos, redesenho visual e cadastro de cliente

- Separação de cargos: **Gerente** passa a ter acesso próprio (igual ao garçom), distinto de Administrador — login por PIN, sem precisar de e-mail.
- Tela de Usuários redesenhada, com edição de permissões na hora de convidar Garçom/Gerente.
- Cancelamento de item/pedido passa a exigir autorização de gerente ou admin (login + senha).
- Corrigido bug de mesa "juntada" não aparecer como ocupada no mapa.
- Histórico do PDV virou item próprio no menu lateral; taxa de serviço agora aparece no painel "Suas vendas hoje" do garçom.
- Capricho visual em várias telas: mapa de mesas, comanda (garçom/gerente), Caixa, Clientes, Reservas, Auditoria, Estoque, Promoções — ícone de mesa trocado por desenho custom em todo o app.
- Cardápio: renomeado de "Produtos", agrupamento por categoria, duplicar produto, campo de observação e complementos.
- Relatórios: filtro por dia específico e novo relatório de cancelamentos.
- Dashboard: filtro de intervalo de datas, taxa de serviço/desconto, mini-dashboard de venda avulsa (Ficha) e ranking de garçom por taxa de serviço.
- Autopreenchimento de dados do cliente pelo CPF ao abrir mesa; programa de fidelidade.
- Transferência de itens em lote entre mesas; opção "pagar selecionados"; volta ao mapa automaticamente após pagamento total.

## 2026-09-03 — PagBank, relatórios e redesenho

- Integração real com maquininha PagBank (PlugPag) via Bluetooth/Wi-Fi (Moderninha Pro).
- Logo trocada para Three Solutions.
- Redesenho do mapa de mesas, comanda e tela de pagamento; tickets do Painel de Pedidos (KDS) redesenhados.
- Relatório detalhado de vendas com gráfico de tendência.

## 2026-08-31 — Tela inicial e PagBank (base)

- Tela inicial ganha logo, cadastro de empresa escondido por padrão e escolha de acesso pós-login.
- Base do PagBank (PlugPag) preparada via Capacitor.

## 2026-08-30 — Construção inicial do sistema

- Projeto criado do zero: PDV multiempresa para bares, restaurantes e eventos (Vite + React + Supabase).
- Módulos base: Dashboard, Produtos/Categorias, PDV e finalização de venda, Clientes, Estoque, Caixa, Usuários/permissões, Relatórios básicos.
- Mesas e Comandas com pedidos e cozinha (KDS) — início da Fase 2: cancelar/transferir item, transferir mesa, conta e pagamento parcial, colunas Novos/Fazendo/Prontos.
- Promoções, notificações, relatórios avançados com exportação CSV/PDF, auditoria completa na UI.
- Importação de produtos via planilha; reservas com bloqueio de várias mesas; divisão de conta; histórico de caixa; comissão.
- Impressão automática de pedidos na cozinha (impressora térmica Bluetooth e Wi-Fi/ePOS-Print).
- Redesenho visual: tema branco/roxo (depois ajustado pra paleta da AppVia), menu lateral em cascata.
- Separação de acesso garçom (PIN) vs. admin.
