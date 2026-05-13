import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtBRLFull, fmtNum, fmtPct, channelColor } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/canais")({
  head: () => ({
    meta: [
      { title: "Canais · Febracis MKT" },
      { name: "description", content: "Performance detalhada por canal de marketing." },
    ],
  }),
  component: Canais,
});

type FiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  turmas?: string[];
  estados?: string[];
  canais?: string[];
};

type BreakdownRow = {
  canal: string;
  vendas: number;
  receita: number;
  ticket: number;
};

type LeadsCountRow = {
  canal: string;
  leads: number;
};

type DetailRow = {
  canal: string;
  valor_convertido: number;
  utm_campanha: string | null;
  utm_conteudo: string | null;
  data_matricula: string | null;
};

const getCanaisBreakdown = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_matricula >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_matricula <= ${input.dateTo}`);
    if (input.turmas?.length) conditions.push(sql`turma = ANY(${input.turmas})`);
    if (input.estados?.length) conditions.push(sql`estado = ANY(${input.estados})`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`
        SELECT
          canal,
          COUNT(*)::int AS vendas,
          SUM(valor_convertido) AS receita,
          CASE WHEN COUNT(*) > 0 THEN SUM(valor_convertido) / COUNT(*) ELSE 0 END AS ticket
        FROM vendas_atribuidas
        ${where}
        GROUP BY canal
        ORDER BY receita DESC
      `
    );
    return result as unknown as BreakdownRow[];
  });

const getCanaisLeadsCount = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`(data->>'data_lead')::date >= ${input.dateFrom}::date`);
    if (input.dateTo) conditions.push(sql`(data->>'data_lead')::date <= ${input.dateTo}::date`);
    const where = conditions.length > 0
      ? sql`AND ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`
        SELECT
          derive_canal_dynamic(
            data->>'ultima_origem_lead',
            data->>'origem_lead',
            data->>'utm_source',
            data->>'utm_medium',
            data->>'utm_campaign'
          ) AS canal,
          COUNT(*)::int AS leads
        FROM planilha_leads
        WHERE data->>'email' IS NOT NULL AND data->>'email' <> ''
        ${where}
        GROUP BY 1
      `
    );
    return result as unknown as LeadsCountRow[];
  });

type DetailInput = FiltersInput & { canal?: string };

const getCanaisDetail = createServerFn({ method: "GET" })
  .inputValidator((input: DetailInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_matricula >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_matricula <= ${input.dateTo}`);
    if (input.turmas?.length) conditions.push(sql`turma = ANY(${input.turmas})`);
    if (input.estados?.length) conditions.push(sql`estado = ANY(${input.estados})`);
    if (input.canal && input.canal !== "Todos") conditions.push(sql`canal = ${input.canal}`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`SELECT canal, valor_convertido, utm_campanha, utm_conteudo, data_matricula FROM vendas_atribuidas ${where} LIMIT 10000`
    );
    return result as unknown as DetailRow[];
  });

function Canais() {
  const { filters } = useFilters();
  const [canal, setCanal] = useState<string>("Todos");

  const { data: breakdown, isLoading: loadingBreak } = useQuery({
    queryKey: ["canais-breakdown", filters],
    queryFn: () =>
      getCanaisBreakdown({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          turmas: filters.turmas,
          estados: filters.estados,
        },
      }),
  });

  const { data: leadsBreakdown } = useQuery({
    queryKey: ["canais-leads", filters],
    queryFn: () =>
      getCanaisLeadsCount({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
      }),
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["canais-detail", canal, filters],
    queryFn: () =>
      getCanaisDetail({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          turmas: filters.turmas,
          estados: filters.estados,
          canal,
        },
      }),
  });

  const data = rows ?? [];
  const bk = breakdown ?? [];
  const leadsMap = Object.fromEntries((leadsBreakdown ?? []).map((r) => [r.canal, Number(r.leads)]));
  const totalVendas = bk.reduce((s, r) => s + Number(r.vendas), 0);
  const totalReceita = bk.reduce((s, r) => s + Number(r.receita), 0);
  const ticketGeral = totalVendas > 0 ? totalReceita / totalVendas : 0;
  const totalLeads = Object.values(leadsMap).reduce((s, v) => s + v, 0);

  const isAll = canal === "Todos";
  const sel = bk.find((r) => r.canal === canal);
  const vendasSel = isAll ? totalVendas : Number(sel?.vendas ?? 0);
  const receitaSel = isAll ? totalReceita : Number(sel?.receita ?? 0);
  const ticketSel = vendasSel > 0 ? receitaSel / vendasSel : 0;
  const pctSel = totalReceita > 0 ? (receitaSel / totalReceita) * 100 : 0;
  const leadsSel = isAll ? totalLeads : (leadsMap[canal] ?? 0);

  const aggBy = (key: string) => {
    const m: Record<string, { vendas: number; receita: number }> = {};
    for (const r of data) {
      const k = (r as any)[key] || "(sem valor)";
      m[k] = m[k] || { vendas: 0, receita: 0 };
      m[k].vendas += 1;
      m[k].receita += Number(r.valor_convertido ?? 0);
    }
    return Object.entries(m)
      .map(([k, v]) => ({ key: k, vendas: v.vendas, receita: v.receita, ticket: v.vendas > 0 ? v.receita / v.vendas : 0 }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 20);
  };

  const campanhas = aggBy("utm_campanha");
  const conteudos = aggBy("utm_conteudo");

  const monthly: Record<string, number> = {};
  for (const r of data) {
    if (!r.data_matricula) continue;
    const m = String(r.data_matricula).slice(0, 7);
    monthly[m] = (monthly[m] ?? 0) + Number(r.valor_convertido ?? 0);
  }
  const trend = Object.entries(monthly).sort().map(([m, v]) => ({ mes: m, receita: v }));

  const accent = isAll ? "#6366f1" : channelColor(canal);

  return (
    <>
      <PageHeader title="Canais" subtitle="Performance detalhada por canal de marketing" tutorialKey="canais" />
      <GlobalFilters />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label={isAll ? "Vendas Totais" : "Vendas"} value={fmtNum(vendasSel)} loading={loadingBreak} accent={accent} />
        <KpiCard label={isAll ? "Leads Totais" : "Leads"} value={fmtNum(leadsSel)} loading={loadingBreak} accent={accent} />
        <KpiCard
          label={isAll ? "Receita Total" : "Receita"}
          value={fmtBRLFull(receitaSel)}
          hint={!isAll ? `${fmtPct(pctSel)} do total` : undefined}
          loading={loadingBreak}
          accent={accent}
        />
        <KpiCard label={isAll ? "Ticket Médio Geral" : "Ticket Médio"} value={fmtBRLFull(isAll ? ticketGeral : ticketSel)} loading={loadingBreak} accent={accent} />
      </div>

      {/* Tabela de canais — sempre visível, clicável */}
      <Card title="Canais" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Canal</th>
                <th className="py-2 pr-4 text-right">Leads</th>
                <th className="py-2 pr-4 text-right">Vendas</th>
                <th className="py-2 pr-4 text-right">Receita</th>
                <th className="py-2 pr-4 text-right">Ticket Médio</th>
                <th className="py-2 pr-4 text-right">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Linha "Todos" */}
              <tr
                onClick={() => setCanal("Todos")}
                className={cn(
                  "border-b border-border/50 cursor-pointer transition hover:bg-accent/20",
                  isAll && "bg-accent/30",
                )}
              >
                <td className="py-3 pr-4 font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: "#6366f1" }} />
                    Todos
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">{fmtNum(totalLeads)}</td>
                <td className="py-3 pr-4 text-right">{fmtNum(totalVendas)}</td>
                <td className="py-3 pr-4 text-right font-semibold">{fmtBRLFull(totalReceita)}</td>
                <td className="py-3 pr-4 text-right">{fmtBRLFull(ticketGeral)}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">100%</td>
              </tr>
              {bk.map((r) => {
                const pct = totalReceita > 0 ? (Number(r.receita) / totalReceita) * 100 : 0;
                const selected = canal === r.canal;
                return (
                  <tr
                    key={r.canal}
                    onClick={() => setCanal(r.canal)}
                    className={cn(
                      "border-b border-border/50 last:border-0 cursor-pointer transition hover:bg-accent/20",
                      selected && "bg-accent/30",
                    )}
                  >
                    <td className="py-3 pr-4 font-medium">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-sm" style={{ background: channelColor(r.canal) }} />
                        {r.canal}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">{fmtNum(leadsMap[r.canal] ?? 0)}</td>
                    <td className="py-3 pr-4 text-right">{fmtNum(Number(r.vendas))}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmtBRLFull(Number(r.receita))}</td>
                    <td className="py-3 pr-4 text-right">{fmtBRLFull(Number(r.ticket))}</td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: channelColor(r.canal) }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{fmtPct(pct)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {isAll && (
        <Card title="Receita por canal" className="mb-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bk} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis dataKey="canal" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
                <Tooltip
                  cursor={{ fill: "#ffffff08" }}
                  contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [fmtBRLFull(Number(v)), "Receita"]}
                />
                <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                  {bk.map((c) => (
                    <Cell key={c.canal} fill={channelColor(c.canal)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Tendência mensal" className="mb-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="mes" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
              <Tooltip
                contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [fmtBRLFull(Number(v)), "Receita"]}
              />
              <Line type="monotone" dataKey="receita" stroke={accent} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RankTable title="Top campanhas (utm_campanha)" rows={campanhas} loading={isLoading} />
        <RankTable title="Top conteúdos (utm_conteudo)" rows={conteudos} loading={isLoading} />
      </div>
    </>
  );
}

function RankTable({ title, rows, loading }: { title: string; rows: { key: string; vendas: number; receita: number; ticket: number }[]; loading?: boolean }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="py-2 pr-4">Item</th>
              <th className="py-2 pr-4 text-right">Vendas</th>
              <th className="py-2 pr-4 text-right">Receita</th>
              <th className="py-2 pr-4 text-right">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                  Sem dados
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-4 max-w-[260px] truncate" title={r.key}>{r.key}</td>
                <td className="py-2 pr-4 text-right">{fmtNum(r.vendas)}</td>
                <td className="py-2 pr-4 text-right font-medium">{fmtBRL(r.receita)}</td>
                <td className="py-2 pr-4 text-right text-muted-foreground">{fmtBRL(r.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
