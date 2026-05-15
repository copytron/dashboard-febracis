import { createFileRoute } from "@tanstack/react-router";
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildConditions(input: FiltersInput): SQL[] {
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
  return conditions;
}

function buildWhere(conditions: SQL[]): SQL {
  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
}

// ─── Server Functions ───────────────────────────────────────────────────────────

type OverviewData = {
  kpis: { total_vendas: number; receita_total: number; receita_convertida: number; identificadas: number };
  byCanal: { canal: string; vendas: number; receita: number }[];
  byTipo: { tipo: string; vendas: number; receita: number }[];
  trend: { mes: string; receita: number }[];
};

const getOverviewData = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }): Promise<OverviewData> => {
    const where = buildWhere(buildConditions(input));

    // Todas as queries em paralelo
    const [kpisResult, canalResult, tipoResult, trendResult] = await Promise.all([
      // KPIs agregados
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_vendas,
          COALESCE(SUM(valor_convertido), 0)::numeric AS receita_total,
          COALESCE(SUM(receita_convertida_brl), 0)::numeric AS receita_convertida,
          COUNT(*) FILTER (WHERE tipo_atribuicao IN ('Lead Anterior', 'Lead Posterior', 'UTM Direta'))::int AS identificadas
        FROM vendas_atribuidas ${where}
      `),
      // Breakdown por canal
      db.execute(sql`
        SELECT
          COALESCE(canal, 'Outros') AS canal,
          COUNT(*)::int AS vendas,
          COALESCE(SUM(receita_convertida_brl), 0)::numeric AS receita
        FROM vendas_atribuidas ${where}
        GROUP BY canal ORDER BY receita DESC
      `),
      // Breakdown por tipo de atribuição
      db.execute(sql`
        SELECT
          COALESCE(tipo_atribuicao, 'Sem Atribuição') AS tipo,
          COUNT(*)::int AS vendas,
          COALESCE(SUM(receita_convertida_brl), 0)::numeric AS receita
        FROM vendas_atribuidas ${where}
        GROUP BY tipo_atribuicao
      `),
      // Tendência mensal
      (() => {
        const trendConditions = [...buildConditions(input), sql`data_matricula IS NOT NULL`];
        const trendWhere = buildWhere(trendConditions);
        return db.execute(sql`
          SELECT
            TO_CHAR(data_matricula, 'YYYY-MM') AS mes,
            COALESCE(SUM(receita_convertida_brl), 0)::numeric AS receita
          FROM vendas_atribuidas ${trendWhere}
          GROUP BY TO_CHAR(data_matricula, 'YYYY-MM')
          ORDER BY mes
        `);
      })(),
    ]);

    const kpi = (kpisResult as any[])[0] ?? {};
    return {
      kpis: {
        total_vendas: Number(kpi.total_vendas ?? 0),
        receita_total: Number(kpi.receita_total ?? 0),
        receita_convertida: Number(kpi.receita_convertida ?? 0),
        identificadas: Number(kpi.identificadas ?? 0),
      },
      byCanal: (canalResult as any[]).map(r => ({
        canal: r.canal,
        vendas: Number(r.vendas),
        receita: Number(r.receita),
      })),
      byTipo: (tipoResult as any[]).map(r => ({
        tipo: r.tipo,
        vendas: Number(r.vendas),
        receita: Number(r.receita),
      })),
      trend: (trendResult as any[]).map(r => ({
        mes: r.mes,
        receita: Number(r.receita),
      })),
    };
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

  const { kpis, byCanal, byTipo, trend } = data ?? {
    kpis: { total_vendas: 0, receita_total: 0, receita_convertida: 0, identificadas: 0 },
    byCanal: [],
    byTipo: [],
    trend: [],
  };

  const totalVendas = kpis.total_vendas;
  const receitaTotal = kpis.receita_total;
  const receitaConvertida = kpis.receita_convertida;
  const identificadas = kpis.identificadas;
  const pctIdent = totalVendas > 0 ? (identificadas / totalVendas) * 100 : 0;

  const receitaTotalCanais = byCanal.reduce((s, c) => s + c.receita, 0);
  const canalRows = byCanal.map((c) => ({
    canal: c.canal,
    vendas: c.vendas,
    receita: c.receita,
    ticket: c.vendas > 0 ? c.receita / c.vendas : 0,
    pct: receitaTotalCanais > 0 ? (c.receita / receitaTotalCanais) * 100 : 0,
  }));

  const tipoRows = byTipo.map((t) => ({
    name: t.tipo,
    value: t.vendas,
    receita: t.receita,
  }));

  const tipoColors: Record<string, string> = {
    "Lead Anterior": "#4ade80",
    "Lead Posterior": "#f59e0b",
    "UTM Direta": "#818cf8",
    "Sem Atribuição": "#f87171",
  };

  const monthlyTrend = trend;


  return (
    <>
      <PageHeader
        title="Visão Geral"
        subtitle="Atribuição last-click de vendas Febracis"
        tutorialKey="visao-geral"
      />
      <GlobalFilters />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total de Vendas" value={fmtNum(totalVendas)} accent="#8b5cf6" loading={isLoading} />
        <KpiCard label="Receita Convertida" value={fmtBRLFull(receitaConvertida)} accent="#6366f1" loading={isLoading} />
        <KpiCard label="Receita Total" value={fmtBRLFull(receitaTotal)} accent="#a78bfa" loading={isLoading} />
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
