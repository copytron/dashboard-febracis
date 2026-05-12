import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Play, Download, Database, Key, Hash, Type, Calendar, FileText, ZoomIn, ZoomOut, Maximize2, Move, Wand2 } from "lucide-react";
import { useRef } from "react";
import { fmtNum } from "@/lib/format";
import ExplorerView from "@/components/explorer/ExplorerView";

// ─── Server functions ─────────────────────────────────────────────────────────

const execReadSql = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const d = data as { query: string };
    const trimmed = d.query.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      throw new Error("Apenas consultas SELECT ou WITH são permitidas.");
    }
    // Wrap with LIMIT 5000 to cap results
    const limited = `WITH __q AS (\n${d.query}\n) SELECT * FROM __q LIMIT 5000`;
    const result = await db.execute(sql.raw(limited));
    return result as any;
  });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const queryBuilderMeta = createServerFn({ method: "POST" })
  .inputValidator((d: { table: string }) => d)
  .handler(async ({ data }) => {
    const d = data as { table: string };
    // Return column metadata for a given table/view
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${d.table}
      ORDER BY ordinal_position
    `);
    return result as any;
  });

const inspectTable = createServerFn({ method: "POST" })
  .inputValidator((d: { table: string }) => d)
  .handler(async ({ data }) => {
    const d = data as { table: string };
    // Validate table name to prevent injection (alphanumeric + underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(d.table)) {
      throw new Error("Nome de tabela inválido.");
    }
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM "${d.table}"`));
    const rowsResult = await db.execute(sql.raw(`SELECT * FROM "${d.table}" LIMIT 10`));
    return {
      count: Number(((countResult as any[])[0] as any)?.cnt ?? 0),
      rows: rowsResult as any as Record<string, any>[],
    } as any;
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/modelo")({
  head: () => ({ meta: [{ title: "Modelo de Dados · Febracis MKT" }] }),
  component: Modelo,
});

// ----- Esquema do whitelist -----
type Col = { name: string; type: "text" | "num" | "date" | "key" };
type Tbl = { name: string; label: string; cols: Col[]; x: number; y: number; kind?: "fact" | "dim" | "bridge" | "view" | "raw" };

const TABLES: Tbl[] = [
  { name: "fct_venda", label: "fct_venda", kind: "fact", x: 460, y: 40, cols: [
    { name: "venda_id", type: "key" }, { name: "pessoa_id", type: "key" },
    { name: "email_key", type: "key" }, { name: "phone_key", type: "key" },
    { name: "data_matricula", type: "date" }, { name: "valor_convertido", type: "num" },
    { name: "turma", type: "text" }, { name: "estado", type: "text" },
    { name: "origem_lead", type: "text" }, { name: "ultima_origem_lead", type: "text" },
    { name: "utm_source", type: "text" }, { name: "utm_medium", type: "text" },
    { name: "utm_campaign", type: "text" }, { name: "utm_content", type: "text" },
  ]},
  { name: "fct_lead", label: "fct_lead", kind: "fact", x: 60, y: 40, cols: [
    { name: "lead_id", type: "key" }, { name: "pessoa_id", type: "key" },
    { name: "email_key", type: "key" }, { name: "phone_key", type: "key" },
    { name: "data_lead", type: "date" }, { name: "origem_lead", type: "text" },
    { name: "utm_source", type: "text" }, { name: "utm_medium", type: "text" },
    { name: "utm_campaign", type: "text" }, { name: "estado", type: "text" },
  ]},
  { name: "bridge_lead_venda", label: "bridge_lead_venda", kind: "bridge", x: 260, y: 360, cols: [
    { name: "venda_id", type: "key" }, { name: "lead_id", type: "key" },
    { name: "match_method", type: "text" }, { name: "match_score", type: "num" },
    { name: "is_pre_sale", type: "text" }, { name: "is_primary", type: "text" },
  ]},
  { name: "dim_pessoa", label: "dim_pessoa", kind: "dim", x: 860, y: 40, cols: [
    { name: "pessoa_id", type: "key" }, { name: "email_key", type: "key" },
    { name: "phone_key", type: "key" }, { name: "nome", type: "text" },
    { name: "estado", type: "text" }, { name: "cidade", type: "text" },
  ]},
  { name: "vendas_atribuidas", label: "vendas_atribuidas (view)", kind: "view", x: 660, y: 360, cols: [
    { name: "id", type: "key" }, { name: "canal", type: "text" },
    { name: "origem_principal", type: "text" }, { name: "fonte_atribuicao", type: "text" },
    { name: "tipo_atribuicao", type: "text" }, { name: "data_matricula", type: "date" },
    { name: "valor_convertido", type: "num" }, { name: "utm_source", type: "text" },
    { name: "lead_utm_source", type: "text" },
  ]},
  { name: "rd_vendas", label: "rd_vendas (raw)", kind: "raw", x: 60, y: 580, cols: [
    { name: "id_venda", type: "key" }, { name: "email", type: "text" },
    { name: "data_matricula", type: "date" }, { name: "valor_convertido", type: "num" },
    { name: "origem_lead", type: "text" }, { name: "ultima_origem_lead", type: "text" },
  ]},
  { name: "rd_leads", label: "rd_leads (raw)", kind: "raw", x: 460, y: 580, cols: [
    { name: "id_lead_rd", type: "key" }, { name: "email", type: "text" },
    { name: "data_criacao", type: "date" }, { name: "origem_lead", type: "text" },
    { name: "utm_origem", type: "text" }, { name: "utm_midia", type: "text" },
  ]},
  { name: "meta_ads_spend", label: "meta_ads_spend", kind: "raw", x: 860, y: 580, cols: [
    { name: "date", type: "date" }, { name: "campaign_name", type: "text" },
    { name: "spend", type: "num" }, { name: "leads", type: "num" }, { name: "roas", type: "num" },
  ]},
  { name: "google_ads_spend", label: "google_ads_spend", kind: "raw", x: 1180, y: 580, cols: [
    { name: "date", type: "date" }, { name: "campaign_name", type: "text" },
    { name: "cost", type: "num" }, { name: "conversions", type: "num" },
  ]},
];

// Relacionamentos: [tableA.col, tableB.col]
const RELATIONS: { from: string; to: string }[] = [
  { from: "bridge_lead_venda.venda_id", to: "fct_venda.venda_id" },
  { from: "bridge_lead_venda.lead_id", to: "fct_lead.lead_id" },
  { from: "fct_venda.pessoa_id", to: "dim_pessoa.pessoa_id" },
  { from: "fct_lead.pessoa_id", to: "dim_pessoa.pessoa_id" },
  { from: "vendas_atribuidas.id", to: "fct_venda.venda_id" },
];

const SNIPPETS: { label: string; sql: string }[] = [
  { label: "Vendas por última origem (top 30)", sql: `SELECT origem_principal, fonte_atribuicao, canal,
       COUNT(*) AS vendas, SUM(valor_convertido) AS receita
FROM vendas_atribuidas
GROUP BY 1,2,3
ORDER BY receita DESC NULLS LAST
LIMIT 30` },
  { label: "Canais x UTM source (evidência)", sql: `SELECT canal, utm_origem AS utm_source,
       COUNT(*) AS vendas, SUM(valor_convertido) AS receita
FROM vendas_atribuidas
GROUP BY 1,2
ORDER BY canal, receita DESC NULLS LAST` },
  { label: "Gap: origem original vs última origem", sql: `SELECT origem_lead, ultima_origem_lead, COUNT(*) AS vendas
FROM vendas_atribuidas
WHERE COALESCE(NULLIF(BTRIM(ultima_origem_lead),''),'') <> COALESCE(NULLIF(BTRIM(origem_lead),''),'')
GROUP BY 1,2
ORDER BY vendas DESC
LIMIT 50` },
  { label: "Leads sem venda nos últimos 90 dias", sql: `SELECT l.origem_lead, l.utm_source, COUNT(*) AS leads
FROM fct_lead l
LEFT JOIN bridge_lead_venda b ON b.lead_id = l.lead_id
WHERE b.lead_id IS NULL
  AND l.data_lead >= NOW() - INTERVAL '90 days'
GROUP BY 1,2
ORDER BY leads DESC
LIMIT 50` },
];

function Modelo() {
  const [tab, setTab] = useState<string>("modelo");
  const [explorerBase, setExplorerBase] = useState<string | undefined>(undefined);
  return (
    <>
      <PageHeader title="Modelo de Dados" subtitle="Visualize relacionamentos entre tabelas e execute consultas SQL ad-hoc" tutorialKey="modelo" />
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="modelo"><Database className="size-4 mr-2" />Modelo</TabsTrigger>
          <TabsTrigger value="explorar"><Wand2 className="size-4 mr-2" />Explorar</TabsTrigger>
          <TabsTrigger value="consulta"><Play className="size-4 mr-2" />Consulta SQL</TabsTrigger>
        </TabsList>
        <TabsContent value="modelo">
          <ModelView onOpenExplorer={(name) => { setExplorerBase(name); setTab("explorar"); }} />
        </TabsContent>
        <TabsContent value="explorar"><ExplorerView initialBase={explorerBase} /></TabsContent>
        <TabsContent value="consulta"><SqlExplorer /></TabsContent>
      </Tabs>
    </>
  );
}

// ===== MODEL VIEW =====
const CANVAS_W = 1440;
const CANVAS_H = 760;
const CARD_W = 200;
const HEAD_H = 36;
const ROW_H = 24;

function ModelView({ onOpenExplorer }: { onOpenExplorer?: (name: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem("modelo_positions");
      if (saved) return JSON.parse(saved);
    } catch {}
    return Object.fromEntries(TABLES.map((t) => [t.name, { x: t.x, y: t.y }]));
  });
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showRels, setShowRels] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: "pan" | "table"; name?: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const sel = TABLES.find((t) => t.name === selected);

  const lines = useMemo(() => {
    return RELATIONS.map((r, i) => {
      const [aT, aC] = r.from.split(".");
      const [bT, bC] = r.to.split(".");
      const ta = TABLES.find((t) => t.name === aT)!;
      const tb = TABLES.find((t) => t.name === bT)!;
      const ai = ta.cols.findIndex((c) => c.name === aC);
      const bi = tb.cols.findIndex((c) => c.name === bC);
      const pa = positions[aT] ?? { x: ta.x, y: ta.y };
      const pb = positions[bT] ?? { x: tb.x, y: tb.y };
      const ay = pa.y + HEAD_H + ai * ROW_H + ROW_H / 2;
      const by = pb.y + HEAD_H + bi * ROW_H + ROW_H / 2;
      const aRight = pa.x + CARD_W < pb.x;
      const x1 = aRight ? pa.x + CARD_W : pa.x;
      const x2 = aRight ? pb.x : pb.x + CARD_W;
      const cx = (x1 + x2) / 2;
      return { i, d: `M ${x1} ${ay} C ${cx} ${ay} ${cx} ${by} ${x2} ${by}` };
    });
  }, [positions]);

  function savePositions(p: Record<string, { x: number; y: number }>) {
    setPositions(p);
    try { localStorage.setItem("modelo_positions", JSON.stringify(p)); } catch {}
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 30) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.min(2, Math.max(0.25, z + delta)));
  }

  function onMouseDown(e: React.MouseEvent, tableName?: string) {
    const orig = tableName ? positions[tableName] : pan;
    dragRef.current = {
      type: tableName ? "table" : "pan",
      name: tableName,
      startX: e.clientX,
      startY: e.clientY,
      origX: orig.x,
      origY: orig.y,
    };
    if (tableName) { setSelected(tableName); e.stopPropagation(); }
  }

  useEffect(() => {
    function move(e: MouseEvent) {
      const d = dragRef.current; if (!d) return;
      const dx = (e.clientX - d.startX) / (d.type === "table" ? zoom : 1);
      const dy = (e.clientY - d.startY) / (d.type === "table" ? zoom : 1);
      if (d.type === "pan") setPan({ x: d.origX + dx, y: d.origY + dy });
      else if (d.name) setPositions((p) => ({ ...p, [d.name!]: { x: d.origX + dx, y: d.origY + dy } }));
    }
    function up() {
      const d = dragRef.current;
      if (d?.type === "table") {
        setPositions((p) => { try { localStorage.setItem("modelo_positions", JSON.stringify(p)); } catch {}; return p; });
      }
      dragRef.current = null;
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [zoom]);

  function fit() {
    const vp = viewportRef.current; if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const z = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H, 1);
    setZoom(z);
    setPan({ x: (rect.width - CANVAS_W * z) / 2, y: (rect.height - CANVAS_H * z) / 2 });
  }
  function reset() {
    savePositions(Object.fromEntries(TABLES.map((t) => [t.name, { x: t.x, y: t.y }])));
    setZoom(0.8); setPan({ x: 40, y: 20 });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <Card title="Esquema · scroll p/ zoom · arraste o fundo p/ mover · arraste tabelas p/ reorganizar">
        <div className="relative">
          <div
            ref={viewportRef}
            onWheel={onWheel}
            onMouseDown={(e) => onMouseDown(e)}
            className="relative overflow-hidden rounded-lg bg-[#0c1017] border border-border cursor-grab active:cursor-grabbing select-none"
            style={{ height: 720 }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              {showRels && (
                <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H}>
                  {lines.map((l) => (
                    <path key={l.i} d={l.d} stroke="#475569" strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />
                  ))}
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                    </marker>
                  </defs>
                </svg>
              )}
              {TABLES.map((t) => (
                <TableCard
                  key={t.name}
                  t={t}
                  pos={positions[t.name] ?? { x: t.x, y: t.y }}
                  active={selected === t.name}
                  onMouseDown={(e) => onMouseDown(e, t.name)}
                />
              ))}
            </div>
          </div>
          {/* Toolbar */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/95 backdrop-blur border border-border rounded-md p-1 shadow-lg">
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} title="Zoom out"><ZoomOut className="size-4" /></Button>
            <span className="text-xs font-mono px-2 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Zoom in"><ZoomIn className="size-4" /></Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button size="sm" variant="ghost" onClick={fit} title="Ajustar à tela"><Maximize2 className="size-4" /></Button>
            <Button size="sm" variant="ghost" onClick={reset} title="Resetar layout"><Move className="size-4" /></Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button size="sm" variant={showRels ? "default" : "ghost"} onClick={() => setShowRels((v) => !v)} title="Relações" className="text-xs h-7">Relações</Button>
          </div>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Legenda">
          <ul className="text-xs space-y-1.5">
            <li><span className="inline-block size-2.5 rounded-sm mr-2" style={{ background: "#6366f1" }} />fato (vendas/leads)</li>
            <li><span className="inline-block size-2.5 rounded-sm mr-2" style={{ background: "#10b981" }} />dimensão</li>
            <li><span className="inline-block size-2.5 rounded-sm mr-2" style={{ background: "#f59e0b" }} />bridge</li>
            <li><span className="inline-block size-2.5 rounded-sm mr-2" style={{ background: "#a855f7" }} />view calculada</li>
            <li><span className="inline-block size-2.5 rounded-sm mr-2" style={{ background: "#64748b" }} />raw / origem</li>
          </ul>
          <div className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border space-y-1">
            <div>• <b>Scroll</b> + Ctrl/⌘ para zoom</div>
            <div>• Arraste o <b>fundo</b> para mover</div>
            <div>• Arraste <b>tabelas</b> para reorganizar</div>
          </div>
        </Card>
        {sel ? <TableInspector table={sel} onOpenExplorer={onOpenExplorer} /> : (
          <Card title="Inspetor"><div className="text-xs text-muted-foreground">Clique em uma tabela para ver amostra de dados e contagem.</div></Card>
        )}
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = { fact: "#6366f1", dim: "#10b981", bridge: "#f59e0b", view: "#a855f7", raw: "#64748b" };

function TableCard({ t, pos, active, onMouseDown }: { t: Tbl; pos: { x: number; y: number }; active: boolean; onMouseDown: (e: React.MouseEvent) => void }) {
  const color = KIND_COLOR[t.kind ?? "raw"];
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute rounded-md border bg-[#161b27] text-left shadow-md transition cursor-move ${active ? "ring-2 ring-primary border-primary/50" : "border-border hover:border-primary/40"}`}
      style={{ left: pos.x, top: pos.y, width: CARD_W }}
    >
      <div className="px-3 py-2 text-xs font-semibold border-b border-border flex items-center gap-2" style={{ color }}>
        <span className="size-2 rounded-sm" style={{ background: color }} />
        {t.label}
      </div>
      <ul className="text-[11px]">
        {t.cols.map((c) => (
          <li key={c.name} className="px-3 h-6 flex items-center gap-2 border-b border-border/40 last:border-0">
            <ColIcon type={c.type} />
            <span className="truncate font-mono text-muted-foreground">{c.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ColIcon({ type }: { type: Col["type"] }) {
  const cls = "size-3 text-muted-foreground/70";
  if (type === "key") return <Key className={cls} />;
  if (type === "num") return <Hash className={cls} />;
  if (type === "date") return <Calendar className={cls} />;
  return <Type className={cls} />;
}

function TableInspector({ table, onOpenExplorer }: { table: Tbl; onOpenExplorer?: (n: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancel = false;
    setLoading(true); setRows(null); setCount(null);
    (async () => {
      try {
        const result = await inspectTable({ data: { table: table.name } });
        if (cancel) return;
        setRows((result as any).rows);
        setCount(result.count);
      } catch {
        if (!cancel) { setRows([]); setCount(null); }
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [table.name]);
  return (
    <Card title={`Inspetor · ${table.name}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground">
          {loading ? "Carregando…" : count !== null ? `${fmtNum(count)} linhas` : "—"}
        </div>
        {onOpenExplorer && (
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onOpenExplorer(table.name)}>
            <Wand2 className="size-3.5 mr-1" />Abrir no Explorador
          </Button>
        )}
      </div>
      <div className="text-xs font-mono max-h-72 overflow-auto bg-[#0c1017] rounded p-2 border border-border">
        {rows && rows.length > 0
          ? rows.slice(0, 5).map((r, i) => (
              <div key={i} className="border-b border-border/40 py-1 last:border-0">
                {Object.entries(r).slice(0, 4).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v).slice(0, 60)}</div>
                ))}
              </div>
            ))
          : <span className="text-muted-foreground">sem dados</span>}
      </div>
    </Card>
  );
}

// ===== SQL EXPLORER =====
function SqlExplorer() {
  const [query, setQuery] = useState<string>(SNIPPETS[0].sql);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("sql_history") || "[]")); } catch {}
  }, []);

  async function run() {
    setLoading(true); setError(null); setRows(null);
    try {
      const data = await execReadSql({ data: { query } });
      setRows(Array.isArray(data) ? data : []);
      const h = [query, ...history.filter((s) => s !== query)].slice(0, 20);
      setHistory(h); localStorage.setItem("sql_history", JSON.stringify(h));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "consulta.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <div className="space-y-4">
        <Card title="Snippets">
          <ul className="text-xs space-y-1">
            {SNIPPETS.map((s) => (
              <li key={s.label}>
                <button onClick={() => setQuery(s.sql)} className="text-left w-full hover:text-primary text-muted-foreground py-1">
                  • {s.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Tabelas disponíveis">
          <ul className="text-xs space-y-1 max-h-72 overflow-auto">
            {TABLES.map((t) => (
              <li key={t.name}>
                <button onClick={() => setQuery((s) => s + " " + t.name)} className="text-left w-full hover:text-primary font-mono text-muted-foreground py-0.5">
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {history.length > 0 && (
          <Card title="Histórico">
            <ul className="text-xs space-y-1 max-h-48 overflow-auto">
              {history.map((h, i) => (
                <li key={i}>
                  <button onClick={() => setQuery(h)} className="text-left w-full hover:text-primary text-muted-foreground py-0.5 truncate" title={h}>
                    {h.slice(0, 40)}…
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <Card title="Editor">
          <Textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={10} className="font-mono text-xs" />
          <div className="flex items-center gap-2 mt-3">
            <Button onClick={run} disabled={loading} size="sm">
              <Play className="size-4 mr-1.5" /> {loading ? "Executando…" : "Executar (SELECT/WITH)"}
            </Button>
            <Button onClick={exportCsv} disabled={!rows || rows.length === 0} size="sm" variant="outline">
              <Download className="size-4 mr-1.5" /> CSV
            </Button>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <FileText className="size-3" /> Limite 5.000 linhas · admin only
            </span>
          </div>
          {error && <div className="mt-3 text-xs text-red-400 font-mono bg-red-950/30 border border-red-900 rounded p-2">{error}</div>}
        </Card>
        <Card title={`Resultado · ${rows ? fmtNum(rows.length) + " linhas" : "—"}`}>
          {!rows ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Execute uma consulta para ver os resultados.</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Sem resultados.</div>
          ) : (
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    {cols.map((c) => <th key={c} className="py-2 pr-4 whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {cols.map((c) => (
                        <td key={c} className="py-1.5 pr-4 max-w-[260px] truncate" title={String(r[c] ?? "")}>
                          {r[c] === null ? <span className="text-muted-foreground">null</span> : String(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
