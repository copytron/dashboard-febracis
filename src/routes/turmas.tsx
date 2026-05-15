import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtBRLFull, fmtNum, fmtPct, channelColor, TIPO_BADGE } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/turmas")({
  head: () => ({
    meta: [
      { title: "Turmas · Febracis MKT" },
      { name: "description", content: "Comparação de performance entre turmas." },
    ],
  }),
  component: Turmas,
});

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
  turma: string;
  canal: string;
  estado: string | null;
  utm_campanha: string | null;
  vendas: number;
  receita: number;
};

const getTurmasData = createServerFn({ method: "GET" })
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
    conditions.push(sql`turma IS NOT NULL`);
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    const result = await db.execute(
      sql`SELECT turma, canal, estado, utm_campanha, COUNT(*)::int AS vendas, COALESCE(SUM(receita_convertida_brl), 0)::numeric AS receita FROM vendas_atribuidas ${where} GROUP BY turma, canal, estado, utm_campanha`
    );
    return result as unknown as Row[];
  });

function parseTurma(t: string): { cidade: string } {
  // Format: "2026 - CIS248 - São Paulo"
  const parts = t.split(" - ");
  const cidade = parts.slice(2).join(" - ").trim() || parts[1]?.trim() || "";
  return { cidade };
}

function Turmas() {
  const { filters } = useFilters();
  const [cidadeFilter, setCidadeFilter] = useState<string>("");
  const [openTurma, setOpenTurma] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"receita" | "vendas" | "ticket">("receita");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: "receita" | "vendas" | "ticket") {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["turmas-all", filters],
    queryFn: () =>
      getTurmasData({
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

  const turmas = useMemo(() => {
    const m: Record<string, { vendas: number; receita: number; canalCount: Record<string, number> }> = {};
    for (const r of rows) {
      const k = r.turma || "(sem turma)";
      m[k] = m[k] || { vendas: 0, receita: 0, canalCount: {} };
      m[k].vendas += r.vendas;
      m[k].receita += Number(r.receita);
      m[k].canalCount[r.canal] = (m[k].canalCount[r.canal] ?? 0) + r.vendas;
    }
    return Object.entries(m)
      .map(([turma, v]) => {
        const { cidade } = parseTurma(turma);
        const dom = Object.entries(v.canalCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        return {
          turma,
          cidade,
          vendas: v.vendas,
          receita: v.receita,
          ticket: v.vendas > 0 ? v.receita / v.vendas : 0,
          canal: dom,
        };
      })
      .filter((t) => (cidadeFilter ? t.cidade.toLowerCase().includes(cidadeFilter.toLowerCase()) : true))
      .sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "desc" ? -diff : diff;
      });
  }, [rows, cidadeFilter]);

  const detail = useMemo(() => {
    if (!openTurma) return null;
    const sub = rows.filter((r) => r.turma === openTurma);
    const canalMap: Record<string, number> = {};
    const campMap: Record<string, number> = {};
    const estadoMap: Record<string, number> = {};
    let totalVendas = 0;
    let totalReceita = 0;
    for (const r of sub) {
      totalVendas += r.vendas;
      totalReceita += Number(r.receita);
      canalMap[r.canal] = (canalMap[r.canal] ?? 0) + Number(r.receita);
      if (r.utm_campanha) campMap[r.utm_campanha] = (campMap[r.utm_campanha] ?? 0) + Number(r.receita);
      if (r.estado) estadoMap[r.estado] = (estadoMap[r.estado] ?? 0) + r.vendas;
    }
    return {
      total: totalVendas,
      receita: totalReceita,
      canais: Object.entries(canalMap).map(([k, v]) => ({ canal: k, receita: v })).sort((a, b) => b.receita - a.receita),
      tipos: [],
      campanhas: Object.entries(campMap).map(([k, v]) => ({ key: k, receita: v })).sort((a, b) => b.receita - a.receita).slice(0, 5),
      estados: Object.entries(estadoMap).map(([k, v]) => ({ estado: k, vendas: v })).sort((a, b) => b.vendas - a.vendas),
    };
  }, [openTurma, rows]);

  return (
    <>
      <PageHeader title="Turmas" subtitle="Comparativo de performance por coorte" tutorialKey="turmas" />
      <GlobalFilters />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="text-xs text-muted-foreground">Filtros locais:</div>
          <Input
            placeholder="Buscar cidade..."
            value={cidadeFilter}
            onChange={(e) => setCidadeFilter(e.target.value)}
            className="h-9 w-[200px] text-xs bg-card"
          />
          <span className="text-xs text-muted-foreground ml-auto">{turmas.length} turmas</span>
        </div>
      </Card>

      <Card title="Todas as turmas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Turma</th>
                <th className="py-2 pr-4">Cidade</th>
                <th className="py-2 pr-4 text-right cursor-pointer select-none hover:text-foreground transition" onClick={() => toggleSort("vendas")}>
                  Vendas {sortKey === "vendas" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="py-2 pr-4 text-right cursor-pointer select-none hover:text-foreground transition" onClick={() => toggleSort("receita")}>
                  Receita {sortKey === "receita" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="py-2 pr-4 text-right cursor-pointer select-none hover:text-foreground transition" onClick={() => toggleSort("ticket")}>
                  Ticket {sortKey === "ticket" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="py-2 pr-4">Canal Dominante</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">Carregando…</td></tr>
              )}
              {turmas.map((t) => (
                <tr
                  key={t.turma}
                  onClick={() => setOpenTurma(t.turma)}
                  className="border-b border-border/40 last:border-0 cursor-pointer hover:bg-accent/40 transition"
                >
                  <td className="py-3 pr-4 font-medium">{t.turma}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{t.cidade}</td>
                  <td className="py-3 pr-4 text-right">{fmtNum(t.vendas)}</td>
                  <td className="py-3 pr-4 text-right font-semibold">{fmtBRLFull(t.receita)}</td>
                  <td className="py-3 pr-4 text-right text-muted-foreground">{fmtBRL(t.ticket)}</td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-sm" style={{ background: channelColor(t.canal) }} />
                      {t.canal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!openTurma} onOpenChange={(o) => !o && setOpenTurma(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>{openTurma}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Vendas</div>
                  <div className="text-lg font-semibold">{fmtNum(detail.total)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Receita</div>
                  <div className="text-lg font-semibold">{fmtBRLFull(detail.receita)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Distribuição de canais
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detail.canais} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                      <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRL(v)} />
                      <YAxis dataKey="canal" type="category" stroke="#9ca3af" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip
                        contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any) => [fmtBRLFull(Number(v)), "Receita"]}
                      />
                      <Bar dataKey="receita" radius={[0, 4, 4, 0]}>
                        {detail.canais.map((c) => (
                          <Cell key={c.canal} fill={channelColor(c.canal)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Atribuição
                  </div>
                  <div className="space-y-1.5">
                    {detail.tipos.map((t) => (
                      <div key={t.tipo} className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded ${TIPO_BADGE[t.tipo] ?? ""}`}>{t.tipo}</span>
                        <span className="text-muted-foreground">{fmtNum(t.vendas)} · {fmtPct(t.pct)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Top estados
                  </div>
                  <div className="space-y-1 text-xs">
                    {detail.estados.slice(0, 5).map((e) => (
                      <div key={e.estado} className="flex items-center justify-between">
                        <span>{e.estado}</span>
                        <span className="text-muted-foreground">{fmtNum(e.vendas)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Top 5 campanhas
                </div>
                <div className="space-y-1.5 text-xs">
                  {detail.campanhas.length === 0 && (
                    <div className="text-muted-foreground">Sem campanhas com UTM</div>
                  )}
                  {detail.campanhas.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-3">
                      <span className="truncate">{c.key}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{fmtBRL(c.receita)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
