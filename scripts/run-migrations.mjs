#!/usr/bin/env node
/**
 * Executa as migrations pendentes manualmente.
 * Rodar no servidor: DATABASE_URL=... node scripts/run-migrations.mjs
 */
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const postgres = require("postgres");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const migrations = [
  "src/db/migrations/0004_derive_canal_grupos.sql",
  "src/db/migrations/0005_turma_lookup.sql",
  "src/db/migrations/0006_add_unidade_geradora.sql",
  "src/db/migrations/0007_ad_spend_tables.sql",
  "src/db/migrations/0008_remove_operacional_canal.sql",
  "src/db/migrations/0009_add_utm_src.sql",
  "src/db/migrations/0010_unidade_geradora_lookup.sql",
];

for (const path of migrations) {
  const content = fs.readFileSync(path, "utf8");
  console.log(`→ Running ${path}...`);
  try {
    await sql.unsafe(content);
    console.log(`  ✓ OK`);
  } catch (e) {
    console.error(`  ✗ Erro: ${e.message}`);
  }
}

// Verificar estado final
console.log("\n── Verificação ──");

const r1 = await sql`SELECT count(*) as n FROM vendas_atribuidas`;
console.log("vendas_atribuidas count:", r1[0].n);

try {
  const r2 = await sql`SELECT DISTINCT unidade_geradora FROM vendas_atribuidas WHERE unidade_geradora IS NOT NULL LIMIT 10`;
  console.log("unidade_geradora values:", r2.map(r => r.unidade_geradora));
} catch (e) {
  console.log("unidade_geradora:", e.message);
}

try {
  const r3 = await sql`SELECT DISTINCT estado FROM vendas_atribuidas WHERE estado IS NOT NULL LIMIT 10`;
  console.log("estado values:", r3.map(r => r.estado));
} catch (e) {
  console.log("estado:", e.message);
}

try {
  const r4 = await sql`SELECT count(*) as n FROM planilha_leads`;
  console.log("planilha_leads count:", r4[0].n);
} catch (e) {
  console.log("planilha_leads:", e.message);
}

try {
  const r5 = await sql`SELECT count(*) as n FROM meta_ads_spend`;
  const r6 = await sql`SELECT count(*) as n FROM google_ads_spend`;
  console.log("meta_ads_spend count:", r5[0].n);
  console.log("google_ads_spend count:", r6[0].n);
} catch (e) {
  console.log("ads tables:", e.message);
}

try {
  const r7 = await sql`SELECT DISTINCT utm_src FROM vendas_atribuidas WHERE utm_src IS NOT NULL LIMIT 10`;
  console.log("utm_src values:", r7.map(r => r.utm_src));
} catch (e) {
  console.log("utm_src:", e.message);
}

await sql.end();
console.log("\nDone.");
