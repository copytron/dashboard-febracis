CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bridge_lead_venda" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"venda_id" text NOT NULL,
	"match_method" text NOT NULL,
	"match_score" numeric NOT NULL,
	"is_pre_sale" boolean NOT NULL,
	"is_primary" boolean DEFAULT true,
	"match_lag_days" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_conta" text NOT NULL,
	"produto_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name" text,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dim_pessoa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"telefone" text,
	"nome" text,
	"cidade" text,
	"estado" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dq_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text,
	"entity_id" text,
	"rule" text,
	"severity" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dq_resolutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"finding_id" integer,
	"action" text,
	"resolved_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ds_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"name" text,
	"type" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ds_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ds_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"name" text,
	"type" text,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "edicoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fct_lead" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"nome" text,
	"email" text,
	"celular" text,
	"estado" text,
	"cidade" text,
	"status" text,
	"origem" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"url_cadastro" text,
	"data_criacao" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fct_venda" (
	"venda_id" text PRIMARY KEY NOT NULL,
	"nome" text,
	"email" text,
	"celular" text,
	"turma" text,
	"curso" text,
	"valor" numeric,
	"valor_convertido" numeric,
	"estado" text,
	"cidade" text,
	"canal_venda" text,
	"fase" text,
	"promocao" text,
	"pacote" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"utm_gclid" text,
	"origem_lead" text,
	"ultima_origem_lead" text,
	"data_criacao" timestamp with time zone,
	"data_aprovacao" date,
	"data_matricula" date,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meta_pipeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "model_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid,
	"source_id" uuid,
	"position" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orcamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "planilha_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text,
	"url" text,
	"status" text,
	"total_rows" integer,
	"imported_rows" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "planilha_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rd_vendas" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regras_classificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relationship_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" uuid,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'editor'
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_lead_venda" ADD CONSTRAINT "bridge_lead_venda_lead_id_fct_lead_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."fct_lead"("lead_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_lead_venda" ADD CONSTRAINT "bridge_lead_venda_venda_id_fct_venda_venda_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."fct_venda"("venda_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas" ADD CONSTRAINT "contas_produto_principal_id_produtos_id_fk" FOREIGN KEY ("produto_principal_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_models" ADD CONSTRAINT "data_models_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dq_resolutions" ADD CONSTRAINT "dq_resolutions_finding_id_dq_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."dq_findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ds_columns" ADD CONSTRAINT "ds_columns_source_id_ds_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ds_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ds_rows" ADD CONSTRAINT "ds_rows_source_id_ds_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ds_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ds_sources" ADD CONSTRAINT "ds_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_nodes" ADD CONSTRAINT "model_nodes_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_nodes" ADD CONSTRAINT "model_nodes_source_id_ds_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ds_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planilha_leads" ADD CONSTRAINT "planilha_leads_import_id_planilha_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."planilha_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_vendas" ADD CONSTRAINT "rd_vendas_import_id_planilha_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."planilha_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_columns" ADD CONSTRAINT "relationship_columns_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bridge_lead_venda_venda_idx" ON "bridge_lead_venda" USING btree ("venda_id");--> statement-breakpoint
CREATE INDEX "bridge_lead_venda_lead_idx" ON "bridge_lead_venda" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "fct_lead_email_idx" ON "fct_lead" USING btree ("email");--> statement-breakpoint
CREATE INDEX "fct_lead_data_criacao_idx" ON "fct_lead" USING btree ("data_criacao");--> statement-breakpoint
CREATE INDEX "fct_venda_email_idx" ON "fct_venda" USING btree ("email");--> statement-breakpoint
CREATE INDEX "fct_venda_data_matricula_idx" ON "fct_venda" USING btree ("data_matricula");--> statement-breakpoint
CREATE INDEX "fct_venda_turma_idx" ON "fct_venda" USING btree ("turma");--> statement-breakpoint
CREATE INDEX "fct_venda_canal_venda_idx" ON "fct_venda" USING btree ("canal_venda");--> statement-breakpoint
CREATE INDEX "fct_venda_estado_idx" ON "fct_venda" USING btree ("estado");