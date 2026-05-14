import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import {
  workspaces,
  dsSources,
  dsColumns,
  dsRows,
  dataModels,
  relationships,
  relationshipColumns,
} from "@/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Workspace = { id: string; name: string; created_at: string };
export type DsSource = { id: string; workspace_id: string; name: string; row_count: number; updated_at: string };
export type DsColumn = { id: string; source_id: string; name: string; type: string; ordinal: number };
export type DataModel = { id: string; workspace_id: string; name: string };
export type ModelNode = { id: string; model_id: string; source_id: string; x: number; y: number };
export type Relationship = {
  id: string; model_id: string; from_source: string; to_source: string;
  cardinality: "one_one" | "one_many" | "many_one" | "many_many";
  direction: "single" | "both"; active: boolean;
};
export type RelColumn = { id: string; relationship_id: string; from_col: string; to_col: string; ord: number };

export type ValidateResult = {
  total_left: number; total_right: number;
  matched_left: number; matched_right: number;
  cardinality: Relationship["cardinality"];
};

// ─── Server functions ─────────────────────────────────────────────────────────

export const listWorkspacesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const rows = await db
      .select({ id: workspaces.id, name: workspaces.name, created_at: workspaces.createdAt })
      .from(workspaces)
      .orderBy(sql`created_at DESC`);
    return rows.map((r) => ({ ...r, created_at: r.created_at?.toISOString() ?? "" })) as Workspace[];
  });

export const createWorkspaceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data }) => {
    const [ws] = await db
      .insert(workspaces)
      .values({ name: (data as any).name })
      .returning({ id: workspaces.id, name: workspaces.name, createdAt: workspaces.createdAt });
    return { id: ws.id, name: ws.name, created_at: ws.createdAt?.toISOString() ?? "" } as Workspace;
  });

export const listSourcesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ data }) => {
    const result = await db.execute(sql`
      SELECT
        s.id,
        s.workspace_id,
        s.name,
        s.created_at,
        COUNT(r.id)::int AS row_count
      FROM ds_sources s
      LEFT JOIN ds_rows r ON r.source_id = s.id
      WHERE s.workspace_id = ${(data as any).workspace_id}
      GROUP BY s.id, s.workspace_id, s.name, s.created_at
      ORDER BY s.created_at DESC
    `);
    return (result as any[]).map((r: any) => ({
      id: r.id,
      workspace_id: r.workspace_id,
      name: r.name,
      row_count: Number(r.row_count ?? 0),
      updated_at: r.created_at ?? "",
    })) as DsSource[];
  });

export const listColumnsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { source_id: string }) => d)
  .handler(async ({ data }) => {
    const cols = await db
      .select()
      .from(dsColumns)
      .where(eq(dsColumns.sourceId, (data as any).source_id))
      .orderBy(dsColumns.createdAt);
    return cols.map((c, i) => ({
      id: c.id,
      source_id: c.sourceId ?? "",
      name: c.name ?? "",
      type: c.type ?? "text",
      ordinal: i,
    })) as DsColumn[];
  });

export const listColumnsForSourcesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { source_ids: string[] }) => d)
  .handler(async ({ data }) => {
    if (!(data as any).source_ids?.length) return [] as DsColumn[];
    const cols = await db
      .select()
      .from(dsColumns)
      .where(inArray(dsColumns.sourceId, (data as any).source_ids))
      .orderBy(dsColumns.createdAt);
    return cols.map((c, i) => ({
      id: c.id,
      source_id: c.sourceId ?? "",
      name: c.name ?? "",
      type: c.type ?? "text",
      ordinal: i,
    })) as DsColumn[];
  });

export const importSheetFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    workspace_id: string;
    name: string;
    columns: { name: string; type: string }[];
    rows: Record<string, unknown>[];
  }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    const [src] = await db
      .insert(dsSources)
      .values({ workspaceId: d.workspace_id, name: d.name, type: "sheet" })
      .returning({ id: dsSources.id });

    if (d.columns?.length) {
      await db.insert(dsColumns).values(
        d.columns.map((c: { name: string; type: string }) => ({ sourceId: src.id, name: c.name, type: c.type })),
      );
    }

    if (d.rows?.length) {
      const chunks: Record<string, unknown>[][] = [];
      for (let i = 0; i < d.rows.length; i += 500) {
        chunks.push(d.rows.slice(i, i + 500));
      }
      for (const chunk of chunks) {
        await db.insert(dsRows).values(chunk.map((row: Record<string, unknown>) => ({ sourceId: src.id, data: row })));
      }
    }

    return src.id;
  });

export const deleteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await db.delete(dsSources).where(eq(dsSources.id, (data as any).id));
  });

export const previewRowsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { source_id: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    const rows = await db
      .select({ data: dsRows.data })
      .from(dsRows)
      .where(eq(dsRows.sourceId, d.source_id))
      .limit(d.limit ?? 50);
    return rows.map((r) => r.data as Record<string, any>);
  });

export const listModelsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ data }) => {
    const rows = await db
      .select({ id: dataModels.id, workspace_id: dataModels.workspaceId, name: dataModels.name })
      .from(dataModels)
      .where(eq(dataModels.workspaceId, (data as any).workspace_id))
      .orderBy(dataModels.createdAt);
    return rows.map((r) => ({ id: r.id, workspace_id: r.workspace_id ?? "", name: r.name ?? "" })) as DataModel[];
  });

export const ensureDefaultModelFn = createServerFn({ method: "POST" })
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ data }) => {
    const existing = await db
      .select({ id: dataModels.id, workspace_id: dataModels.workspaceId, name: dataModels.name })
      .from(dataModels)
      .where(eq(dataModels.workspaceId, (data as any).workspace_id))
      .orderBy(dataModels.createdAt)
      .limit(1);
    if (existing.length) {
      const m = existing[0];
      return { id: m.id, workspace_id: m.workspace_id ?? "", name: m.name ?? "" } as DataModel;
    }
    const [created] = await db
      .insert(dataModels)
      .values({ workspaceId: (data as any).workspace_id, name: "Modelo padrão" })
      .returning({ id: dataModels.id, workspace_id: dataModels.workspaceId, name: dataModels.name });
    return { id: created.id, workspace_id: created.workspace_id ?? "", name: created.name ?? "" } as DataModel;
  });

export const listNodesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { model_id: string }) => d)
  .handler(async ({ data }) => {
    const result = await db.execute(sql`
      SELECT id, model_id, source_id,
             (position->>'x')::numeric AS x,
             (position->>'y')::numeric AS y
      FROM model_nodes
      WHERE model_id = ${(data as any).model_id}
    `);
    return (result as any[]).map((r: any) => ({
      id: r.id,
      model_id: r.model_id,
      source_id: r.source_id,
      x: Number(r.x ?? 0),
      y: Number(r.y ?? 0),
    })) as ModelNode[];
  });

export const upsertNodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { model_id: string; source_id: string; x: number; y: number }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    await db.execute(sql`
      INSERT INTO model_nodes (model_id, source_id, position)
      VALUES (${d.model_id}, ${d.source_id}, ${JSON.stringify({ x: d.x, y: d.y })}::jsonb)
      ON CONFLICT (model_id, source_id)
      DO UPDATE SET position = ${JSON.stringify({ x: d.x, y: d.y })}::jsonb
    `);
  });

export const removeNodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { model_id: string; source_id: string }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    await db.execute(sql`
      DELETE FROM model_nodes
      WHERE model_id = ${d.model_id} AND source_id = ${d.source_id}
    `);
  });

export const listRelationshipsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { model_id: string }) => d)
  .handler(async ({ data }) => {
    const rels = await db.execute(sql`
      SELECT id, model_id,
             config->>'from_source' AS from_source,
             config->>'to_source' AS to_source,
             config->>'cardinality' AS cardinality,
             config->>'direction' AS direction,
             (config->>'active')::boolean AS active
      FROM relationships
      WHERE model_id = ${(data as any).model_id}
    `);

    const relRows = (rels as any[]);
    const ids = relRows.map((r: any) => r.id);

    let cols: RelColumn[] = [];
    if (ids.length) {
      const colResult = await db.execute(sql`
        SELECT id, relationship_id,
               config->>'from_col' AS from_col,
               config->>'to_col' AS to_col,
               (config->>'ord')::int AS ord
        FROM relationship_columns
        WHERE relationship_id IN (${sql.join(ids.map(v => sql`${v}`), sql`, `)})
        ORDER BY (config->>'ord')::int
      `);
      cols = (colResult as any[]).map((c: any) => ({
        id: c.id,
        relationship_id: c.relationship_id,
        from_col: c.from_col ?? "",
        to_col: c.to_col ?? "",
        ord: Number(c.ord ?? 0),
      }));
    }

    return {
      rels: relRows.map((r: any) => ({
        id: r.id,
        model_id: r.model_id,
        from_source: r.from_source ?? "",
        to_source: r.to_source ?? "",
        cardinality: (r.cardinality ?? "one_many") as Relationship["cardinality"],
        direction: (r.direction ?? "single") as Relationship["direction"],
        active: r.active ?? true,
      })) as Relationship[],
      cols,
    };
  });

export const createRelationshipFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    model_id: string; from_source: string; to_source: string;
    cardinality: Relationship["cardinality"]; direction: Relationship["direction"];
    pairs: { from_col: string; to_col: string }[];
  }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    const [rel] = await db
      .insert(relationships)
      .values({
        modelId: d.model_id,
        config: {
          from_source: d.from_source,
          to_source: d.to_source,
          cardinality: d.cardinality,
          direction: d.direction,
          active: true,
        },
      })
      .returning({ id: relationships.id });

    if (d.pairs?.length) {
      await db.insert(relationshipColumns).values(
        d.pairs.map((p: { from_col: string; to_col: string }, i: number) => ({
          relationshipId: rel.id,
          config: { from_col: p.from_col, to_col: p.to_col, ord: i },
        })),
      );
    }

    return {
      id: rel.id,
      model_id: d.model_id,
      from_source: d.from_source,
      to_source: d.to_source,
      cardinality: d.cardinality,
      direction: d.direction,
      active: true,
    } as Relationship;
  });

export const deleteRelationshipFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await db.delete(relationships).where(eq(relationships.id, (data as any).id));
  });

export const toggleRelationshipFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; active: boolean }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    await db.execute(sql`
      UPDATE relationships
      SET config = jsonb_set(config, '{active}', ${d.active}::text::jsonb)
      WHERE id = ${d.id}
    `);
  });

export const validateRelationshipFn = createServerFn({ method: "POST" })
  .inputValidator((d: { from_source: string; to_source: string; pairs: { from_col: string; to_col: string }[] }) => d)
  .handler(async ({ data }) => {
    const d = data as any;
    const pair = d.pairs?.[0];
    if (!pair) throw new Error("No column pairs provided");

    const leftResult = await db.execute(
      sql.raw(`SELECT COUNT(DISTINCT "${pair.from_col}") AS cnt FROM "${d.from_source}"`),
    );
    const rightResult = await db.execute(
      sql.raw(`SELECT COUNT(DISTINCT "${pair.to_col}") AS cnt FROM "${d.to_source}"`),
    );
    const totalLeft = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM "${d.from_source}"`));
    const totalRight = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM "${d.to_source}"`));

    const distinctLeft = Number(((leftResult as any[])[0])?.cnt ?? 0);
    const distinctRight = Number(((rightResult as any[])[0])?.cnt ?? 0);
    const totLeft = Number(((totalLeft as any[])[0])?.cnt ?? 0);
    const totRight = Number(((totalRight as any[])[0])?.cnt ?? 0);

    const isOneLeft = distinctLeft === totLeft;
    const isOneRight = distinctRight === totRight;

    let cardinality: Relationship["cardinality"];
    if (isOneLeft && isOneRight) cardinality = "one_one";
    else if (isOneLeft) cardinality = "one_many";
    else if (isOneRight) cardinality = "many_one";
    else cardinality = "many_many";

    return {
      total_left: totLeft,
      total_right: totRight,
      matched_left: distinctLeft,
      matched_right: distinctRight,
      cardinality,
    } as ValidateResult;
  });

// ─── Client-side wrapper functions (kept for backward compat with consumers) ──

export async function listWorkspaces() {
  return listWorkspacesFn();
}

export async function createWorkspace(name: string) {
  return createWorkspaceFn({ data: { name } });
}

export async function listSources(workspace_id: string) {
  return listSourcesFn({ data: { workspace_id } });
}

export async function listColumns(source_id: string) {
  return listColumnsFn({ data: { source_id } });
}

export async function listColumnsForSources(source_ids: string[]) {
  return listColumnsForSourcesFn({ data: { source_ids } });
}

export async function importSheet(p: { workspace_id: string; name: string; columns: { name: string; type: string }[]; rows: Record<string, unknown>[] }) {
  return importSheetFn({ data: p });
}

export async function deleteSource(id: string) {
  return deleteSourceFn({ data: { id } });
}

export async function previewRows(source_id: string, limit = 50) {
  return previewRowsFn({ data: { source_id, limit } });
}

export async function listModels(workspace_id: string) {
  return listModelsFn({ data: { workspace_id } });
}

export async function ensureDefaultModel(workspace_id: string) {
  return ensureDefaultModelFn({ data: { workspace_id } });
}

export async function listNodes(model_id: string) {
  return listNodesFn({ data: { model_id } });
}

export async function upsertNode(n: { model_id: string; source_id: string; x: number; y: number }) {
  return upsertNodeFn({ data: n });
}

export async function removeNode(model_id: string, source_id: string) {
  return removeNodeFn({ data: { model_id, source_id } });
}

export async function listRelationships(model_id: string) {
  return listRelationshipsFn({ data: { model_id } });
}

export async function createRelationship(args: {
  model_id: string; from_source: string; to_source: string;
  cardinality: Relationship["cardinality"]; direction: Relationship["direction"];
  pairs: { from_col: string; to_col: string }[];
}) {
  return createRelationshipFn({ data: args });
}

export async function deleteRelationship(id: string) {
  return deleteRelationshipFn({ data: { id } });
}

export async function toggleRelationship(id: string, active: boolean) {
  return toggleRelationshipFn({ data: { id, active } });
}

export async function validateRelationship(args: { from_source: string; to_source: string; pairs: { from_col: string; to_col: string }[] }) {
  return validateRelationshipFn({ data: args });
}
