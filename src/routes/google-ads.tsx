import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtNum } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/google-ads")({
  head: () => ({
    meta: [
      { title: "Google Ads · Febracis MKT" },
      { name: "description", content: "Dados de investimento e performance do Google Ads." },
    ],
  }),
  component: GoogleAds,
});

type FiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
};

type KpiRow = {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
};

type CampaignRow = {
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
};

type DailyRow = {
  date: string;
  spend: number;
};

const getGoogleAdsKpis = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`date >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`date <= ${input.dateTo}`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`
        SELECT
          COALESCE(SUM(spend), 0)::numeric AS total_spend,
          COALESCE(SUM(impressions), 0)::bigint AS total_impressions,
          COALESCE(SUM(clicks), 0)::bigint AS total_clicks
        FROM google_ads_spend
        ${where}
      `
    );
    const row = (result as any[])[0];
    return {
      total_spend: Number(row?.total_spend ?? 0),
      total_impressions: Number(row?.total_impressions ?? 0),
      total_clicks: Number(row?.total_clicks ?? 0),
    } as KpiRow;
  });

const getGoogleAdsCampaigns = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`date >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`date <= ${input.dateTo}`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`
        SELECT
          campaign_name,
          SUM(spend)::numeric AS spend,
          SUM(impressions)::bigint AS impressions,
          SUM(clicks)::bigint AS clicks
        FROM google_ads_spend
        ${where}
        GROUP BY campaign_name
        ORDER BY spend DESC
      `
    );
    return result as unknown as CampaignRow[];
  });

const getGoogleAdsDailySpend = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`date >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`date <= ${input.dateTo}`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`
        SELECT
          date::text AS date,
          SUM(spend)::numeric AS spend
        FROM google_ads_spend
        ${where}
        GROUP BY date
        ORDER BY date ASC
      `
    );
    return result as unknown as DailyRow[];
  });

function GoogleAds() {
  const { filters } = useFilters();

  const filtersInput: FiltersInput = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["google-ads-kpis", filtersInput],
    queryFn: () => getGoogleAdsKpis({ data: filtersInput }),
  });

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["google-ads-campaigns", filtersInput],
    queryFn: () => getGoogleAdsCampaigns({ data: filtersInput }),
  });

  const { data: daily } = useQuery({
    queryKey: ["google-ads-daily", filtersInput],
    queryFn: () => getGoogleAdsDailySpend({ data: filtersInput }),
  });

  const totalSpend = kpis?.total_spend ?? 0;
  const totalImpressions = kpis?.total_impressions ?? 0;
  const totalClicks = kpis?.total_clicks ?? 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  const trend = daily ?? [];

  return (
    <>
      <PageHeader
        title="Google Ads"
        subtitle="Investimento e performance das campanhas Google Ads"
        tutorialKey="google-ads"
      />

      <GlobalFilters />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Investimento Total" value={fmtBRL(totalSpend)} loading={loadingKpis} accent="#4285f4" />
        <KpiCard label="Impressões" value={fmtNum(totalImpressions)} loading={loadingKpis} accent="#4285f4" />
        <KpiCard label="Cliques" value={fmtNum(totalClicks)} loading={loadingKpis} accent="#4285f4" />
        <KpiCard label="CTR" value={`${ctr.toFixed(2)}%`} loading={loadingKpis} accent="#4285f4" />
        <KpiCard label="CPC" value={fmtBRL(cpc)} loading={loadingKpis} accent="#4285f4" />
        <KpiCard label="CPM" value={fmtBRL(cpm)} loading={loadingKpis} accent="#4285f4" />
      </div>

      {/* Campaign Breakdown Table */}
      <Card title="Campanhas" className="mb-6">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Campanha</th>
                <th className="py-2 pr-4 text-right">Investimento</th>
                <th className="py-2 pr-4 text-right">Impressões</th>
                <th className="py-2 pr-4 text-right">Cliques</th>
                <th className="py-2 pr-4 text-right">CTR</th>
                <th className="py-2 pr-4 text-right">CPC</th>
              </tr>
            </thead>
            <tbody>
              {loadingCampaigns && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loadingCampaigns && (!campaigns || campaigns.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                    Sem dados
                  </td>
                </tr>
              )}
              {(campaigns ?? []).map((r) => {
                const rowCtr = Number(r.impressions) > 0 ? (Number(r.clicks) / Number(r.impressions)) * 100 : 0;
                const rowCpc = Number(r.clicks) > 0 ? Number(r.spend) / Number(r.clicks) : 0;
                return (
                  <tr key={r.campaign_name} className="border-b border-border/50 last:border-0 hover:bg-accent/20 transition">
                    <td className="py-3 pr-4 font-medium max-w-[300px] truncate" title={r.campaign_name}>
                      {r.campaign_name}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmtBRL(Number(r.spend))}</td>
                    <td className="py-3 pr-4 text-right">{fmtNum(Number(r.impressions))}</td>
                    <td className="py-3 pr-4 text-right">{fmtNum(Number(r.clicks))}</td>
                    <td className="py-3 pr-4 text-right">{rowCtr.toFixed(2)}%</td>
                    <td className="py-3 pr-4 text-right">{fmtBRL(rowCpc)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Daily Spend Trend */}
      <Card title="Investimento diário" className="mb-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
              <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} />
              <Tooltip
                contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [fmtBRL(Number(v)), "Investimento"]}
              />
              <Line type="monotone" dataKey="spend" stroke="#4285f4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}
