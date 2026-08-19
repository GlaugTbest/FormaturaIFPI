# Status do projeto — Sistema da Comissão de Formatura (Financeiro + Rifas)

> Documento de handoff. Escrito para que qualquer pessoa (ou uma nova sessão do
> Claude) consiga entender o que já existe, por que foi feito assim, e o que
> falta, sem precisar reconstruir esse contexto do zero.

**Última atualização:** 2026-08-19
**Estado:** 6 de 9 fases concluídas e verificadas contra o banco real. Fase 7
(Documentos) iniciada (apenas o `DriveService` abstrato existe ainda, sem
UI). Fases 8 e 9 não iniciadas.

---

## 1. O que é o projeto

Sistema web para uma comissão de formatura controlar:
- **Financeiro**: receitas, despesas, categorias, fornecedores, auditoria de
  alterações.
- **Rifas**: criação de rifas, geração automática de números, reserva
  temporária, venda (autoatendimento público ou assistida por vendedor),
  cancelamento auditado, comprovantes de pagamento.

Dois ambientes: área administrativa (`/admin/*`, autenticada, com papéis
ADMIN/VENDEDOR/VISUALIZADOR) e área pública da rifa (`/rifas/*`, sem login,
qualquer pessoa pode escolher números e comprar).

**Documento original com a especificação completa (92 seções)**: foi dado
pelo usuário no início da conversa, não está salvo em arquivo — só existe no
histórico do chat que gerou este projeto. Resumo do que importa está aqui
neste documento; o plano de implementação que eu segui está em
`C:\Users\User\.claude\plans\squishy-zooming-spindle.md` (só existe na
máquina local, não faz parte do repositório).

---

## 2. Stack e decisões arquiteturais

- **Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + shadcn/ui**
  — mas atenção: o registry do shadcn usado aqui é baseado em **Base UI**
  (`@base-ui/react`), não Radix. Isso importa porque os componentes usam
  `render={<Componente />}` em vez de `asChild`, e `Button` tem uma prop
  `nativeButton` que precisa ser `false` quando ele renderiza como
  `<Link>` (ver `components/ui/link-button.tsx` — sempre usar esse wrapper
  em vez de `<Button render={<Link .../>}>` direto, um bug real de
  acessibilidade já foi encontrado e corrigido por causa disso).
- **Supabase** (Postgres 17 + Auth + Storage) como backend único. Projeto
  real já linkado: `ekdbiofodxxwnlimazop` (região us-east-2).
- **Dinheiro sempre em centavos** (`bigint`), nunca float. Ver `lib/money.ts`
  (`centsToBRL`, `brlStringToCents` — este último faz parsing de string
  decimal sem multiplicação de float, para não arredondar errado).
- **Regras de negócio críticas vivem no Postgres**, não no Next.js — todas as
  operações de reserva/venda/cancelamento de números da rifa e edição/exclusão
  financeira passam por funções `SECURITY DEFINER` (RPCs), nunca por
  UPDATE/DELETE direto do cliente. Ver seção 4.
- **RBAC simplificado**: enum `user_role` (`ADMIN`, `VENDEDOR`,
  `VISUALIZADOR`) direto em `profiles.role`, sem tabelas genéricas de
  permissão — decisão deliberada de simplicidade, documentada no plano.
- **Google Drive**: **não configurado ainda, de propósito** (o usuário pediu
  para pausar essa parte). Existe uma abstração `DriveService`
  (`lib/services/drive.ts`) com uma implementação "não configurada" que
  lança um erro claro em vez de fingir sucesso. Todos os uploads (comprovante
  PIX) hoje vão para um bucket privado do **Supabase Storage** (`attachments`)
  e ficam lá até alguém plugar as credenciais do Google.

---

## 3. Credenciais e segurança

- Credenciais reais do Supabase (URL, publishable key, secret key) e um
  Personal Access Token do Supabase CLI estão em `.env.local` **na máquina
  local** — esse arquivo está no `.gitignore` e **nunca foi commitado**.
- `.env.example` documenta todas as variáveis necessárias (sem valores) e
  **está commitado** — usar como referência para configurar um ambiente novo.
- Existe uma conta ADMIN de teste no banco: `admin@teste.local` (criada via
  `scripts/create-admin-user.mjs`, que também serve para criar a primeira
  conta admin real quando for para produção). A senha temporária foi gerada
  uma vez e mostrada no chat, não está salva em nenhum arquivo — se precisar
  logar como esse usuário, rode o script de novo com um novo e-mail, ou use
  "Esqueci minha senha" depois de configurar o envio de e-mail do Supabase
  Auth.
- **Google Drive**: nenhuma credencial foi configurada. Quando for a hora,
  preencher `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  e os `GOOGLE_DRIVE_*_FOLDER_ID` em `.env.local` (nunca em `NEXT_PUBLIC_*`).

---

## 4. O que já está pronto (fases 1–6)

Cada fase abaixo foi **verificada de verdade** — não só escrita e assumida
correta. Isso incluiu rodar migrations contra o banco remoto real, testes de
integração automatizados (Vitest) fazendo requisições concorrentes reais, e
sessões de QA manual num navegador de verdade (via MCP preview) clicando nos
fluxos, incluindo inspecionar o banco antes/depois de cada ação.

### Fase 1 — Schema, RLS, RPCs de concorrência
Migrations em `supabase/migrations/` (nomeadas por timestamp, aplicadas em
ordem). Tabelas principais: `profiles`, `raffles`, `raffle_points`, `buyers`,
`raffle_sales`, `raffle_sale_points`, `payment_records`, `payment_methods`,
`financial_transactions`, `financial_categories`, `suppliers`, `attachments`,
`audit_logs`, `system_settings`.

RLS habilitado em **todas** as tabelas desde o início. `raffle_points` não
tem nenhuma policy de INSERT/UPDATE/DELETE para nenhum papel — a única forma
de mudar o status de um número é através das RPCs abaixo.

RPCs críticas (todas `SECURITY DEFINER`):
- `rpc_reserve_points` — `UPDATE ... WHERE status='AVAILABLE'` atômico. Se
  qualquer número pedido não estiver disponível, a exceção desfaz toda a
  reserva (nada fica parcialmente reservado).
- `rpc_confirm_sale` — confirma a venda, é **idempotente** via
  `idempotency_key` (chave única), revalida a expiração da reserva na hora
  (não confia só no status), retorna um **recibo em jsonb** (não só o id —
  ver por quê na seção de bugs abaixo).
- `rpc_cancel_sale`, `rpc_close_raffle`, `rpc_cancel_raffle` — admin-only,
  sempre pedem motivo, sempre geram `audit_logs`.
- `rpc_release_expired_reservations` — rodada a cada minuto via **pg_cron**
  (job `release-expired-raffle-reservations`), libera reservas expiradas.
- `rpc_update_financial_transaction` / `rpc_delete_financial_transaction` —
  edição/exclusão financeira sempre exige motivo e sempre audita
  (old/new value via trigger `financial_transactions_audit`).

Testes de integração: `tests/integration/concurrency.test.ts` e
`tests/integration/cancellation.test.ts` (rodam contra o banco real, criam e
apagam sua própria rifa de teste). Rodar com `npm run test:integration`.

**Três bugs reais encontrados e corrigidos só porque havia testes/QA real:**
1. Coluna ambígua em `rpc_reserve_points` (o parâmetro de retorno tinha o
   mesmo nome de uma coluna da tabela) — toda reserva falhava.
2. `SELECT array_agg() ... FOR UPDATE` não é permitido pelo Postgres — tinha
   que separar em CTE de lock + agregação por fora.
3. **Bug de segurança sério**: `is_admin()`/`is_vendedor_or_admin()`
   comparavam um valor que podia ser `NULL` com `=`, o que retorna `NULL`
   (não `false`). Em RLS isso é seguro (`NULL` = deny), mas dentro de
   `IF NOT is_admin() THEN RAISE EXCEPTION` do PL/pgSQL, uma condição `NULL`
   é tratada como "não verdadeira, pule o bloco" — ou seja, **um usuário
   anônimo conseguia cancelar uma venda de verdade**, confirmado por teste.
   Corrigido envolvendo os dois helpers em `COALESCE(..., false)`. Ver
   migration `20260819092000_fix_null_boolean_authz_bypass.sql`.

Além disso: `rpc_cancel_sale` tinha uma expressão `CASE` sem cast explícito
pro enum `point_status` (Postgres não inferia o tipo nesse contexto) — todo
cancelamento falhava até isso ser corrigido. E `audit_logs.user_id` não
tinha `ON DELETE SET NULL`, o que bloqueava apagar um usuário (ou uma conta
de teste) por causa do histórico de auditoria — corrigido.

### Fase 2 — Auth, RBAC, layout admin/público
- Login, logout, recuperação de senha, fluxo de "definir senha" (para
  convites), tudo em `app/login/`, `app/esqueci-minha-senha/`,
  `app/auth/`.
- `proxy.ts` (nome novo do `middleware.ts` no Next 16) bloqueia
  `/admin/*` para não-autenticados e para contas desativadas, redireciona
  quem já está logado para longe de `/login`.
- Layout admin (`app/admin/layout.tsx` + `app/admin/_components/admin-shell.tsx`):
  sidebar desktop, menu mobile (Sheet), navegação por papel
  (`app/admin/nav-config.ts` — adicionar itens de menu aqui conforme cada
  seção nova for construída).
- `scripts/create-admin-user.mjs` — bootstrap do primeiro admin.

### Fase 3 — Gestão de rifas (admin)
`app/admin/rifas/` — criar/editar rifa (`raffle-form.tsx`, compartilhado),
geração automática de números via trigger no banco, grid de números com
filtro/paginação/busca (`[id]/numeros/page.tsx`), encerrar/cancelar rifa
(`[id]/raffle-actions.tsx`).

### Fase 4 — Fluxo público de compra + vendas/compradores no admin
- `app/rifas/` — listagem pública, página da rifa com SEO
  (`generateMetadata`), grid de números paginado (`number-grid.tsx`),
  fluxo de compra completo (`purchase-flow.tsx`): seleção → reserva com
  cronômetro (retomável entre reloads via `sessionStorage`) → formulário do
  comprador → forma de pagamento (PIX exige upload real validado
  server-side; dinheiro exige um checkbox de confirmação) → confirmação
  idempotente → tela de recibo.
- `app/api/uploads/comprovante/route.ts` — valida o arquivo de verdade
  (magic bytes, não só o MIME que o navegador diz), tamanho máximo, salva no
  Storage privado, insere a linha em `attachments`.
- `app/admin/rifas/[id]/vendas/` — lista de vendas por rifa, cancelamento
  auditado (admin only).
- `app/admin/compradores/` — busca por nome/telefone/whatsapp ou número
  comprado.

### Fase 5 — (mesclada com a 4 na prática — fluxo público + vendas foram
construídos e testados juntos, ver commits).

### Fase 6 — Financeiro
`app/admin/financeiro/` — visão geral (saldo, receitas/despesas do mês,
resultado — tudo calculado por agregação, nunca guardado manualmente),
`receitas/`, `despesas/` (com fornecedor auto-criado por nome),
`categorias/`. Edição e exclusão sempre pedem motivo e sempre auditam
(verificado: editei um valor, motivo apareceu em `audit_logs` com
old/new value; excluí um lançamento, ele sumiu da lista mas continua no
banco com `deleted_at` preenchido).

---

## 5. O que falta (fases 7, 8, 9)

### Fase 7 — Documentos (EM ANDAMENTO, quase nada feito ainda)
Só existe `lib/services/drive.ts` (a abstração `DriveService` +
`UnconfiguredDriveProvider` + `DriveNotConfiguredError`). **Falta:**
- Rota de upload genérica para documentos administrativos (nota fiscal,
  contrato, orçamento, recibo, etc.), parecida com
  `/api/uploads/comprovante` mas para uso autenticado (admin), não público.
- Página `/admin/documentos` — listar todos os anexos do sistema (com
  filtro por tipo/kind, status PENDING/UPLOADING/UPLOADED/FAILED), permitir
  associar a uma rifa ou lançamento financeiro, download/visualização.
- Item de menu "Documentos" em `app/admin/nav-config.ts`.
- Quando as credenciais do Google chegarem: implementar de fato a classe
  `GoogleDriveService` dentro de `lib/services/drive.ts` (o comentário
  `TODO(google-drive)` já está lá explicando o que fazer — usar
  `googleapis`/`google-auth-library`, autenticar via JWT de service account).

### Fase 8 — Dashboards, relatórios, exportações, auditoria, configurações, usuários, seed
Nada disso foi construído ainda. Ordem sugerida:
1. **Dashboard principal** (`/admin/dashboard` hoje é só um placeholder) —
   saldo, rifas ativas, vendas recentes, despesas recentes, atividade
   recente (puxando de `audit_logs`).
2. **Relatório de vendas** — tabela com filtro por comprador/vendedor/
   número/data/forma de pagamento/status/rifa, paginação, ordenação,
   exportação CSV/XLSX (já tem `exceljs` instalado) e PDF
   (`@react-pdf/renderer` já instalado, ainda não usado em lugar nenhum).
3. **Tela de auditoria** (`/admin/auditoria`) — admin-only, ler
   `audit_logs` com filtros.
4. **Configurações** (`/admin/configuracoes`) — usar a tabela
   `system_settings` (key/value jsonb) já existente: nome da formatura,
   curso/turma, limites de upload (hoje hardcoded em `lib/uploads.ts`),
   prazo de reserva (hoje hardcoded como 15min default em
   `rpc_reserve_points`), etc.
5. **Gestão de usuários** (`/admin/usuarios`) — convidar/desativar/mudar
   papel. Usar `supabase.auth.admin.inviteUserByEmail` ou `createUser` (ver
   `scripts/create-admin-user.mjs` como referência de como chamar a Admin
   API) a partir de uma Server Action, nunca do cliente.
6. **Seed de demonstração** — dados fictícios realistas (não "John Doe"/
   "Lorem ipsum") para apresentar o sistema: uma rifa, alguns compradores,
   vendas, lançamentos financeiros. Colocar em `supabase/seed.sql` (dev
   only, não confundir com as migrations de seed operacional que já existem
   — `20260819080700_operational_seed_data.sql` — essas são categorias e
   formas de pagamento reais, não dados fake).

### Fase 9 — Testes + README
- Mais testes críticos: RBAC em cada RPC (vendedor não pode fazer ação de
  admin — já tem um caso disso em `cancellation.test.ts`, faltam os outros),
  upload inválido é rejeitado, idempotência sob mais cenários.
- **README.md** completo (visão geral, stack, arquitetura, instalação,
  variáveis de ambiente, setup do Supabase, migrations, seed, configuração
  de Auth, configuração do Drive quando chegar a hora, execução local,
  testes, deploy, troubleshooting). Ainda não existe — o `README.md` atual
  é o placeholder que o `create-next-app` gerou.

---

## 6. Como continuar

### Rodar localmente
```powershell
npm install
npm run dev
```
Precisa de `.env.local` preenchido (ver `.env.example`). As credenciais do
Supabase já existem — pedir para o dono do projeto ou olhar no dashboard do
Supabase (projeto `ekdbiofodxxwnlimazop`).

### Aplicar migrations novas
```powershell
$env:SUPABASE_ACCESS_TOKEN = "<personal access token>"  # supabase.com/dashboard/account/tokens
npx supabase db push --linked --yes
npm run db:types  # regenerar types/database.ts depois de QUALQUER mudança de schema
```

### Rodar os testes
```powershell
npm run test:integration   # bate no banco real, cria/apaga seus próprios dados
npm run typecheck
npm run lint
npm run build
```

### Regra de ouro para continuar
Antes de marcar qualquer coisa como "pronta": rodar `typecheck` + `lint` +
`build`, e sempre que a mudança envolver uma RPC ou fluxo de
concorrência/dinheiro, testar de verdade (subir o dev server, ou escrever um
teste de integração) — não confiar em "parece certo pela leitura do código".
Duas das correções mais importantes desse projeto (o bug de autorização com
NULL, e o cast de enum quebrado) só foram descobertas porque algo foi
realmente executado, não porque alguém releu o SQL.
