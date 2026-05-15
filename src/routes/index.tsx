import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { channelColor, fmtBRL, fmtBRLFull, fmtNum, fmtPct } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral · Febracis MKT" },
      { name: "description", content: "Visão geral da atribuição de marketing Febracis." },
    ],
  }),
  component: Overview,
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
  canal: string;
  tipo_atribuicao: string;
  valor_convertido: number;
  data_matricula: string | null;
  estado: string | null;
};

const getOverviewData = createServerFn({ method: "GET" })
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
      sql`SELECT canal, tipo_atribuicao, valor_convertido, data_matricula, estado FROM vendas_atribuidas ${where} LIMIT 10000`
    );
    return result as unknown as Row[];
  });

function Overview() {
  const { filters } = useFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["overview", filters],
    queryFn: () =>
      getOverviewData({
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

  // Aggregations — vendas_atribuidas is the complete set (sem_atribuicao is a subset, not additive)
  const totalVendas = rows.length;
  const receitaTotal = rows.reduce((s, r) => s + Number(r.valor_convertido ?? 0), 0);
  const ticket = totalVendas > 0 ? receitaTotal / totalVendas : 0;

  const tipoMap: Record<string, { vendas: number; receita: number }> = {};
  const canalMap: Record<string, { vendas: number; receita: number; tipo: string }> = {};
  for (const r of rows) {
    const t = r.tipo_atribuicao || "Sem Atribuição";
    tipoMap[t] = tipoMap[t] || { vendas: 0, receita: 0 };
    tipoMap[t].vendas += 1;
    tipoMap[t].receita += Number(r.valor_convertido ?? 0);

    const c = r.canal || "Outros";
    canalMap[c] = canalMap[c] || { vendas: 0, receita: 0, tipo: t };
    canalMap[c].vendas += 1;
    canalMap[c].receita += Number(r.valor_convertido ?? 0);
  }

  const identificadas =
    (tipoMap["Lead Anterior"]?.vendas ?? 0) +
    (tipoMap["Lead Posterior"]?.vendas ?? 0) +
    (tipoMap["UTM Direta"]?.vendas ?? 0);
  const pctIdent = totalVendas > 0 ? (identificadas / totalVendas) * 100 : 0;

  const canalRows = Object.entries(canalMap)
    .map(([canal, v]) => ({
      canal,
      vendas: v.vendas,
      receita: v.receita,
      ticket: v.vendas > 0 ? v.receita / v.vendas : 0,
      pct: receitaTotal > 0 ? (v.receita / receitaTotal) * 100 : 0,
      tipo: v.tipo,
    }))
    .sort((a, b) => b.receita - a.receita);

  const tipoRows = Object.entries(tipoMap).map(([tipo, v]) => ({
    name: tipo,
    value: v.vendas,
    receita: v.receita,
  }));

  const tipoColors: Record<string, string> = {
    "Lead Anterior": "#4ade80",
    "Lead Posterior": "#f59e0b",
    "UTM Direta": "#818cf8",
    "Sem Atribuição": "#f87171",
  };

  const monthlyTrend = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      if (!r.data_matricula) continue;
      const mes = String(r.data_matricula).slice(0, 7);
      m[mes] = (m[mes] ?? 0) + Number(r.valor_convertido ?? 0);
    }
    return Object.entries(m).sort().map(([mes, receita]) => ({ mes, receita }));
  }, [rows]);


  return (
    <>
      <PageHeader
        title="Visão Geral"
        subtitle="Atribuição last-click de vendas Febracis"
        tutorialKey="visao-geral"
      />
      <GlobalFilters />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Receita Total" value={fmtBRLFull(receitaTotal)} accent="#6366f1" loading={isLoading} />
        <KpiCard label="Total de Vendas" value={fmtNum(totalVendas)} accent="#8b5cf6" loading={isLoading} />
        <KpiCard label="Ticket Médio" value={fmtBRLFull(ticket)} accent="#a78bfa" loading={isLoading} />
        <KpiCard
          label="Atribuição Identificada"
          value={
            <span className="flex items-center gap-2">
              {fmtPct(pctIdent)}
              <span className="text-[10px] text-muted-foreground">{fmtNum(identificadas)}/{fmtNum(totalVendas)}</span>
            </span>
          }
          accent="#4ade80"
          loading={isLoading}
        />
        <KpiCard label="Total Leads" value="—" accent="#22d3ee" loading={false} />
        <KpiCard label="Investimento" value="—" accent="#f59e0b" loading={false} />
        <KpiCard label="ROAS" value="—" accent="#10b981" loading={false} />
        <KpiCard label="CPA" value="—" accent="#f43f5e" loading={false} />
      </div>

      <Card title="Cobertura de atribuição" className="mb-6">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
          {canalRows.map((c) => (
            <div
              key={c.canal}
              style={{
                width: `${c.pct}%`,
                background: channelColor(c.canal),
              }}
              title={`${c.canal}: ${fmtPct(c.pct)}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
          {canalRows.map((c) => (
            <div key={c.canal} className="flex items-center gap-2 text-xs">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: channelColor(c.canal) }}
              />
              <span className="text-foreground font-medium">{c.canal}</span>
              <span className="text-muted-foreground">{fmtPct(c.pct)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tendência de receita mensal" className="mb-6">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="mes" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
              <Tooltip
                contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [fmtBRLFull(Number(v)), "Receita"]}
              />
              <Line type="monotone" dataKey="receita" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title="Receita por Canal" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={canalRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis dataKey="canal" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
                <Tooltip
                  cursor={{ fill: "#ffffff08" }}
                  contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [fmtBRLFull(Number(v)), "Receita"]}
                />
                <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                  {canalRows.map((c) => (
                    <Cell key={c.canal} fill={channelColor(c.canal)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Tipo de Atribuição">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tipoRows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {tipoRows.map((t) => (
                    <Cell key={t.name} fill={tipoColors[t.name] ?? "#6b7280"} />
                  ))}
                  <Label
                    content={({ viewBox }: any) => {
                      const { cx, cy } = viewBox;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} dy="-0.4em" fontSize="18" fontWeight="600" fill="#f1f5f9">{fmtNum(totalVendas)}</tspan>
                          <tspan x={cx} dy="1.4em" fontSize="11" fill="#9ca3af">vendas</tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, n: any) => [fmtNum(Number(v)), n]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {tipoRows.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: tipoColors[t.name] ?? "#6b7280" }} />
                  {t.name}
                </span>
                <span className="text-muted-foreground">
                  {fmtNum(t.value)} · {fmtPct(totalVendas > 0 ? (t.value / totalVendas) * 100 : 0)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </>
  );
}
