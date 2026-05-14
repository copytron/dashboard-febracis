# Plano de Refatoração: Lovable → VPS Node.js + Postgres Direto

## Contexto

O projeto foi construído na Lovable, que impõe Supabase como backend e Cloudflare como deploy. O objetivo é migrar para **VPS própria** com:
- **Node.js** como servidor (via Nitro/TanStack Start)
- **PostgreSQL direto** da VPS (sem Supabase como intermediário)
- **Windsor.ai** como fonte de dados (substituindo importação de CSVs)

---

## Fase 1 — Desacoplar da Lovable e Cloudflare

### 1.1 Reescrever `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),  // DEVE vir DEPOIS de tanstackStart()
  ],
  resolve: {
    tsconfigPaths: true,  // Vite 7 nativo — substitui vite-tsconfig-paths
  },
});
```

### 1.2 Atualizar `package.json`

- **Renomear** `"name"` → `"dashboard-febracis"`
- **Adicionar** `"nitro"` em dependencies
- **Remover**: `@lovable.dev/vite-tanstack-config`, `@cloudflare/vite-plugin`, `vite-tsconfig-paths`
- **Mover** `@tanstack/router-plugin` → devDependencies
- **Scripts**:
  ```json
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
  ```

### 1.3 Deletar `wrangler.jsonc`

Não é usado fora do Cloudflare.

### 1.4 Proteger secrets

O `.env` está commitado em **repo público** com chaves reais do Supabase.

1. Adicionar `.env` ao `.gitignore`
2. Criar `.env.example` com placeholders
3. `git rm --cached .env`
4. **Rotacionar as chaves no Supabase**

### 1.5 Deletar `.lovable/`

### 1.6 Reinstalar dependências

```bash
rm bun.lockb && bun install
```

---

## Fase 2 — Criar PostgreSQL dedicado + migrar do Supabase

### 2.1 Criar database separado na VPS

Criar um database dedicado no Postgres da VPS, isolado de outros projetos:

```sql
-- Conectar como superuser (postgres)
CREATE USER Postgres_Febracis WITH PASSWORD '<SENHA_POSTGRES>';
CREATE DATABASE Postgres_Febracis OWNER Postgres_Febracis;

-- Conectar no novo database
\c Postgres_Febracis

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**Connection string para o `.env`:**
```
DATABASE_URL="postgresql://Postgres_Febracis:<SENHA_POSTGRES>@localhost:5432/Postgres_Febracis"
```

### 2.2 Criar schema (tabelas do Supabase → Postgres local)

Tabelas principais a criar (baseado no schema atual do Supabase):

```sql
-- Pessoas / Auth
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Core: Vendas e Leads
CREATE TABLE fct_venda (
  venda_id TEXT PRIMARY KEY,
  nome TEXT,
  email TEXT,
  celular TEXT,
  turma TEXT,
  curso TEXT,
  valor NUMERIC,
  valor_convertido NUMERIC,
  estado TEXT,
  cidade TEXT,
  canal_venda TEXT,
  fase TEXT,
  promocao TEXT,
  pacote TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  utm_gclid TEXT,
  origem_lead TEXT,
  ultima_origem_lead TEXT,
  data_criacao TIMESTAMPTZ,
  data_aprovacao DATE,
  data_matricula DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fct_lead (
  lead_id TEXT PRIMARY KEY,
  nome TEXT,
  email TEXT,
  celular TEXT,
  estado TEXT,
  cidade TEXT,
  status TEXT,
  origem TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  url_cadastro TEXT,
  data_criacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dim_pessoa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  telefone TEXT,
  nome TEXT,
  cidade TEXT,
  estado TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Atribuição
CREATE TABLE bridge_lead_venda (
  id SERIAL PRIMARY KEY,
  lead_id TEXT REFERENCES fct_lead(lead_id),
  venda_id TEXT REFERENCES fct_venda(venda_id),
  match_method TEXT NOT NULL,
  match_score NUMERIC NOT NULL,
  is_pre_sale BOOLEAN NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  match_lag_days INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Qualidade de dados
CREATE TABLE dq_findings (
  id SERIAL PRIMARY KEY,
  entity TEXT,
  entity_id TEXT,
  rule TEXT,
  severity TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dq_resolutions (
  id SERIAL PRIMARY KEY,
  finding_id INT REFERENCES dq_findings(id),
  action TEXT,
  resolved_at TIMESTAMPTZ DEFAULT now()
);

-- Cadastros
CREATE TABLE produtos (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE contas (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome_conta TEXT, produto_principal_id UUID REFERENCES produtos(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE edicoes (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE orcamentos (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE regras_classificacao (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, created_at TIMESTAMPTZ DEFAULT now());

-- Pipeline
CREATE TABLE meta_pipeline (id SERIAL PRIMARY KEY, status TEXT, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, details JSONB);
CREATE TABLE planilha_imports (id SERIAL PRIMARY KEY, tipo TEXT, url TEXT, status TEXT, total_rows INT, imported_rows INT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE planilha_leads (id SERIAL PRIMARY KEY, import_id INT REFERENCES planilha_imports(id), data JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE rd_vendas (id SERIAL PRIMARY KEY, import_id INT REFERENCES planilha_imports(id), data JSONB, created_at TIMESTAMPTZ DEFAULT now());

-- BI Workspaces
CREATE TABLE workspaces (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE workspace_members (id SERIAL PRIMARY KEY, workspace_id UUID REFERENCES workspaces(id), user_id UUID REFERENCES profiles(id), role TEXT DEFAULT 'editor');
CREATE TABLE ds_sources (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), workspace_id UUID REFERENCES workspaces(id), name TEXT, type TEXT, config JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE ds_columns (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), source_id UUID REFERENCES ds_sources(id), name TEXT, type TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE ds_rows (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), source_id UUID REFERENCES ds_sources(id), data JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE data_models (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), workspace_id UUID REFERENCES workspaces(id), name TEXT, config JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE model_nodes (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), model_id UUID REFERENCES data_models(id), source_id UUID REFERENCES ds_sources(id), position JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE relationships (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), model_id UUID REFERENCES data_models(id), config JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE relationship_columns (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), relationship_id UUID REFERENCES relationships(id), config JSONB, created_at TIMESTAMPTZ DEFAULT now());

-- Views materializadas (recriadas pelo pipeline)
-- vendas_atribuidas, jornada_normalizada, sem_atribuicao, v_gaps
-- Serão criadas pelas funções do pipeline (rebuild_core)
```

### 2.3 Migrar dados do Supabase → Postgres local

```bash
# Exportar do Supabase (via pg_dump remoto ou CSV)
pg_dump --data-only --table=fct_venda --table=fct_lead --table=bridge_lead_venda \
  --table=dim_pessoa --table=dq_findings \
  "postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres" \
  > supabase_export.sql

# Importar no Postgres local
psql Postgres_Febracis < supabase_export.sql
```

Alternativa: usar Windsor.ai para popular vendas e leads diretamente (Fase 3).

### 2.4 Escopo da refatoração de código

Hoje o app usa `@supabase/supabase-js` para **tudo**: queries, RPCs e auth. Isso precisa ser substituído por conexão direta ao Postgres.

**Decisões definidas:**
- [x] **Camada de acesso: Drizzle ORM** — migrations SQL puras (portáveis para qualquer Postgres), zero binário nativo, type-safe
- [x] **Autenticação: better-auth** — auth 100% no próprio Postgres (users, sessions), adaptador Drizzle nativo, sem vendor lock-in

**Dependências a instalar:**
```bash
bun add drizzle-orm postgres better-auth
bun add -d drizzle-kit
```

**Portabilidade entre VPS:** tudo viaja no banco — `pg_dump` exporta dados + auth, `psql` importa na nova VPS, troca `DATABASE_URL` no `.env` e pronto.

### 2.2 Arquivos que usam Supabase (todos precisam ser refatorados)

**Integração — substituir `src/integrations/supabase/` por:**
- `src/db/schema.ts` — schema Drizzle (tabelas, relações, tipos)
- `src/db/client.ts` — conexão Postgres via `postgres` driver + Drizzle
- `src/db/migrations/` — migrations SQL geradas por `drizzle-kit`
- `drizzle.config.ts` — config do Drizzle Kit (na raiz)

**Auth — substituir Supabase Auth por better-auth:**
- `src/lib/auth.ts` — config better-auth server (Drizzle adapter, email/password)
- `src/lib/auth-client.ts` — client better-auth para o browser
- `src/lib/auth-context.tsx` — refatorar para usar better-auth (sessão via cookie)
- `src/routes/login.tsx` — refatorar para `authClient.signIn.email()`
- `src/routes/conta.tsx` — refatorar para `authClient.changePassword()`

**Middleware — substituir JWT do Supabase por sessão better-auth:**
- `src/integrations/supabase/auth-middleware.ts` → `src/server/auth-middleware.ts`
- `src/integrations/supabase/server-fn-auth.ts` → removido (better-auth usa cookies, não precisa injetar header)

**Deletar:**
- `src/integrations/supabase/` — diretório inteiro (client.ts, client.server.ts, auth-middleware.ts, server-fn-auth.ts, types.ts)

**Rotas com queries:**
- `src/routes/index.tsx` — overview
- `src/routes/vendas.tsx` — vendas + RPCs
- `src/routes/canais.tsx` — canais + RPCs
- `src/routes/turmas.tsx` — turmas
- `src/routes/geografia.tsx` — geografia
- `src/routes/utms.tsx` — UTMs
- `src/routes/auditoria.tsx` — RPCs de DQ
- `src/routes/admin.cadastros.tsx` — CRUD
- `src/routes/admin.import.tsx` — importação
- `src/routes/app.workspaces.tsx` — workspaces
- `src/routes/app.w.$wid.sources.tsx` — fontes
- `src/routes/app.w.$wid.model.tsx` — modelo + RPCs
- `src/routes/modelo.tsx` — RPCs (query builder, exec SQL)

**Server functions:**
- `src/server/import.functions.ts` — importação com Supabase admin

### 2.3 RPCs do Supabase → queries SQL ou funções Postgres

| RPC | Uso |
|---|---|
| `get_vendas_agg` | Agregação de vendas com filtros |
| `get_canais_breakdown` | Breakdown por canal |
| `get_pipeline_status` | Status do pipeline |
| `get_dq_summary` | Resumo de qualidade de dados |
| `get_dq_findings` | Findings detalhados |
| `get_match_breakdown` | Análise de matching |
| `get_attribution_breakdown` | Análise de atribuição |
| `rebuild_core` | Reprocessa pipeline |
| `import_sheet` | Importação de planilha |
| `query_builder` / `query_builder_meta` | BI ad-hoc |
| `exec_read_sql` | Execução de SQL (admin) |
| `validate_relationship` | Validação de relações |

---

## Fase 3 — Windsor.ai como fonte de dados

### 3.1 Por que Windsor.ai?

O conector **Salesforce** do Windsor.ai é a **mesma fonte dos CSVs** — dados de vendas e leads vêm do Salesforce da Febracis. Isso elimina importação manual de planilhas.

Conectores ativos:
- **Salesforce** (`felipemelare@febracis.com.br`) — vendas e leads
- **Meta Ads** (`CDT - Método CIS Oficial`) — performance de campanhas Facebook/Instagram
- **Google Ads** (`Febracis - Institucional` + `Febracis BR - Método C`) — performance Google

### 3.2 Mapeamento Salesforce → Tabela de Vendas

| Campo no dashboard | Windsor.ai field |
|---|---|
| Nome da venda | `opportunity_name` |
| Lead de origem | `opportunity_leadorigem__c` |
| Curso | `opportunity_nomecurso__c` |
| Valor (convertido) | `opportunity_valorfinal__c` |
| Nome do cliente | `opportunity_nome__c` |
| Email | `opportunity_clienteemail__c` |
| Celular | `opportunity_clientecelular__c` |
| Estado | `opportunity_clienteestado__c` |
| Cidade | `opportunity_clientecidade__c` |
| Turma | `opportunity_turma__c` |
| UTM Source | `opportunity_utm_source__c` |
| UTM Medium | `opportunity_utm_medium__c` |
| UTM Campaign | `opportunity_utm_campaign__c` |
| UTM Content | `opportunity_utm_content__c` |
| UTM Term | `opportunity_utm_term__c` |
| Origem do lead | `opportunity_lead_source` |
| Última Origem do Lead | `opportunity_ultimaorigemlead__c` |
| Canal da Venda | `opportunity_canal_venda__c` |
| Fase | `opportunity_stage_name` |
| Data de criação | `opportunity_createddate` |
| Data de Aprovação | `opportunity_data_de_aprova_o__c` |
| Data da Matrícula | `opportunity_close_date` |
| ID da venda | `opportunity_id` |
| Promoção | `opportunity_promocoes__c` |
| Pacote do Aluno | `opportunity_pacote_comp__c` |

### 3.3 Mapeamento Salesforce → Tabela de Leads

| Campo no dashboard | Windsor.ai field |
|---|---|
| Sobrenome | `lead_last_name` |
| Celular | `lead_celular__c` |
| Email | `lead_email` |
| UTM Origem | `lead_utm_source__c` |
| UTM Mídia | `lead_utm_medium__c` |
| UTM Campanha | `lead_utm_campaign__c` |
| UTM Conteúdo | `lead_utm_content__c` |
| UTM Termo | `lead_utm_term__c` |
| URL de cadastro | `lead_page_url__c` |
| Id do lead | `lead_id` / `lead_idlead__c` |
| Status do lead | `lead_status` |
| Origem do lead | `lead_lead_source` |
| Data de criação | `lead_createddate` |
| Estado | `lead_estado__c` |
| Cidade | `lead_cidade_de_resid_ncia__c` |

### 3.4 Campos de Mídia Paga (dados novos — não existem nos CSVs)

**Meta Ads:**
`date`, `campaign`, `campaign_id`, `adset_name`, `adset_id`, `ad_name`, `ad_id`, `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `reach`, `actions_offsite_conversion_fb_pixel_lead`, `cost_per_action_type_lead`, `url_tags`, `publisher_platform`

**Google Ads:**
`date`, `campaign_name`, `campaign_id`, `ad_group_name`, `ad_group_id`, `ad_name`, `ad_id`, `keyword_text`, `spend`, `impressions`, `clicks`, `ctr`, `average_cpc`, `conversions`, `cost_per_conversion`, `gclid`, `tracking_url_template`

### 3.5 Implementação da integração Windsor.ai

1. Criar server functions que chamam a API Windsor.ai para buscar vendas, leads e dados de mídia
2. Inserir no Postgres local (sync periódico ou on-demand)
3. Substituir a importação manual de CSV (`/admin/import`) por sync com Windsor.ai
4. Adicionar página de performance de mídia paga (dados Meta + Google Ads)

---

## Verificação

```bash
bun install          # sem erros
bun dev              # dev server em localhost:3000
bun build            # build → .output/server/index.mjs
bun start            # servidor Node.js funciona
```

**Teste manual:**
1. Login funciona
2. Dashboard carrega KPIs e gráficos
3. Filtros globais funcionam
4. `/vendas` — tabela + drilldown de jornada
5. `/admin/import` — sync com Windsor.ai funciona
6. `bun build && bun start` — produção sem erros

**Produção na VPS:**
```bash
bun build
NODE_ENV=production node .output/server/index.mjs
# ou com PM2:
pm2 start .output/server/index.mjs --name dashboard-febracis
```

---

## Riscos

1. **Secrets expostas** — `.env` com chaves reais em repo público. Rotacionar no Supabase após migração.
2. **Node.js mínimo** — TanStack Start requer **Node.js 20.19+** ou **22.12+**.
3. **Volume de dados** — Salesforce tem ~4.500 vendas e ~137.000 leads. Sync inicial pode levar alguns minutos.

---

## Resumo das mudanças

| Item | Antes (Lovable) | Depois (VPS) |
|---|---|---|
| Vite config | `@lovable.dev/vite-tanstack-config` | Config explícita com plugins |
| Servidor | Cloudflare Workers | Node.js via Nitro |
| Banco | Supabase (API REST) | PostgreSQL direto na VPS |
| Auth | Supabase Auth | better-auth (sessões no Postgres) |
| Fonte de dados | CSV importado manualmente | Windsor.ai (Salesforce + Meta + Google Ads) |
| ORM/Driver | `@supabase/supabase-js` | Drizzle ORM + `postgres` driver |
| `.lovable/` | presente | deletado |
| `wrangler.jsonc` | presente | deletado |
| `.env` | commitado | `.gitignore` + `.env.example` |
