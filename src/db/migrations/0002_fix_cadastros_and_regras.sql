-- Corrige schema de produtos, edicoes, orcamentos para corresponder ao admin.cadastros.tsx
-- Estende regras_classificacao para suportar filtros de canal customizaveis

-- ─── produtos ─────────────────────────────────────────────────────────────────
ALTER TABLE "produtos" RENAME COLUMN "nome" TO "nome_produto";
ALTER TABLE "produtos" ADD COLUMN "abreviacao" text NOT NULL DEFAULT '';
ALTER TABLE "produtos" ADD COLUMN "cor_hex" text NOT NULL DEFAULT '#1E40AF';
ALTER TABLE "produtos" ADD COLUMN "edicao_anual_unica" boolean NOT NULL DEFAULT false;

-- ─── edicoes ──────────────────────────────────────────────────────────────────
ALTER TABLE "edicoes" RENAME COLUMN "nome" TO "nome_edicao";
ALTER TABLE "edicoes" ADD COLUMN "produto_id" uuid REFERENCES "produtos"("id");
ALTER TABLE "edicoes" ADD COLUMN "data_inicio" date;
ALTER TABLE "edicoes" ADD COLUMN "data_fim" date;
ALTER TABLE "edicoes" ADD COLUMN "valor_aprovado" numeric;

-- ─── orcamentos ───────────────────────────────────────────────────────────────
ALTER TABLE "orcamentos" DROP COLUMN "nome";
ALTER TABLE "orcamentos" ADD COLUMN "mes_referencia" text NOT NULL DEFAULT '';
ALTER TABLE "orcamentos" ADD COLUMN "produto_id" uuid REFERENCES "produtos"("id");
ALTER TABLE "orcamentos" ADD COLUMN "edicao_id" uuid REFERENCES "edicoes"("id");
ALTER TABLE "orcamentos" ADD COLUMN "valor_aprovado" numeric NOT NULL DEFAULT 0;

-- ─── regras_classificacao ─────────────────────────────────────────────────────
ALTER TABLE "regras_classificacao" ADD COLUMN "canal" text NOT NULL DEFAULT 'Outros';
ALTER TABLE "regras_classificacao" ADD COLUMN "prioridade" integer NOT NULL DEFAULT 0;
ALTER TABLE "regras_classificacao" ADD COLUMN "ativo" boolean NOT NULL DEFAULT true;
