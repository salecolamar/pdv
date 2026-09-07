# Telas do PDV

Glossário de nomes pra facilitar a comunicação — quando eu (Claude) ou você citar
uma tela por esse nome, é esse o arquivo/componente por trás.

## Login e acesso (antes de entrar no sistema)

| Nome da tela | Arquivo | Descrição |
|---|---|---|
| **Tela de escolha de acesso** | `AcessoEmpresa.jsx` (componente `AcessoEmpresa`) | "Como você quer entrar?" — 3 cartões: Garçom, Gerente, Administrador |
| **Tela de login do admin** | `App.jsx` (`FormularioEntrar`) | E-mail e senha |
| **Tela de entrar (garçom/gerente)** | `AcessoEmpresa.jsx` (componente `AcessoGarcom`) | Seção "Caixa do dia" + lista em cascata de nomes pra PIN |
| **Modal de abrir/fechar caixa** | `AcessoEmpresa.jsx` (`AcaoCaixaModal`) | Autorização por senha/PIN de gerente ou admin |

## Menu do Administrador (`Shell.jsx`)

| Nome da tela (label no menu) | Arquivo |
|---|---|
| **Dashboard** | `Dashboard.jsx` |
| **Caixa** | `Caixa.jsx` |
| **Cardápio** | `Produtos.jsx` (produtos, categorias, complementos) e `Cardapios.jsx` |
| **Mapa de Mesas** (cadastro) | `PosPago.jsx` |
| **Painel de Pedidos** (KDS/cozinha) | `Cozinha.jsx` |
| **Reservas** | `Reservas.jsx` |
| **Clientes** | `Clientes.jsx` |
| **Usuários** | `Usuarios.jsx` |
| **Relatórios** | `Relatorios.jsx` |
| **Auditoria** | `Auditoria.jsx` |
| **Estoque** | `Estoque.jsx` (aba dentro de Produtos) |
| **Promoções** | `Promocoes.jsx` (aba dentro de Produtos) |
| **Configurações** | `Configuracoes.jsx` |
| **Suporte** (chat com IA) | `Ajuda.jsx` |
| **Notificações** (sino do topo) | `Notificacoes.jsx` |

## Menu do Garçom/Gerente (`Shell.jsx`, mesmo componente, menos abas)

| Nome da tela | Arquivo |
|---|---|
| **PDV / Mapa de mesas do garçom** | `Mesas.jsx` (componente `Mesas`) — abas "Mesa" e "Ficha" |
| **Ficha** (venda avulsa/balcão) | `Mesas.jsx` (componente `Pdv`, importado de `Pdv.jsx`) |
| **Comanda** (tela da mesa aberta) | `Mesas.jsx` (componente `Comanda`) |
| **Lançar itens** (cardápio pra adicionar na comanda) | `Mesas.jsx` (componente `LancarItens`) |
| **Conta da mesa** (extrato pra imprimir) | `Mesas.jsx` (componente `ContaMesa`) |
| **Histórico do PDV** | `Mesas.jsx` (componente `HistoricoPDV`) |
| **Painel de Pedidos** (mesmo do admin) | `Cozinha.jsx` |
| **Reservas** | `Reservas.jsx` |
| **Tela-portão do caixa** ("Caixa aberto, Entrar" / bloqueio sem caixa) | `Shell.jsx` |

## Convenção

- Nomes em **negrito** são os que aparecem de verdade pro usuário (label do menu, título da tela).
- Quando um arquivo tem mais de uma "tela" dentro (ex: `Mesas.jsx` tem Mapa, Comanda, Lançar itens, Conta, Ficha, Histórico), listei os componentes internos pra apontar o trecho certo.
- Esse arquivo é pra facilitar a nossa conversa — não precisa manter 100% atualizado a cada mudança pequena, só quando surgir uma tela nova ou um nome confuso.
