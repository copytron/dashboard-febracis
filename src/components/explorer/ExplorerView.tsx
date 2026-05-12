import { useEffect, useMemo, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql as drizzleSql } from "drizzle-orm";
import { Card } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Play, Download, Save, Trash2, Loader2 } from "lucide-react";
import { fmtNum } from "@/lib/format";

// ===== Types =====
type Col = { name: string; type: string };
type Tbl = { name: string; label: string; keys: string[]; columns: Col[] };
type Meta = { tables: Tbl[]; aggregations: string[]; operators: string[] };

type BringKind = "count" | "count_distinct" | "min" | "max" | "sum" | "avg" | "first" | "last" | "list_distinct";
type Bring = { kind: BringKind; col?: string; order_by?: string; order_dir?: "asc" | "desc"; as: string };
type Join = { table: string; on: [string, string][]; bring: Bring[] };
type Filter = { col: string; op: string; val: any };
type Order = { col: string; dir: "asc" | "desc" };
type Query = {
  base: string;
  joins: Join[];
  filters: Filter[];
  order_by: Order[];
  limit: number;
  offset: number;
  select_base?: string[];
};

const OPS = [
  { v: "=", label: "=" }, { v: "<>", label: "≠" },
  { v: ">", label: ">" }, { v: ">=", label: "≥" }, { v: "<", label: "<" }, { v: "<=", label: "≤" },
  { v: "ilike", label: "contém" },
  { v: "in", label: "em (lista)" },
  { v: "is_null", label: "é vazio" }, { v: "is_not_null", label: "não vazio" },
];

const AGGS: { v: BringKind; label: string; needsCol: boolean; needsOrder?: boolean }[] = [
  { v: "count", label: "Contagem (todas linhas)", needsCol: false },
  { v: "count_distinct", label: "Contagem distinta", needsCol: true },
  { v: "min", label: "Mínimo", needsCol: true },
  { v: "max", label: "Máximo", needsCol: true },
  { v: "sum", label: "Soma", needsCol: true },
  { v: "avg", label: "Média", needsCol: true },
  { v: "first", label: "Primeiro (por ordem)", needsCol: true, needsOrder: true },
  { v: "last", label: "Último (por ordem)", needsCol: true, needsOrder: true },
  { v: "list_distinct", label: "Lista de valores únicos", needsCol: true },
];

const fetchQueryBuilderMeta = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(drizzleSql`SELECT query_builder_meta() AS meta`);
  return (result[0] as any)?.meta as Meta;
});

const runQueryBuilder = createServerFn({ method: "POST" })
  .inputValidator((query: any) => query as Query)
  .handler(async ({ data }) => {
    const result = await db.execute(
      drizzleSql`SELECT query_builder(${JSON.stringify(data)}::jsonb) AS result`
    );
    return (result[0] as any)?.result as { rows: any[]; total: number };
  });

const SAVED_KEY = "explorer_views_v1";

export default function ExplorerView({ initialBase }: { initialBase?: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [query, setQuery] = useState<Query>(() => ({
    base: initialBase ?? "fct_venda",
    joins: [],
    filters: [],
    order_by: [],
    limit: 200,
    offset: 0,
  }));
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [editJoinIdx, setEditJoinIdx] = useState<number | null>(null);
  const [savedViews, setSavedViews] = useState<Record<string, Query>>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    fetchQueryBuilderMeta()
      .then((data) => setMeta(data))
      .catch((e: any) => setMetaErr(e?.message ?? "Erro ao carregar metadados"));
  }, []);

  useEffect(() => { if (initialBase) setQuery((q) => ({ ...q, base: initialBase, joins: [], filters: [] })); }, [initialBase]);

  const baseTbl = useMemo(() => meta?.tables.find((t) => t.name === query.base), [meta, query.base]);

  async function run() {
    setRunning(true); setRunErr(null);
    try {
      const data = await runQueryBuilder({ data: query });
      setRows((data?.rows as any[]) ?? []);
      setTotal(data?.total ?? null);
    } catch (e: any) {
      setRunErr(e.message ?? String(e));
      setRows([]); setTotal(null);
    } finally { setRunning(false); }
  }

  function exportCsv() {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const escape = (v: any) => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => escape(r[c])).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `explorador_${query.base}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function saveView() {
    const name = prompt("Nome desta visão:");
    if (!name) return;
    const next = { ...savedViews, [name]: query };
    setSavedViews(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }
  function loadView(name: string) {
    const q = savedViews[name]; if (q) setQuery(q);
  }
  function deleteView(name: string) {
    const next = { ...savedViews }; delete next[name];
    setSavedViews(next); localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  if (metaErr) return <Card title="Explorador"><div className="text-sm text-destructive">Erro ao carregar metadados: {metaErr}. Você precisa estar logado como admin.</div></Card>;
  if (!meta) return <Card title="Explorador"><div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Carregando…</div></Card>;

  // join column for filter dropdowns
  const filterColOptions: { value: string; label: string }[] = [];
  baseTbl?.columns.forEach((c) => filterColOptions.push({ value: `base.${c.name}`, label: `base.${c.name}` }));
  query.joins.forEach((j, i) => j.bring.forEach((b) => filterColOptions.push({ value: `j${i}.${b.as}`, label: `${j.table}.${b.as}` })));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card title="Construtor de consulta">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Tabela base</div>
            <Select value={query.base} onValueChange={(v) => setQuery((q) => ({ ...q, base: v, joins: [], filters: [], order_by: [] }))}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {meta.tables.map((t) => <SelectItem key={t.name} value={t.name}>{t.label} · {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Visões salvas</div>
            <div className="flex items-center gap-1">
              <Select onValueChange={loadView}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(savedViews).length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">nenhuma</div>}
                  {Object.keys(savedViews).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={saveView} title="Salvar visão atual"><Save className="size-4" /></Button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button onClick={run} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin mr-1" /> : <Play className="size-4 mr-1" />}
              Executar
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="size-4 mr-1" />CSV</Button>
          </div>
        </div>

        {/* Conexões */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-muted-foreground">CONEXÕES</div>
            <Button size="sm" variant="outline" onClick={() => {
              setQuery((q) => ({ ...q, joins: [...q.joins, { table: meta.tables[0].name, on: [], bring: [] }] }));
              setEditJoinIdx(query.joins.length);
            }}><Plus className="size-3.5 mr-1" />Conectar tabela</Button>
          </div>
          {query.joins.length === 0 && <div className="text-xs text-muted-foreground italic">nenhuma conexão — clique em "Conectar tabela"</div>}
          <div className="space-y-2">
            {query.joins.map((j, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-border bg-card/40">
                <div className="text-xs">
                  <span className="font-mono">→ {j.table}</span>
                  <span className="text-muted-foreground"> · por </span>
                  <span className="font-mono">{j.on.map((p) => `${p[0]}=${p[1]}`).join(" OR ") || "(sem chave)"}</span>
                  {j.bring.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {j.bring.map((b) => <Badge key={b.as} variant="secondary" className="text-[10px]">{b.as}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditJoinIdx(i)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuery((q) => ({ ...q, joins: q.joins.filter((_, k) => k !== i) }))}><X className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-muted-foreground">FILTROS</div>
            <Button size="sm" variant="outline" onClick={() => setQuery((q) => ({
              ...q, filters: [...q.filters, { col: filterColOptions[0]?.value ?? "", op: "=", val: "" }],
            }))}><Plus className="size-3.5 mr-1" />Filtro</Button>
          </div>
          {query.filters.length === 0 && <div className="text-xs text-muted-foreground italic">sem filtros</div>}
          <div className="space-y-2">
            {query.filters.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={f.col} onValueChange={(v) => setQuery((q) => ({ ...q, filters: q.filters.map((x, k) => k === i ? { ...x, col: v } : x) }))}>
                  <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {filterColOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={f.op} onValueChange={(v) => setQuery((q) => ({ ...q, filters: q.filters.map((x, k) => k === i ? { ...x, op: v } : x) }))}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {f.op !== "is_null" && f.op !== "is_not_null" && (
                  <Input
                    className="w-[260px]"
                    placeholder={f.op === "in" ? "valor1, valor2, …" : "valor"}
                    value={typeof f.val === "string" ? f.val : Array.isArray(f.val) ? f.val.join(", ") : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const next = f.op === "in" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
                      setQuery((q) => ({ ...q, filters: q.filters.map((x, k) => k === i ? { ...x, val: next } : x) }));
                    }}
                  />
                )}
                <Button size="sm" variant="ghost" onClick={() => setQuery((q) => ({ ...q, filters: q.filters.filter((_, k) => k !== i) }))}><X className="size-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        {/* Order by */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-muted-foreground">ORDENAR (colunas da base)</div>
            <Button size="sm" variant="outline" onClick={() => setQuery((q) => ({
              ...q, order_by: [...q.order_by, { col: baseTbl?.columns[0].name ?? "", dir: "desc" }],
            }))}><Plus className="size-3.5 mr-1" /></Button>
          </div>
          {query.order_by.length === 0 && <div className="text-xs text-muted-foreground italic">sem ordenação</div>}
          <div className="space-y-2">
            {query.order_by.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={o.col} onValueChange={(v) => setQuery((q) => ({ ...q, order_by: q.order_by.map((x, k) => k === i ? { ...x, col: v } : x) }))}>
                  <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {baseTbl?.columns.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={o.dir} onValueChange={(v) => setQuery((q) => ({ ...q, order_by: q.order_by.map((x, k) => k === i ? { ...x, dir: v as any } : x) }))}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="asc">↑ asc</SelectItem><SelectItem value="desc">↓ desc</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setQuery((q) => ({ ...q, order_by: q.order_by.filter((_, k) => k !== i) }))}><X className="size-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        {/* Saved views with delete */}
        {Object.keys(savedViews).length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-1">
            {Object.keys(savedViews).map((n) => (
              <div key={n} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted">
                <button onClick={() => loadView(n)}>{n}</button>
                <button onClick={() => deleteView(n)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Resultado */}
      <Card title={`Resultado · ${rows.length ? fmtNum(rows.length) : 0} linhas exibidas${total !== null ? ` · ${fmtNum(total)} no total` : ""}`}>
        {runErr && <div className="text-xs text-destructive mb-2">{runErr}</div>}
        {!rows.length && !running && <div className="text-xs text-muted-foreground italic">clique em "Executar" para carregar dados.</div>}
        {rows.length > 0 && <ResultGrid rows={rows} />}
      </Card>

      {/* Connection editor */}
      {editJoinIdx !== null && meta && (
        <ConnectionEditor
          meta={meta}
          baseTbl={baseTbl!}
          join={query.joins[editJoinIdx]}
          onClose={() => setEditJoinIdx(null)}
          onSave={(j) => {
            setQuery((q) => ({ ...q, joins: q.joins.map((x, k) => k === editJoinIdx ? j : x) }));
            setEditJoinIdx(null);
          }}
        />
      )}
    </div>
  );
}

// ===== Result grid =====
function ResultGrid({ rows }: { rows: any[] }) {
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-auto max-h-[600px] border border-border rounded">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 sticky top-0">
          <tr>{cols.map((c) => <th key={c} className="text-left px-2 py-1.5 font-mono text-muted-foreground border-b border-border whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
              {cols.map((c) => {
                const v = r[c];
                const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
                return <td key={c} className="px-2 py-1 font-mono whitespace-nowrap max-w-[300px] truncate" title={s}>{s}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== Connection editor modal =====
function ConnectionEditor({ meta, baseTbl, join, onClose, onSave }: {
  meta: Meta; baseTbl: Tbl; join: Join; onClose: () => void; onSave: (j: Join) => void;
}) {
  const [j, setJ] = useState<Join>(join);
  const targetTbl = meta.tables.find((t) => t.name === j.table);

  function addOn() {
    const a = baseTbl.keys[0] ?? baseTbl.columns[0].name;
    const b = targetTbl?.keys[0] ?? targetTbl?.columns[0].name ?? "";
    setJ({ ...j, on: [...j.on, [a, b]] });
  }
  function addBring() {
    const newAs = `col${j.bring.length + 1}`;
    setJ({ ...j, bring: [...j.bring, { kind: "count", as: newAs }] });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Conectar tabela</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Tabela alvo</div>
            <Select value={j.table} onValueChange={(v) => setJ({ ...j, table: v, on: [], bring: [] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{meta.tables.map((t) => <SelectItem key={t.name} value={t.name}>{t.label} · {t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-muted-foreground">Chaves de junção (combinadas com OR)</div>
              <Button size="sm" variant="outline" onClick={addOn}><Plus className="size-3.5 mr-1" />par</Button>
            </div>
            {j.on.length === 0 && <div className="text-xs text-muted-foreground italic">adicione ao menos um par (ex: email_key = email_key)</div>}
            <div className="space-y-2">
              {j.on.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={p[0]} onValueChange={(v) => setJ({ ...j, on: j.on.map((x, k) => k === i ? [v, x[1]] : x) })}>
                    <SelectTrigger className="w-1/2"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">{baseTbl.columns.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">=</span>
                  <Select value={p[1]} onValueChange={(v) => setJ({ ...j, on: j.on.map((x, k) => k === i ? [x[0], v] : x) })}>
                    <SelectTrigger className="w-1/2"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">{targetTbl?.columns.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => setJ({ ...j, on: j.on.filter((_, k) => k !== i) })}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-muted-foreground">Colunas a trazer</div>
              <Button size="sm" variant="outline" onClick={addBring}><Plus className="size-3.5 mr-1" />coluna</Button>
            </div>
            <div className="space-y-2">
              {j.bring.map((b, i) => {
                const agg = AGGS.find((a) => a.v === b.kind)!;
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Select value={b.kind} onValueChange={(v) => setJ({ ...j, bring: j.bring.map((x, k) => k === i ? { ...x, kind: v as BringKind } : x) })}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{AGGS.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {agg.needsCol ? (
                      <Select value={b.col ?? ""} onValueChange={(v) => setJ({ ...j, bring: j.bring.map((x, k) => k === i ? { ...x, col: v } : x) })}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="coluna" /></SelectTrigger>
                        <SelectContent className="max-h-72">{targetTbl?.columns.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <div className="col-span-3 text-xs text-muted-foreground">—</div>}
                    {agg.needsOrder ? (
                      <Select value={b.order_by ?? ""} onValueChange={(v) => setJ({ ...j, bring: j.bring.map((x, k) => k === i ? { ...x, order_by: v } : x) })}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="ordenar por" /></SelectTrigger>
                        <SelectContent className="max-h-72">{targetTbl?.columns.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <div className="col-span-3" />}
                    <Input className="col-span-2" placeholder="apelido" value={b.as} onChange={(e) => setJ({ ...j, bring: j.bring.map((x, k) => k === i ? { ...x, as: e.target.value.replace(/[^a-z0-9_]/gi, "_") } : x) })} />
                    <Button size="sm" variant="ghost" className="col-span-1" onClick={() => setJ({ ...j, bring: j.bring.filter((_, k) => k !== i) })}><X className="size-4" /></Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(j)} disabled={!j.on.length}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
