import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  serial,
  timestamp,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Auth (better-auth usa estas tabelas automaticamente)
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Core: Vendas e Leads
// ---------------------------------------------------------------------------

export const fctVenda = pgTable(
  "fct_venda",
  {
    vendaId: text("venda_id").primaryKey(),
    nome: text("nome"),
    email: text("email"),
    celular: text("celular"),
    turma: text("turma"),
    curso: text("curso"),
    valor: numeric("valor"),
    valorConvertido: numeric("valor_convertido"),
    estado: text("estado"),
    cidade: text("cidade"),
    canalVenda: text("canal_venda"),
    fase: text("fase"),
    promocao: text("promocao"),
    pacote: text("pacote"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    utmGclid: text("utm_gclid"),
    origemLead: text("origem_lead"),
    ultimaOrigemLead: text("ultima_origem_lead"),
    dataCriacao: timestamp("data_criacao", { withTimezone: true }),
    dataAprovacao: date("data_aprovacao"),
    dataMatricula: date("data_matricula"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("fct_venda_email_idx").on(t.email),
    index("fct_venda_data_matricula_idx").on(t.dataMatricula),
    index("fct_venda_turma_idx").on(t.turma),
    index("fct_venda_canal_venda_idx").on(t.canalVenda),
    index("fct_venda_estado_idx").on(t.estado),
  ],
);

export const fctLead = pgTable(
  "fct_lead",
  {
    leadId: text("lead_id").primaryKey(),
    nome: text("nome"),
    email: text("email"),
    celular: text("celular"),
    estado: text("estado"),
    cidade: text("cidade"),
    status: text("status"),
    origem: text("origem"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    urlCadastro: text("url_cadastro"),
    dataCriacao: timestamp("data_criacao", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("fct_lead_email_idx").on(t.email),
    index("fct_lead_data_criacao_idx").on(t.dataCriacao),
  ],
);

export const dimPessoa = pgTable("dim_pessoa", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  telefone: text("telefone"),
  nome: text("nome"),
  cidade: text("cidade"),
  estado: text("estado"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Atribuição
// ---------------------------------------------------------------------------

export const bridgeLeadVenda = pgTable(
  "bridge_lead_venda",
  {
    id: serial("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => fctLead.leadId),
    vendaId: text("venda_id")
      .notNull()
      .references(() => fctVenda.vendaId),
    matchMethod: text("match_method").notNull(),
    matchScore: numeric("match_score").notNull(),
    isPreSale: boolean("is_pre_sale").notNull(),
    isPrimary: boolean("is_primary").default(true),
    matchLagDays: integer("match_lag_days"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("bridge_lead_venda_venda_idx").on(t.vendaId),
    index("bridge_lead_venda_lead_idx").on(t.leadId),
  ],
);

// ---------------------------------------------------------------------------
// View materializada: vendas_atribuidas
// (gerenciada pelo pipeline rebuild_core — não é uma tabela Drizzle gerenciada)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Qualidade de dados
// ---------------------------------------------------------------------------

export const dqFindings = pgTable("dq_findings", {
  id: serial("id").primaryKey(),
  entity: text("entity"),
  entityId: text("entity_id"),
  rule: text("rule"),
  severity: text("severity"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dqResolutions = pgTable("dq_resolutions", {
  id: serial("id").primaryKey(),
  findingId: integer("finding_id").references(() => dqFindings.id),
  action: text("action"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Cadastros
// ---------------------------------------------------------------------------

export const produtos = pgTable("produtos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nomeProduto: text("nome_produto").notNull(),
  abreviacao: text("abreviacao").notNull(),
  corHex: text("cor_hex").notNull().default("#1E40AF"),
  edicaoAnualUnica: boolean("edicao_anual_unica").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const contas = pgTable("contas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nomeConta: text("nome_conta").notNull(),
  produtoPrincipalId: uuid("produto_principal_id").references(() => produtos.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const edicoes = pgTable("edicoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nomeEdicao: text("nome_edicao").notNull(),
  produtoId: uuid("produto_id").references(() => produtos.id),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  valorAprovado: numeric("valor_aprovado"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orcamentos = pgTable("orcamentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  mesReferencia: text("mes_referencia").notNull(),
  produtoId: uuid("produto_id").references(() => produtos.id),
  edicaoId: uuid("edicao_id").references(() => edicoes.id),
  valorAprovado: numeric("valor_aprovado").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const regrasClassificacao = pgTable("regras_classificacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  canal: text("canal").notNull(),
  prioridade: integer("prioridade").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const metaPipeline = pgTable("meta_pipeline", {
  id: serial("id").primaryKey(),
  status: text("status"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  details: jsonb("details"),
});

export const planilhaImports = pgTable("planilha_imports", {
  id: serial("id").primaryKey(),
  tipo: text("tipo"),
  url: text("url"),
  status: text("status"),
  totalRows: integer("total_rows"),
  importedRows: integer("imported_rows"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const planilhaLeads = pgTable("planilha_leads", {
  id: serial("id").primaryKey(),
  importId: integer("import_id").references(() => planilhaImports.id),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rdVendas = pgTable("rd_vendas", {
  id: serial("id").primaryKey(),
  importId: integer("import_id").references(() => planilhaImports.id),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// BI Workspaces
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("editor"),
});

export const dsSources = pgTable("ds_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name"),
  type: text("type"),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dsColumns = pgTable("ds_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dsSources.id, { onDelete: "cascade" }),
  name: text("name"),
  type: text("type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dsRows = pgTable("ds_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dsSources.id, { onDelete: "cascade" }),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dataModels = pgTable("data_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name"),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const modelNodes = pgTable("model_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").references(() => dataModels.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").references(() => dsSources.id),
  position: jsonb("position"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const relationships = pgTable("relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id").references(() => dataModels.id, { onDelete: "cascade" }),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const relationshipColumns = pgTable("relationship_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  relationshipId: uuid("relationship_id").references(() => relationships.id, { onDelete: "cascade" }),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  userRoles: many(userRoles),
  workspaceMembers: many(workspaceMembers),
}));

export const fctVendaRelations = relations(fctVenda, ({ many }) => ({
  bridgeLeads: many(bridgeLeadVenda),
}));

export const fctLeadRelations = relations(fctLead, ({ many }) => ({
  bridgeVendas: many(bridgeLeadVenda),
}));

export const bridgeLeadVendaRelations = relations(bridgeLeadVenda, ({ one }) => ({
  lead: one(fctLead, { fields: [bridgeLeadVenda.leadId], references: [fctLead.leadId] }),
  venda: one(fctVenda, { fields: [bridgeLeadVenda.vendaId], references: [fctVenda.vendaId] }),
}));

export const edicoesRelations = relations(edicoes, ({ one }) => ({
  produto: one(produtos, { fields: [edicoes.produtoId], references: [produtos.id] }),
}));

export const orcamentosRelations = relations(orcamentos, ({ one }) => ({
  produto: one(produtos, { fields: [orcamentos.produtoId], references: [produtos.id] }),
  edicao: one(edicoes, { fields: [orcamentos.edicaoId], references: [edicoes.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  sources: many(dsSources),
  models: many(dataModels),
}));
