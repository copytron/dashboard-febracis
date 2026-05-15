import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtBRLFull, fmtNum, fmtPct, channelColor } from "@/lib/format";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/utms")({
  head: () => ({
    meta: [
      { title: "UTMs · Febracis MKT" },
      { name: "description", content: "Análise completa de UTMs: campanha, conteúdo, origem e mídia." },
    ],
  }),
  component: Utms,
});

const UTM_TABS = [
  { key: "utm_campanha", label: "Campanha" },
  { key: "utm_conteudo", label: "Conteúdo" },
  { key: "utm_origem", label: "Origem (source)" },
  { key: "utm_midia", label: "Mídia (medium)" },
  { key: "utm_termo", label: "Termo" },
  { key: "utm_src", label: "SRC (Setor)" },
] as const;

type UtmKey = (typeof UTM_TABS)[number]["key"];

type FiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  turmas?: string[];
  estados?: string[];
  canais?: string[];
  cursos?: string[];
  unidadesGeradoras?: string[];
  utmSrc?: string[];
  canaisVenda?: string[];
  modalidades?: string[];
  fases?: string[];
};

type Row = {
  canal: string;
  vendas: number;
  receita: number;
  utm_campanha: string | null;
  utm_conteudo: string | null;
  utm_origem: string | null;
  utm_midia: string | null;
  utm_termo: string | null;
  utm_src: string | null;
};

const getUtmsData = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_matricula >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_matricula <= ${input.dateTo}`);
    if (input.turmas?.length) conditions.push(sql`turma IN (${sql.join(input.turmas.map(v => sql`${v}`), sql`, `)})`);
    if (input.estados?.length) conditions.push(sql`estado IN (${sql.join(input.estados.map(v => sql`${v}`), sql`, `)})`);
    if (input.canais?.length) conditions.push(sql`canal IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    if (input.cursos?.length) conditions.push(sql`curso IN (${sql.join(input.cursos.map(v => sql`${v}`), sql`, `)})`);
    if (input.unidadesGeradoras?.length) conditions.push(sql`unidade_geradora IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)})`);
    if (input.utmSrc?.length) conditions.push(sql`utm_src IN (${sql.join(input.utmSrc.map(v => sql`${v}`), sql`, `)})`);
    if (input.canaisVenda?.length) conditions.push(sql`canal_venda IN (${sql.join(input.canaisVenda.map(v => sql`${v}`), sql`, `)})`);
    if (input.modalidades?.length) conditions.push(sql`modalidade IN (${sql.join(input.modalidades.map(v => sql`${v}`), sql`, `)})`);
    if (input.fases?.length) conditions.push(sql`fase IN (${sql.join(input.fases.map(v => sql`${v}`), sql`, `)})`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`SELECT canal, utm_campanha, utm_conteudo, utm_origem, utm_midia, utm_termo, utm_src, COUNT(*)::int AS vendas, COALESCE(SUM(receita_convertida_brl), 0)::numeric AS receita FROM vendas_atribuidas ${where} GROUP BY canal, utm_campanha, utm_conteudo, utm_origem, utm_midia, utm_termo, utm_src`
    );
    return result as unknown as Row[];
  });

function Utms() {
  const { filters } = useFilters();
  const [activeTab, setActiveTab] = useState<UtmKey>("utm_campanha");
  const [sortKey, setSortKey] = useState<"receita" | "vendas" | "ticket">("receita");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["utms-all", filters],
    queryFn: () =>
      getUtmsData({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          turmas: filters.turmas,
          estados: filters.estados,
          canais: filters.canais,
          cursos: filters.cursos,
          unidadesGeradoras: filters.unidadesGeradoras,
          utmSrc: filters.utmSrc,
          canaisVenda: filters.canaisVenda,
          modalidades: filters.modalidades,
          fases: filters.fases,
        },
      }),
  });

  const rows = data ?? [];
  const receitaTotal = rows.reduce((s, r) => s + Number(r.receita ?? 0), 0) || 1;

  function toggleSort(key: "receita" | "vendas" | "ticket") {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const tableRows = useMemo(() => {
    const m: Record<string, { canal: string; vendas: number; receita: number; canalCount: Record<string, number> }> = {};
    for (const r of rows) {
      const val = r[activeTab];
      if (!val) continue;
      m[val] = m[val] || { canal: r.canal, vendas: 0, receita: 0, canalCount: {} };
      m[val].vendas += r.vendas;
      m[val].receita += Number(r.receita ?? 0);
      m[val].canalCount[r.canal] = (m[val].canalCount[r.canal] ?? 0) + r.vendas;
    }
    return Object.entries(m)
      .map(([key, v]) => {
        const dom = Object.entries(v.canalCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        return {
          key,
          canal: dom,
          vendas: v.vendas,
          receita: v.receita,
          ticket: v.vendas > 0 ? v.receita / v.vendas : 0,
          pct: (v.receita / receitaTotal) * 100,
        };
      })
      .sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "desc" ? -diff : diff;
      });
  }, [rows, activeTab, sortKey, sortDir, receitaTotal]);

  const exportCsv = () => {
    const headers = ["utm_valor", "canal_dominante", "vendas", "receita", "ticket", "pct_receita"];
    const csv = [
      headers.join(","),
      ...tableRows.map((r) =>
        [`"${r.key}"`, `"${r.canal}"`, r.vendas, r.receita.toFixed(2), r.ticket.toFixed(2), r.pct.toFixed(2)].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `utms-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="UTMs" subtitle="Análise completa por parâmetros de rastreamento" tutorialKey="utms" />
      <GlobalFilters />

      <div className="flex flex-wrap gap-2 mb-6">
        {UTM_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-4 py-2 rounded-md text-xs font-medium border transition",
              activeTab === t.key
                ? "bg-card border-primary/40 text-foreground"
                : "bg-card/40 border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">
            {UTM_TABS.find((t) => t.key === activeTab)?.label} — {fmtNum(tableRows.length)} valores únicos
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-8 text-xs">
            <Download className="size-3.5 mr-1.5" /> Exportar CSV
          </Button>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Valor UTM</th>
                <th className="py-2 pr-4">Canal Dominante</th>
                <th
                  className="py-2 pr-4 text-right cursor-pointer select-none hover:text-foreground transition"
                  onClick={() => toggleSort("vendas")}
                >
                  Vendas {sortKey === "vendas" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th
                  className="py-2 pr-4 text-right cursor-pointer select-none hover:text-foreground transition"
                  onClick={() => toggleSort("receita")}
                >
                  Receita {sortKey === "receita" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th
                  className="py-2 pr-4 text-right cursor-pointer select-none hover:text-foreground transition"
                  onClick={() => toggleSort("ticket")}
                >
                  Ticket {sortKey === "ticket" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="py-2 pr-4 text-right">% Receita</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">Carregando…</td></tr>
              )}
              {!isLoading && tableRows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">Nenhum registro com este UTM preenchido</td></tr>
              )}
              {tableRows.map((r) => (
                <tr key={r.key} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition">
                  <td className="py-2.5 pr-4 font-medium max-w-[320px] truncate" title={r.key}>{r.key}</td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-sm" style={{ background: channelColor(r.canal) }} />
                      {r.canal}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">{fmtNum(r.vendas)}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{fmtBRLFull(r.receita)}</td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtBRL(r.ticket)}</td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtPct(r.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{fmtNum(tableRows.length)} valores únicos · {fmtNum(rows.filter((r) => r[activeTab]).reduce((s, r) => s + r.vendas, 0))} vendas com este UTM preenchido</div>
      </Card>
    </>
  );
}
