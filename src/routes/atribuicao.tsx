import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtNum, channelColor } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/atribuicao")({
  head: () => ({
    meta: [
      { title: "Atribuição · Febracis MKT" },
      { name: "description", content: "Análise de atribuição multi-toque." },
    ],
  }),
  component: Atribuicao,
});

type FiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  canais?: string[];
  unidadesGeradoras?: string[];
};

// --- Server functions ---

type TouchpointRow = { toques: number; compradores: number };

const getTouchpointDistribution = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_lead >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_lead <= ${input.dateTo}`);
    if (input.canais?.length) conditions.push(sql`canal_normalizado IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    if (input.unidadesGeradoras?.length) conditions.push(sql`unidade_geradora IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)})`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(sql`
      SELECT
        CASE WHEN max_toque >= 5 THEN 5 ELSE max_toque END AS toques,
        COUNT(*)::int AS compradores
      FROM (
        SELECT email, MAX(toque_num) AS max_toque
        FROM jornada_normalizada
        ${where}
        GROUP BY email
      ) sub
      GROUP BY 1
      ORDER BY 1
    `);
    return result as unknown as TouchpointRow[];
  });

type CanalPosicaoRow = { canal: string; tipo: string; toques: number };

const getCanalPorPosicao = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_lead >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_lead <= ${input.dateTo}`);
    if (input.canais?.length) conditions.push(sql`canal_normalizado IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    if (input.unidadesGeradoras?.length) conditions.push(sql`unidade_geradora IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)})`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(sql`
      SELECT canal_normalizado AS canal, tipo, COUNT(*)::int AS toques
      FROM jornada_normalizada
      ${where}
      GROUP BY canal_normalizado, tipo
      ORDER BY canal_normalizado, tipo
    `);
    return result as unknown as CanalPosicaoRow[];
  });

type TopUtmRow = { utm_campanha: string; canal: string; toques: number };

const getTopUtms = createServerFn({ method: "GET" })
  .inputValidator((input: FiltersInput) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [sql`utm_campanha IS NOT NULL`];
    if (input.dateFrom) conditions.push(sql`data_lead >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_lead <= ${input.dateTo}`);
    if (input.canais?.length) conditions.push(sql`canal_normalizado IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    if (input.unidadesGeradoras?.length) conditions.push(sql`unidade_geradora IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)})`);
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    const result = await db.execute(sql`
      SELECT utm_campanha, canal_normalizado AS canal, COUNT(*)::int AS toques
      FROM jornada_normalizada
      ${where}
      GROUP BY utm_campanha, canal_normalizado
      ORDER BY toques DESC
      LIMIT 30
    `);
    return result as unknown as TopUtmRow[];
  });

// --- Component ---

const TIPO_COLORS: Record<string, string> = {
  "Primeiro Toque": "#6366f1",
  "Intermediário": "#f59e0b",
  "Último Toque": "#10b981",
  "Único": "#a855f7",
};

function Atribuicao() {
  const { filters } = useFilters();
  const filterInput = { dateFrom: filters.dateFrom, dateTo: filters.dateTo, canais: filters.canais, unidadesGeradoras: filters.unidadesGeradoras };

  const { data: touchpoints, isLoading: loadingTp } = useQuery({
    queryKey: ["atribuicao-touchpoints", filterInput],
    queryFn: () => getTouchpointDistribution({ data: filterInput }),
  });

  const { data: canalPosicao, isLoading: loadingCp } = useQuery({
    queryKey: ["atribuicao-canal-posicao", filterInput],
    queryFn: () => getCanalPorPosicao({ data: filterInput }),
  });

  const { data: topUtms, isLoading: loadingUtm } = useQuery({
    queryKey: ["atribuicao-top-utms", filterInput],
    queryFn: () => getTopUtms({ data: filterInput }),
  });

  // Build stacked bar data for canal x posicao
  const stackedData = buildStackedData(canalPosicao ?? []);

  return (
    <>
      <PageHeader
        title="Atribuição"
        subtitle="Análise multi-toque da jornada de compra"
        tutorialKey="atribuicao"
      />
      <GlobalFilters />

      {/* Section A: Touchpoint Distribution */}
      <Card title="Toques antes da compra" className="mb-6">
        <p className="text-xs text-muted-foreground mb-4">
          Quantos toques de lead um comprador teve antes de converter?
        </p>
        <div className="h-72">
          {loadingTp ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(touchpoints ?? []).map((r) => ({
                  toques: r.toques === 5 ? "5+" : String(r.toques),
                  compradores: Number(r.compradores),
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="toques"
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                  width={40}
                  label={{ value: "Toques", angle: -90, position: "insideLeft", style: { fill: "#9ca3af", fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [fmtNum(Number(v)), "Compradores"]}
                />
                <Bar dataKey="compradores" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Section B: Canal por posição na jornada */}
      <Card title="Canal por posição na jornada" className="mb-6">
        <p className="text-xs text-muted-foreground mb-4">
          Qual o papel de cada canal no funil? Primeiro toque (awareness), intermediário ou último toque (conversão)?
        </p>
        <div className="h-80">
          {loadingCp ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                <XAxis dataKey="canal" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#161b27", border: "1px solid #1e2535", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: string) => [fmtNum(Number(v)), name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) => <span style={{ color: TIPO_COLORS[value] ?? "#9ca3af" }}>{value}</span>}
                />
                <Bar dataKey="Primeiro Toque" stackId="a" fill={TIPO_COLORS["Primeiro Toque"]} />
                <Bar dataKey="Intermediário" stackId="a" fill={TIPO_COLORS["Intermediário"]} />
                <Bar dataKey="Último Toque" stackId="a" fill={TIPO_COLORS["Último Toque"]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Único" stackId="a" fill={TIPO_COLORS["Único"]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Section C: Top UTMs */}
      <Card title="Top UTMs na jornada de compra" className="mb-6">
        <p className="text-xs text-muted-foreground mb-4">
          Campanhas mais presentes na jornada dos compradores.
        </p>
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">UTM Campaign</th>
                <th className="py-2 pr-4">Canal</th>
                <th className="py-2 pr-4 text-right">Toques</th>
              </tr>
            </thead>
            <tbody>
              {loadingUtm && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loadingUtm && (topUtms ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                    Sem dados
                  </td>
                </tr>
              )}
              {(topUtms ?? []).map((r, i) => (
                <tr key={`${r.utm_campanha}-${r.canal}`} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-4 max-w-[300px] truncate" title={r.utm_campanha}>
                    {r.utm_campanha}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-sm" style={{ background: channelColor(r.canal) }} />
                      {r.canal}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">{fmtNum(Number(r.toques))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/** Transform flat canal/tipo/toques rows into stacked bar format */
function buildStackedData(rows: CanalPosicaoRow[]) {
  const canais: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!canais[r.canal]) canais[r.canal] = {};
    canais[r.canal][r.tipo] = Number(r.toques);
  }
  return Object.entries(canais)
    .map(([canal, tipos]) => ({
      canal,
      "Primeiro Toque": tipos["Primeiro Toque"] ?? 0,
      "Intermediário": tipos["Intermediário"] ?? 0,
      "Último Toque": tipos["Último Toque"] ?? 0,
      "Único": tipos["Único"] ?? 0,
      total: Object.values(tipos).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total);
}
