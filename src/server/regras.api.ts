import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import type { CondicaoGroup, RegraClassificacao } from "@/lib/regras.types";

export const listRegras = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(
    sql`SELECT * FROM regras_classificacao ORDER BY prioridade ASC, created_at ASC`
  );
  return result as unknown as RegraClassificacao[];
});

export const upsertRegra = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; nome: string; canal: string; prioridade: number; ativo: boolean; config: CondicaoGroup }) => d)
  .handler(async ({ data }) => {
    const configJson = JSON.stringify(data.config);
    if (data.id) {
      await db.execute(sql`
        UPDATE regras_classificacao
        SET nome = ${data.nome}, canal = ${data.canal}, prioridade = ${data.prioridade},
            ativo = ${data.ativo}, config = ${configJson}::jsonb
        WHERE id = ${data.id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO regras_classificacao (nome, canal, prioridade, ativo, config)
        VALUES (${data.nome}, ${data.canal}, ${data.prioridade}, ${data.ativo}, ${configJson}::jsonb)
      `);
    }
    return { ok: true };
  });

export const deleteRegra = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await db.execute(sql`DELETE FROM regras_classificacao WHERE id = ${data.id}`);
    return { ok: true };
  });
