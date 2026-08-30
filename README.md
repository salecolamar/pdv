# PDV — sistema de vendas para bares, restaurantes e eventos

Diferente dos outros apps da pasta (Balcão, barbearia-saas, lavajato…), este é **multiempresa**: um único deploy (um projeto Supabase + um projeto Vercel) atende todos os clientes ao mesmo tempo. Cada empresa só enxerga os próprios dados por causa das políticas de segurança do banco (Row Level Security) — não porque tem um banco separado.

Ver [o plano completo do projeto](../../.claude/plans/virtual-popping-castle.md) pra contexto de arquitetura, escopo do MVP e dos módulos futuros.

## 1. Configurar o Supabase (uma vez só, vale pra todos os clientes)

1. Crie uma conta/projeto grátis em **supabase.com** → **New project**.
2. **SQL Editor** → **New query** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) inteiro → **Run**. Isso cria todas as tabelas do MVP e as regras de isolamento por empresa.
3. **Authentication → Providers → Email** → desative **"Confirm email"**. Sem isso, todo cadastro fica esperando confirmação por e-mail antes de poder logar — não queremos isso ainda no MVP.
4. **Settings → API** → copie a **Project URL** e a chave **anon public**.

## 2. Configurar o projeto localmente

Crie um arquivo `.env.local` na raiz com:
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

```bash
npm install
npm run dev
```

## 3. Deploy (Vercel)

Um projeto só na Vercel pra sempre (não é "um por cliente" como nos outros apps):
1. **Add New → Project** → importe este repositório.
2. Framework Preset = **Vite**.
3. Environment Variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (os mesmos do passo 1.4).
4. Deploy.

## Como funciona o cadastro de cliente novo

Não existe mais "criar projeto Firebase + projeto Vercel por cliente". Um cliente novo é só abrir o app e usar a aba **"Criar empresa"** — vira automaticamente o administrador daquela empresa, isolada de todas as outras pelo banco.

## Status

MVP em construção seguindo a ordem do plano: Login + cadastro de empresa (pronto) → Dashboard → Produtos/Categorias → PDV → Finalização da venda → Clientes → Estoque → Caixa → Usuários e permissões → Relatórios básicos.
