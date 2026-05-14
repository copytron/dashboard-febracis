import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import type { CondicaoGroup, RegraClassificacao } from "@/lib/regras.types";
import { requireAdmin } from "@/server/auth.helpers";

export const listRegras = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(
    sql`SELECT * FROM regras_classificacao ORDER BY prioridade ASC, created_at ASC`
  );
  return result as unknown as RegraClassificacao[];
});

export const upsertRegra = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; nome: string; canal: string; prioridade: number; ativo: boolean; config: CondicaoGroup }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const configJson = JSON.stringify(data.config);
    let result;
    if (data.id) {
      result = await db.execute(sql`
        UPDATE regras_classificacao
        SET nome = ${data.nome}, canal = ${data.canal}, prioridade = ${data.prioridade},
            ativo = ${data.ativo}, config = ${configJson}::jsonb
        WHERE id = ${data.id}
        RETURNING id, nome, canal
      `);
    } else {
      result = await db.execute(sql`
        INSERT INTO regras_classificacao (nome, canal, prioridade, ativo, config)
        VALUES (${data.nome}, ${data.canal}, ${data.prioridade}, ${data.ativo}, ${configJson}::jsonb)
        RETURNING id, nome, canal
      `);
    }
    const row = (result as unknown as { id: string; nome: string; canal: string }[])[0];
    if (!row) throw new Error("Falha ao salvar regra — nenhuma linha retornada");
    return { ok: true, id: row.id, nome: row.nome, canal: row.canal };
  });

export const deleteRegra = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db.execute(sql`DELETE FROM regras_classificacao WHERE id = ${data.id}`);
    return { ok: true };
  });
