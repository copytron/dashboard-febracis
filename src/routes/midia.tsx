import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtBRLFull, fmtNum, fmtPct } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/midia")({
  head: () => ({
    meta: [
      { title: "Mídia Paga · Febracis MKT" },
      { name: "description", content: "Dashboard unificado de mídia paga: Meta Ads + Google Ads + vendas." },
    ],
  }),
  component: Midia,
});

// ─── Types ──────────────────────────────────────────────────────────────────────

type FiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  canaisVenda?: string[];
  modalidades?: string[];
  fases?: string[];
};

type SpendRow = {
  platform: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
};

type VendasMidiaRow = {
  total_vendas: number;
  total_receita: number;
};

type DailySpendRow = {
  date: string;
  meta_spend: number;
  google_spend: number;
};

// ─── Server Functions ───────────────────────────────────────────────────────────

const getSpendByPlatform = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const metaConditions: SQL[] = [];
    const googleConditions: SQL[] = [];
    if (input.dateFrom) {
      metaConditions.push(sql`date >= ${input.dateFrom}::date`);
      googleConditions.push(sql`date >= ${input.dateFrom}::date`);
    }
    if (input.dateTo) {
      metaConditions.push(sql`date <= ${input.dateTo}::date`);
      googleConditions.push(sql`date <= ${input.dateTo}::date`);
    }
    const metaWhere = metaConditions.length > 0
      ? sql`WHERE ${sql.join(metaConditions, sql` AND `)}`
      : sql``;
    const googleWhere = googleConditions.length > 0
      ? sql`WHERE ${sql.join(googleConditions, sql` AND `)}`
      : sql``;

    const result = await db.execute(sql`
      SELECT 'Meta Ads' AS platform,
        COALESCE(SUM(spend), 0)::numeric AS total_spend,
        COALESCE(SUM(impressions), 0)::int AS total_impressions,
        COALESCE(SUM(clicks), 0)::int AS total_clicks
      FROM meta_ads_spend ${metaWhere}
      UNION ALL
      SELECT 'Google Ads' AS platform,
        COALESCE(SUM(spend), 0)::numeric AS total_spend,
        COALESCE(SUM(impressions), 0)::int AS total_impressions,
        COALESCE(SUM(clicks), 0)::int AS total_clicks
      FROM google_ads_spend ${googleWhere}
    `);
    return result as unknown as SpendRow[];
  });

const getVendasMidia = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [sql`canal = 'Mídia'`];
    if (input.dateFrom) conditions.push(sql`data_matricula >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_matricula <= ${input.dateTo}`);
    if (input.canaisVenda?.length) conditions.push(sql`canal_venda IN (${sql.join(input.canaisVenda.map(v => sql`${v}`), sql`, `)})`);
    if (input.modalidades?.length) conditions.push(sql`modalidade IN (${sql.join(input.modalidades.map(v => sql`${v}`), sql`, `)})`);
    if (input.fases?.length) conditions.push(sql`fase IN (${sql.join(input.fases.map(v => sql`${v}`), sql`, `)})`);
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_vendas,
        COALESCE(SUM(valor_convertido), 0)::numeric AS total_receita
      FROM vendas_atribuidas
      ${where}
    `);
    return (result as unknown as VendasMidiaRow[])[0] ?? { total_vendas: 0, total_receita: 0 };
  });

const getDailySpend = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const metaConditions: SQL[] = [];
    const googleConditions: SQL[] = [];
    if (input.dateFrom) {
      metaConditions.push(sql`date >= ${input.dateFrom}::date`);
      googleConditions.push(sql`date >= ${input.dateFrom}::date`);
    }
    if (input.dateTo) {
      metaConditions.push(sql`date <= ${input.dateTo}::date`);
      googleConditions.push(sql`date <= ${input.dateTo}::date`);
    }
    const metaWhere = metaConditions.length > 0
      ? sql`WHERE ${sql.join(metaConditions, sql` AND `)}`
      : sql``;
    const googleWhere = googleConditions.length > 0
      ? sql`WHERE ${sql.join(googleConditions, sql` AND `)}`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        COALESCE(m.date, g.date) AS date,
        COALESCE(m.meta_spend, 0)::numeric AS meta_spend,
        COALESCE(g.google_spend, 0)::numeric AS google_spend
      FROM (
        SELECT date, SUM(spend) AS meta_spend
        FROM meta_ads_spend ${metaWhere}
        GROUP BY date
      ) m
      FULL OUTER JOIN (
        SELECT date, SUM(spend) AS google_spend
        FROM google_ads_spend ${googleWhere}
        GROUP BY date
      ) g ON m.date = g.date
      ORDER BY COALESCE(m.date, g.date)
    `);
    return result as unknown as DailySpendRow[];
  });

// ─── Component ──────────────────────────────────────────────────────────────────

function Midia() {
  const { filters } = useFilters();

  const filtersInput: FiltersInput = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    canaisVenda: filters.canaisVenda,
    modalidades: filters.modalidades,
    fases: filters.fases,
  };

  const { data: spendData, isLoading: loadingSpend } = useQuery({
    queryKey: ["midia-spend", filtersInput],
    queryFn: () => getSpendByPlatform({ data: filtersInput }),
  });

  const { data: vendasData, isLoading: loadingVendas } = useQuery({
    queryKey: ["midia-vendas", filtersInput],
    queryFn: () => getVendasMidia({ data: filtersInput }),
  });

  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ["midia-daily", filtersInput],
    queryFn: () => getDailySpend({ data: filtersInput }),
  });

  // Computed KPIs
  const metaRow = spendData?.find((r) => r.platform === "Meta Ads");
  const googleRow = spendData?.find((r) => r.platform === "Google Ads");
  const totalSpend = Number(metaRow?.total_spend ?? 0) + Number(googleRow?.total_spend ?? 0);
  const receita = Number(vendasData?.total_receita ?? 0);
  const totalVendas = Number(vendasData?.total_vendas ?? 0);
  const roas = totalSpend > 0 ? receita / totalSpend : 0;
  const cpa = totalVendas > 0 ? totalSpend / totalVendas : 0;

  // Platform table data
  const platforms = [
    {
      platform: "Meta Ads",
      spend: Number(metaRow?.total_spend ?? 0),
      impressions: Number(metaRow?.total_impressions ?? 0),
      clicks: Number(metaRow?.total_clicks ?? 0),
    },
    {
      platform: "Google Ads",
      spend: Number(googleRow?.total_spend ?? 0),
      impressions: Number(googleRow?.total_impressions ?? 0),
      clicks: Number(googleRow?.total_clicks ?? 0),
    },
  ];

  // Daily chart data
  const chartData = (dailyData ?? []).map((r) => ({
    date: String(r.date).slice(0, 10),
    meta_spend: Number(r.meta_spend),
    google_spend: Number(r.google_spend),
  }));

  const isLoading = loadingSpend || loadingVendas;

  return (
    <>
      <PageHeader
        title="Mídia Paga"
        subtitle="Meta Ads + Google Ads: investimento, retorno e performance"
        tutorialKey="midia"
      />
      <GlobalFilters />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Investimento Total" value={fmtBRLFull(totalSpend)} loading={isLoading} accent="#f59e0b" />
        <KpiCard label="Receita Mídia" value={fmtBRLFull(receita)} loading={isLoading} accent="#10b981" />
        <KpiCard label="ROAS" value={`${roas.toFixed(2)}x`} loading={isLoading} accent="#6366f1" />
        <KpiCard label="CPA" value={fmtBRLFull(cpa)} loading={isLoading} accent="#ef4444" />
        <KpiCard label="Total Vendas Mídia" value={fmtNum(totalVendas)} loading={isLoading} accent="#8b5cf6" />
      </div>

      {/* Platform Comparison Table */}
      <Card title="Comparativo por plataforma" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Plataforma</th>
                <th className="py-2 pr-4 text-right">Spend</th>
                <th className="py-2 pr-4 text-right">Impressions</th>
                <th className="py-2 pr-4 text-right">Clicks</th>
                <th className="py-2 pr-4 text-right">CTR</th>
                <th className="py-2 pr-4 text-right">CPC</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => {
                const ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
                const cpc = p.clicks > 0 ? p.spend / p.clicks : 0;
                return (
                  <tr key={p.platform} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-sm"
                          style={{ background: p.platform === "Meta Ads" ? "#3b82f6" : "#f59e0b" }}
                        />
                        {p.platform}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmtBRLFull(p.spend)}</td>
                    <td className="py-3 pr-4 text-right">{fmtNum(p.impressions)}</td>
                    <td className="py-3 pr-4 text-right">{fmtNum(p.clicks)}</td>
                    <td className="py-3 pr-4 text-right">{fmtPct(ctr)}</td>
                    <td className="py-3 pr-4 text-right">{fmtBRL(cpc)}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="border-t border-border bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">Total</td>
                <td className="py-3 pr-4 text-right font-bold text-muted-foreground">{fmtBRLFull(totalSpend)}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">
                  {fmtNum(platforms.reduce((s, p) => s + p.impressions, 0))}
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">
                  {fmtNum(platforms.reduce((s, p) => s + p.clicks, 0))}
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">
                  {fmtPct(
                    platforms.reduce((s, p) => s + p.impressions, 0) > 0
                      ? (platforms.reduce((s, p) => s + p.clicks, 0) / platforms.reduce((s, p) => s + p.impressions, 0)) * 100
                      : 0
                  )}
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">
                  {fmtBRL(
                    platforms.reduce((s, p) => s + p.clicks, 0) > 0
                      ? totalSpend / platforms.reduce((s, p) => s + p.clicks, 0)
                      : 0
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Daily Trend Chart */}
      <Card title="Investimento diário: Meta Ads vs Google Ads" className="mb-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
              <Tooltip
                contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: string) => [fmtBRLFull(Number(v)), name === "meta_spend" ? "Meta Ads" : "Google Ads"]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend formatter={(value) => (value === "meta_spend" ? "Meta Ads" : "Google Ads")} />
              <Line type="monotone" dataKey="meta_spend" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="google_spend" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}
