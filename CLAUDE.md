# CLAUDE.md — Dashboard Febracis

## Idioma
Sempre responder em **português brasileiro**.

## Stack
- **Framework**: TanStack Start (React 19 + TanStack Router) com Vite 7
- **Runtime**: Bun (produção e dev)
- **Banco**: PostgreSQL 16 direto (SEM Supabase) via Drizzle ORM
- **Auth**: better-auth (NÃO Supabase Auth)
- **UI**: Tailwind CSS v4 + Radix UI + shadcn/ui
- **Charts**: Recharts
- **Deploy**: Docker Swarm na VPS com Traefik (NÃO Cloudflare)

## Decisões Arquiteturais Importantes

### Windsor.ai — MCP, NÃO API Key
**O Windsor.ai é acessado EXCLUSIVAMENTE via MCP (Model Context Protocol) do Claude, NÃO via API key REST.**

- O projeto tem um MCP Server local em `src/server/mcp/windsor/` que wrapa a API REST do Windsor
- Para syncs automáticos (cron no container), o MCP server local usa `WINDSOR_API_KEY` do env
- Para syncs manuais e consultas ad-hoc, o Claude usa o MCP Windsor tool diretamente (`mcp__claude_ai_Windsor_ai__*`)
- **NÃO perguntar ao usuário sobre WINDSOR_API_KEY** — se precisar de dados Windsor durante desenvolvimento, usar o MCP tool do Claude
- A conta Salesforce no Windsor é `felipemelare@febracis.com.br`

### Banco de Dados
- Está na VPS dentro do Docker Swarm (container `dashboard-febracis_postgres`)
- NÃO tem Postgres local rodando nesta máquina dev (localhost:5432 não funciona)
- Para queries no banco: `docker exec -i $(docker ps -qf name=dashboard-febracis_postgres) psql -U febracis -d Postgres_Febracis`
- Migrations são SQL puro em `src/db/migrations/` via Drizzle
- `bun run db:migrate` (drizzle-kit migrate) NÃO funciona localmente (sem DB local) — aplicar migrations via docker exec

### Views Principais
- `vendas_atribuidas` — view sobre `rd_vendas` (JSONB), derivando todos os campos
- `jornada_normalizada` — depende de vendas_atribuidas
- Canal de marketing é derivado via `derive_canal_dynamic()` (função SQL)
- Canal de venda vem direto do Salesforce (`canal_venda` no JSONB)

### Filtros
- "Canal Marketing" = canal derivado (antigo "Canal")
- "Canal Venda" = campo direto do Salesforce (`canal_venda`)
- Ambos são filtros globais em `src/lib/filters.tsx`

### Build & Deploy
- Build local NÃO funciona (requer Node 20.19+, host tem Node 18)
- Build é feito dentro do Dockerfile (multi-stage com node:20-alpine + bun)
- Deploy: `docker build -t dashboard-febracis:latest . && docker service update --force dashboard-febracis_app`
- URL produção: `https://dashboard-febracis.fluq.com.br`

## Estrutura de Rotas
- `/` — Visão Geral (KPIs, receita por canal, tendência)
- `/vendas` — Tabela paginada com drilldown de jornada
- `/turmas` — Performance entre turmas
- `/geografia` — Performance por estado/cidade
- `/canais` — Breakdown por canal de marketing
- `/utms` — Análise de UTMs
- `/midia` — Mídia paga (Meta Ads, Google Ads)
- `/leads` — Leads do Salesforce
- `/admin/import` — Importação/sync manual
- `/admin/cadastros` — CRUD de produtos, contas, edições, orçamentos
- `/atribuicao` — Modelo de atribuição

## Dados Windsor — Mapeamento Salesforce
- 42 campos mapeados da planilha Salesforce (opportunity_*)
- Campos armazenados em JSONB na tabela `rd_vendas` (coluna `data`)
- View `vendas_atribuidas` expõe todos via `data->>'campo'`
- Sync: `src/server/windsor.sync.pure.ts` (oportunidades + leads)
- Ads sync: `src/server/windsor.ads.sync.ts` (Meta + Google Ads)

## Comandos Úteis
```bash
# Aplicar migration no banco:
docker exec -i $(docker ps -qf name=dashboard-febracis_postgres) psql -U febracis -d Postgres_Febracis < src/db/migrations/XXXX.sql

# Query no banco:
docker exec -i $(docker ps -qf name=dashboard-febracis_postgres) psql -U febracis -d Postgres_Febracis -c "SELECT ..."

# Rebuild + deploy:
docker build -t dashboard-febracis:latest . && docker service update --force dashboard-febracis_app

# Logs:
docker service logs -f dashboard-febracis_app --tail 50
```
