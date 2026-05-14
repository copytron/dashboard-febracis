#!/usr/bin/env node
/**
 * Executa as migrations pendentes (0006 e 0007).
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
  "src/db/migrations/0006_add_unidade_geradora.sql",
  "src/db/migrations/0007_ad_spend_tables.sql",
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

// Verificar
const r1 = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'meta_ads_spend' ORDER BY ordinal_position`;
console.log("\nmeta_ads_spend columns:", r1.map(r => r.column_name).join(", "));

const r2 = await sql`SELECT count(*) as n FROM vendas_atribuidas LIMIT 1`;
console.log("vendas_atribuidas count:", r2[0].n);

try {
  const r3 = await sql`SELECT DISTINCT unidade_geradora FROM vendas_atribuidas WHERE unidade_geradora IS NOT NULL LIMIT 10`;
  console.log("unidade_geradora values:", r3.map(r => r.unidade_geradora));
} catch (e) {
  console.log("unidade_geradora column check:", e.message);
}

await sql.end();
console.log("\nDone.");
