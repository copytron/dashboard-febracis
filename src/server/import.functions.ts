import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { planilhaImports, planilhaLeads, rdVendas } from "@/db/schema";
import { eq } from "drizzle-orm";

import {
  buildCsvUrl,
  buildHeaderMap,
  fetchCsvRows,
  parseDate,
  parseTimestamp,
  parseNumber,
  parseInt0,
  titleCase,
  pick,
} from "./sheets.server";
import { deriveCanal } from "@/lib/canal";

const PreviewInput = z.object({
  sheetUrl: z.string().url(),
  gid: z.string().optional(),
});

async function assertAdmin(userId: string) {
  const result = await db.execute(
    sql`SELECT role FROM user_roles WHERE user_id = ${userId}`
  );
  const roles = result as unknown as { role: string }[];
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Apenas administradores podem importar planilhas.");
  }
}

export const previewSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => PreviewInput.parse(d))
  .handler(async ({ data }) => {
    const csvUrl = buildCsvUrl(data.sheetUrl, data.gid);
    const rows = await fetchCsvRows(csvUrl);
    const headers = rows.length && rows[0] ? Object.keys(rows[0]) : [];
    const headerMap = buildHeaderMap(headers);
    return { headers, headerMap, sample: rows.slice(0, 10), total: rows.length };
  });

const ImportInput = z.object({
  sheetUrl: z.string().url(),
  gid: z.string().optional(),
  aba: z.enum(["leads", "vendas"]),
  userId: z.string(),
});

const CHUNK = 200;

export const importSheet = createServerFn({ method: "POST" })
  .inputValidator((d) => ImportInput.parse(d))
  .handler(async ({ data }) => {
    await assertAdmin(data.userId);

    // Criar registro de batch em planilha_imports
    const [batch] = await db
      .insert(planilhaImports)
      .values({
        tipo: data.aba,
        url: data.sheetUrl,
        status: "running",
        totalRows: 0,
        importedRows: 0,
      })
      .returning({ id: planilhaImports.id });

    if (!batch) throw new Error("Falha ao criar batch de importação.");
    const batchId = batch.id;

    let inseridas = 0;
    let finalStatus: "success" | "error" = "success";
    let finalErro: string | null = null;

    try {
      const csvUrl = buildCsvUrl(data.sheetUrl, data.gid);
      const rows = await fetchCsvRows(csvUrl);
      if (!rows.length) throw new Error("Planilha vazia ou sem cabeçalho.");
      const headerMap = buildHeaderMap(Object.keys(rows[0]));

      // Atualizar total de linhas no batch
      await db
        .update(planilhaImports)
        .set({ totalRows: rows.length })
        .where(eq(planilhaImports.id, batchId));

      if (data.aba === "leads") {
        const records = rows.map((r) => {
          const utm_source = pick(r, headerMap, "utm_origem");
          const utm_medium = pick(r, headerMap, "utm_midia");
          const origem_lead = pick(r, headerMap, "origem_lead");
          return {
            email: pick(r, headerMap, "email"),
            nome: pick(r, headerMap, "nome"),
            telefone: pick(r, headerMap, "telefone"),
            origem_lead,
            data_lead: parseTimestamp(pick(r, headerMap, "data_lead_criacao")),
            utm_source,
            utm_medium,
            utm_campaign: pick(r, headerMap, "utm_campanha"),
            utm_content: pick(r, headerMap, "utm_conteudo"),
            utm_term: pick(r, headerMap, "utm_termo"),
            canal: deriveCanal({ utm_source, utm_medium, origem_lead }),
            raw: r as any,
            import_batch_id: batchId,
          };
        }).filter((r) => r.email || r.telefone);

        for (let i = 0; i < records.length; i += CHUNK) {
          const chunk = records.slice(i, i + CHUNK);
          await db.insert(planilhaLeads).values(
            chunk.map((r) => ({
              importId: batchId,
              data: r as any,
            }))
          );
          inseridas += chunk.length;
          await db
            .update(planilhaImports)
            .set({ importedRows: inseridas })
            .where(eq(planilhaImports.id, batchId));
        }
      } else {
        const records = rows.map((r) => {
          const utm_source = pick(r, headerMap, "utm_origem");
          const utm_medium = pick(r, headerMap, "utm_midia");
          const origem_lead = pick(r, headerMap, "origem_lead");
          return {
            id_venda: pick(r, headerMap, "id_venda"),
            email: pick(r, headerMap, "email"),
            nome_cliente: pick(r, headerMap, "nome"),
            nome_venda: pick(r, headerMap, "nome_venda"),
            proprietario: pick(r, headerMap, "proprietario"),
            lead_origem: pick(r, headerMap, "lead_origem"),
            curso: pick(r, headerMap, "curso"),
            codigo_curso: pick(r, headerMap, "codigo_curso"),
            unidade_geradora: pick(r, headerMap, "unidade_geradora"),
            codigo_unidade: pick(r, headerMap, "codigo_unidade"),
            turma: pick(r, headerMap, "turma"),
            pacote: pick(r, headerMap, "pacote"),
            promocao: pick(r, headerMap, "promocao"),
            canal_venda: pick(r, headerMap, "canal_venda"),
            checkout: pick(r, headerMap, "checkout"),
            fase: pick(r, headerMap, "fase"),
            valor: parseNumber(pick(r, headerMap, "valor")),
            valor_moeda: pick(r, headerMap, "valor_moeda"),
            valor_convertido: parseNumber(pick(r, headerMap, "valor_convertido")),
            qtd_pagantes: parseInt0(pick(r, headerMap, "qtd_pagantes")),
            qtd_parcelas: parseInt0(pick(r, headerMap, "qtd_parcelas")),
            estado: pick(r, headerMap, "estado"),
            cidade: titleCase(pick(r, headerMap, "cidade")),
            sexo: pick(r, headerMap, "sexo"),
            data_nascimento: parseDate(pick(r, headerMap, "data_nascimento")),
            mes_venda: pick(r, headerMap, "mes_venda"),
            data_criacao: parseTimestamp(pick(r, headerMap, "data_venda_criacao")),
            data_aprovacao: parseTimestamp(pick(r, headerMap, "data_aprovacao")),
            data_matricula: parseTimestamp(pick(r, headerMap, "data_matricula")),
            telefone: pick(r, headerMap, "telefone"),
            venda_pai: pick(r, headerMap, "venda_pai"),
            utm_source,
            utm_medium,
            utm_campaign: pick(r, headerMap, "utm_campanha"),
            utm_content: pick(r, headerMap, "utm_conteudo"),
            utm_term: pick(r, headerMap, "utm_termo"),
            utm_gclid: pick(r, headerMap, "utm_gclid"),
            origem_lead,
            ultima_origem_lead: pick(r, headerMap, "ultima_origem_lead"),
            raw: r as any,
            import_batch_id: batchId,
          };
        }).filter((r) => r.id_venda || r.email);

        // 1) Dedup por nome_venda + valor_convertido (mantém última ocorrência)
        const seenNV = new Map<string, any>();
        const noKey: any[] = [];
        for (const r of records) {
          const nv = (r.nome_venda ?? "").toString().trim().toLowerCase();
          const vc = r.valor_convertido ?? 0;
          if (nv) seenNV.set(`${nv}|${vc}`, r);
          else noKey.push(r);
        }
        const afterNV: any[] = [...seenNV.values(), ...noKey];

        // 2) Fallback: garantir id_venda único no lote
        const seenId = new Map<string, any>();
        const noId2: any[] = [];
        for (const r of afterNV) {
          if (r.id_venda) seenId.set(r.id_venda, r);
          else noId2.push(r);
        }
        const recordsDedup: any[] = [...seenId.values(), ...noId2];

        for (let i = 0; i < recordsDedup.length; i += CHUNK) {
          const chunk = recordsDedup.slice(i, i + CHUNK);
          const withId = chunk.filter((r) => r.id_venda);
          const noId   = chunk.filter((r) => !r.id_venda);

          if (withId.length) {
            // Upsert por id_venda via SQL para preservar semântica de conflito
            for (const r of withId) {
              await db.execute(sql`
                INSERT INTO rd_vendas (import_id, data)
                VALUES (${batchId}, ${JSON.stringify(r)}::jsonb)
                ON CONFLICT DO NOTHING
              `);
            }
          }
          if (noId.length) {
            await db.insert(rdVendas).values(
              noId.map((r) => ({
                importId: batchId,
                data: r as any,
              }))
            );
          }

          inseridas += chunk.length;
          await db
            .update(planilhaImports)
            .set({ importedRows: inseridas })
            .where(eq(planilhaImports.id, batchId));
        }
      }
    } catch (err: any) {
      finalStatus = "error";
      finalErro = err?.message ?? String(err);
    } finally {
      await db
        .update(planilhaImports)
        .set({ status: finalStatus, importedRows: inseridas })
        .where(eq(planilhaImports.id, batchId));
    }

    if (finalStatus === "error") throw new Error(finalErro ?? "Erro desconhecido");
    return { ok: true, batchId, inseridas };
  });

export const getImportHistory = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(
    sql`SELECT id, tipo AS aba, url, status, imported_rows AS linhas_inseridas, total_rows, created_at FROM planilha_imports ORDER BY created_at DESC LIMIT 20`
  );
  return result as unknown as {
    id: string;
    aba: string;
    url: string;
    status: string;
    linhas_inseridas: number;
    total_rows: number;
    created_at: string;
  }[];
});
