import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtBRLFull, fmtNum, fmtPct, channelColor } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/geografia")({
  head: () => ({
    meta: [
      { title: "Geografia · Febracis MKT" },
      { name: "description", content: "Performance de vendas por estado e cidade." },
    ],
  }),
  component: Geografia,
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
  year?: string | null;
};

type Row = {
  estado: string | null;
  cidade: string | null;
  canal: string;
  valor_convertido: number;
};

const getGeografiaData = createServerFn({ method: "GET" })
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
    if (input.year) conditions.push(sql`EXTRACT(YEAR FROM data_matricula) = ${Number(input.year)}`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`SELECT estado, cidade, canal, valor_convertido FROM vendas_atribuidas ${where} LIMIT 10000`
    );
    return result as unknown as Row[];
  });

function Geografia() {
  const { filters } = useFilters();
  const [sortKey, setSortKey] = useState<"receita" | "vendas" | "ticket">("receita");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [year, setYear] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["geografia-all", filters, year],
    queryFn: () =>
      getGeografiaData({
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
          year,
        },
      }),
  });

  const rows = data ?? [];
  const receitaTotal = rows.reduce((s, r) => s + Number(r.valor_convertido ?? 0), 0) || 1;

  function toggleSort(key: "receita" | "vendas" | "ticket") {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const estadoRows = useMemo(() => {
    const m: Record<string, { vendas: number; receita: number; canalCount: Record<string, number> }> = {};
    for (const r of rows) {
      const k = r.estado || "(sem estado)";
      m[k] = m[k] || { vendas: 0, receita: 0, canalCount: {} };
      m[k].vendas += 1;
      m[k].receita += Number(r.valor_convertido ?? 0);
      m[k].canalCount[r.canal] = (m[k].canalCount[r.canal] ?? 0) + 1;
    }
    return Object.entries(m)
      .map(([estado, v]) => {
        const dom = Object.entries(v.canalCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        return {
          estado,
          vendas: v.vendas,
          receita: v.receita,
          ticket: v.vendas > 0 ? v.receita / v.vendas : 0,
          canal: dom,
          pct: (v.receita / receitaTotal) * 100,
        };
      })
      .sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "desc" ? -diff : diff;
      });
  }, [rows, sortKey, sortDir, receitaTotal]);

  const topCidades = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      if (!r.cidade) continue;
      m[r.cidade] = (m[r.cidade] ?? 0) + Number(r.valor_convertido ?? 0);
    }
    return Object.entries(m)
      .map(([cidade, receita]) => ({ cidade, receita }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10);
  }, [rows]);

  const canalPorEstado = useMemo(() => {
    const canaisSet = new Set<string>();
    const m: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const est = r.estado || "(sem estado)";
      const can = r.canal || "Outro";
      canaisSet.add(can);
      m[est] = m[est] || {};
      m[est][can] = (m[est][can] ?? 0) + Number(r.valor_convertido ?? 0);
    }
    const canais = Array.from(canaisSet).sort();
    return {
      canais,
      rows: Object.entries(m)
        .map(([estado, cMap]) => ({ estado, ...cMap }))
        .sort((a: any, b: any) => {
          const ra = Object.values(a).filter((v) => typeof v === "number").reduce((s: number, v) => s + (v as number), 0);
          const rb = Object.values(b).filter((v) => typeof v === "number").reduce((s: number, v) => s + (v as number), 0);
          return (rb as number) - (ra as number);
        })
        .slice(0, 15),
    };
  }, [rows]);

  const estadoTop = estadoRows.find((_, i) => i === 0);
  const cidadeTop = topCidades[0];

  return (
    <>
      <PageHeader title="Geografia" subtitle="Performance de vendas por estado e cidade" tutorialKey="geografia" />
      <GlobalFilters />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground font-medium">Ano:</span>
        {["2024", "2025", "2026"].map((y) => (
          <button
            key={y}
            onClick={() => setYear(year === y ? null : y)}
            className={`px-3 py-1 text-xs rounded-md border transition ${
              year === y
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            }`}
          >
            {y}
          </button>
        ))}
        {year && (
          <button
            onClick={() => setYear(null)}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Estados ativos"
          value={fmtNum(estadoRows.length)}
          accent="#6366f1"
          loading={isLoading}
        />
        <KpiCard
          label="Estado com maior receita"
          value={estadoTop?.estado ?? "—"}
          hint={estadoTop ? fmtBRLFull(estadoTop.receita) : undefined}
          accent="#8b5cf6"
          loading={isLoading}
        />
        <KpiCard
          label="Cidade com maior receita"
          value={cidadeTop?.cidade ?? "—"}
          hint={cidadeTop ? fmtBRLFull(cidadeTop.receita) : undefined}
          accent="#a78bfa"
          loading={isLoading}
        />
      </div>

      <Card title="Top 10 cidades por receita" className="mb-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCidades} layout="vertical" margin={{ left: 100, right: 20, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
              <YAxis dataKey="cidade" type="category" stroke="#9ca3af" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [fmtBRLFull(Number(v)), "Receita"]}
              />
              <Bar dataKey="receita" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Performance por estado" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Estado</th>
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
                <th className="py-2 pr-4 text-right">ROAS</th>
                <th className="py-2 pr-4 text-right">CPA</th>
                <th className="py-2 pr-4">Canal Dominante</th>
                <th className="py-2 pr-4 text-right">% Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">Carregando…</td></tr>
              )}
              {estadoRows.map((r) => (
                <tr key={r.estado} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition">
                  <td className="py-2.5 pr-4 font-medium">{r.estado}</td>
                  <td className="py-2.5 pr-4 text-right">{fmtNum(r.vendas)}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{fmtBRLFull(r.receita)}</td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtBRL(r.ticket)}</td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">—</td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">—</td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-sm" style={{ background: channelColor(r.canal) }} />
                      {r.canal}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtPct(r.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Receita por canal × estado (top 15 estados)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-3 min-w-[80px]">Estado</th>
                {canalPorEstado.canais.map((c) => (
                  <th key={c} className="py-2 pr-3 text-right whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">
                      <span className="size-2 rounded-sm" style={{ background: channelColor(c) }} />
                      {c}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canalPorEstado.rows.map((r: any) => (
                <tr key={r.estado} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition">
                  <td className="py-2 pr-3 font-medium">{r.estado}</td>
                  {canalPorEstado.canais.map((c) => (
                    <td key={c} className="py-2 pr-3 text-right text-muted-foreground">
                      {r[c] ? fmtBRL(r[c]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
