import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
  cursos?: string[];
  unidadesGeradoras?: string[];
  utmSrc?: string[];
  canaisVenda?: string[];
  modalidades?: string[];
  fases?: string[];
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
  receita_convertida_brl: number;
  utm_campanha: string | null;
  utm_conteudo: string | null;
  utm_origem: string | null;
  utm_midia: string | null;
  utm_termo: string | null;
  data_matricula: string | null;
};

const getCanaisBreakdown = createServerFn({ method: "GET" })
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
      sql`
        SELECT
          canal,
          COUNT(*)::int AS vendas,
          SUM(receita_convertida_brl) AS receita,
          CASE WHEN COUNT(*) > 0 THEN SUM(receita_convertida_brl) / COUNT(*) ELSE 0 END AS ticket
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
    const canaisFilter = input.canais?.length
      ? sql`WHERE canal IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`
      : sql``;
    const where = conditions.length > 0
      ? sql`AND ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`
        SELECT canal, COUNT(*)::int AS leads FROM (
          SELECT
            derive_canal_dynamic(
              data->>'ultima_origem_lead',
              data->>'origem_lead',
              data->>'utm_source',
              data->>'utm_medium',
              data->>'utm_campaign'
            ) AS canal
          FROM planilha_leads
          WHERE data->>'email' IS NOT NULL AND data->>'email' <> ''
          ${where}
        ) sub
        ${canaisFilter}
        GROUP BY canal
      `
    );
    return result as unknown as LeadsCountRow[];
  });

const getCanaisSpend = createServerFn({ method: "GET" })
  .inputValidator((input: { dateFrom?: string | null; dateTo?: string | null }) => input)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`date >= ${input.dateFrom}::date`);
    if (input.dateTo) conditions.push(sql`date <= ${input.dateTo}::date`);
    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    const result = await db.execute(sql`
      SELECT 'Mídia' AS canal, SUM(spend)::numeric AS spend
      FROM (
        SELECT spend, date FROM meta_ads_spend ${where}
        UNION ALL
        SELECT spend, date FROM google_ads_spend ${where}
      ) combined
    `);
    return result as unknown as { canal: string; spend: number }[];
  });

type DetailInput = FiltersInput & { canal?: string | null };

const getCanaisDetail = createServerFn({ method: "GET" })
  .inputValidator((input: DetailInput) => input)
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
    if (input.canal) conditions.push(sql`canal = ${input.canal}`);
    const where = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;
    const result = await db.execute(
      sql`SELECT canal, receita_convertida_brl, utm_campanha, utm_conteudo, utm_origem, utm_midia, utm_termo, data_matricula FROM vendas_atribuidas ${where} LIMIT 10000`
    );
    return result as unknown as DetailRow[];
  });

function Canais() {
  const { filters } = useFilters();
  const [canal, setCanal] = useState<string | null>(null);

  const { data: breakdown, isLoading: loadingBreak } = useQuery({
    queryKey: ["canais-breakdown", filters],
    queryFn: () =>
      getCanaisBreakdown({
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

  const { data: leadsBreakdown } = useQuery({
    queryKey: ["canais-leads", filters],
    queryFn: () =>
      getCanaisLeadsCount({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          canais: filters.canais,
          cursos: filters.cursos,
          unidadesGeradoras: filters.unidadesGeradoras,
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
          canais: filters.canais,
          cursos: filters.cursos,
          unidadesGeradoras: filters.unidadesGeradoras,
          utmSrc: filters.utmSrc,
          canaisVenda: filters.canaisVenda,
          modalidades: filters.modalidades,
          fases: filters.fases,
          canal,
        },
      }),
  });

  const { data: spendData } = useQuery({
    queryKey: ["canais-spend", filters.dateFrom, filters.dateTo],
    queryFn: () => getCanaisSpend({ data: { dateFrom: filters.dateFrom, dateTo: filters.dateTo } }),
  });

  const data = rows ?? [];
  const bk = breakdown ?? [];
  const leadsMap = Object.fromEntries((leadsBreakdown ?? []).map((r) => [r.canal, Number(r.leads)]));
  const spendMap = Object.fromEntries((spendData ?? []).map((r) => [r.canal, Number(r.spend ?? 0)]));
  const totalVendas = bk.reduce((s, r) => s + Number(r.vendas), 0);
  const totalReceita = bk.reduce((s, r) => s + Number(r.receita), 0);
  const ticketGeral = totalVendas > 0 ? totalReceita / totalVendas : 0;
  const totalLeads = Object.values(leadsMap).reduce((s, v) => s + v, 0);
  const totalSpend = Object.values(spendMap).reduce((s, v) => s + v, 0);

  const isAll = canal === null;
  const sel = canal ? bk.find((r) => r.canal === canal) : null;
  const vendasSel = sel ? Number(sel.vendas) : totalVendas;
  const receitaSel = sel ? Number(sel.receita) : totalReceita;
  const ticketSel = vendasSel > 0 ? receitaSel / vendasSel : 0;
  const pctSel = totalReceita > 0 ? (receitaSel / totalReceita) * 100 : 0;
  const leadsSel = canal ? (leadsMap[canal] ?? 0) : totalLeads;

  const aggBy = (key: string) => {
    const m: Record<string, { vendas: number; receita: number }> = {};
    for (const r of data) {
      const k = (r as any)[key];
      if (!k) continue; // excluir valores vazios
      m[k] = m[k] || { vendas: 0, receita: 0 };
      m[k].vendas += 1;
      m[k].receita += Number(r.receita_convertida_brl ?? 0);
    }
    return Object.entries(m)
      .map(([k, v]) => ({ key: k, vendas: v.vendas, receita: v.receita, ticket: v.vendas > 0 ? v.receita / v.vendas : 0 }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 20);
  };

  const UTM_SECTIONS = [
    { key: "utm_campanha", label: "Campanhas (utm_campaign)" },
    { key: "utm_conteudo", label: "Conteúdos (utm_content)" },
    { key: "utm_origem", label: "Origens (utm_source)" },
    { key: "utm_midia", label: "Mídias (utm_medium)" },
    { key: "utm_termo", label: "Termos (utm_term)" },
  ] as const;
  const utmData: Record<string, ReturnType<typeof aggBy>> = {};
  for (const s of UTM_SECTIONS) utmData[s.key] = aggBy(s.key);

  // Top 3 UTM sources por canal (para exibir no resumo)
  const topSourcesByCanal = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of data) {
      if (!r.utm_origem) continue;
      const c = (r as any).canal || "Outros";
      m[c] = m[c] || {};
      m[c][r.utm_origem] = (m[c][r.utm_origem] ?? 0) + 1;
    }
    const result: Record<string, string[]> = {};
    for (const [c, sources] of Object.entries(m)) {
      result[c] = Object.entries(sources)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s]) => s);
    }
    return result;
  }, [data]);

  const monthly: Record<string, number> = {};
  for (const r of data) {
    if (!r.data_matricula) continue;
    const m = String(r.data_matricula).slice(0, 7);
    monthly[m] = (monthly[m] ?? 0) + Number(r.receita_convertida_brl ?? 0);
  }
  const trend = Object.entries(monthly).sort().map(([m, v]) => ({ mes: m, receita: v }));

  const accent = canal ? channelColor(canal) : "#6366f1";

  return (
    <>
      <PageHeader
        title="Canais"
        subtitle="Performance detalhada por canal de marketing"
        tutorialKey="canais"
      />
      <GlobalFilters />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Vendas" value={fmtNum(totalVendas)} loading={loadingBreak} accent="#6366f1" />
        <KpiCard label="Leads" value={fmtNum(totalLeads)} loading={loadingBreak} accent="#6366f1" />
        <KpiCard label="Receita" value={fmtBRLFull(totalReceita)} loading={loadingBreak} accent="#6366f1" />
        <KpiCard label="Ticket Médio" value={fmtBRLFull(ticketGeral)} loading={loadingBreak} accent="#6366f1" />
      </div>

      {/* Tabela de canais */}
      <Card title="Canais" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-4">Canal</th>
                <th className="py-2 pr-4 text-right">Leads</th>
                <th className="py-2 pr-4 text-right">Vendas</th>
                <th className="py-2 pr-4 text-right">Receita</th>
                <th className="py-2 pr-4 text-right">Invest.</th>
                <th className="py-2 pr-4 text-right">ROAS</th>
                <th className="py-2 pr-4 text-right">CPA</th>
                <th className="py-2 pr-4 text-right">Conv.</th>
                <th className="py-2 pr-4 text-right">Ticket Médio</th>
                <th className="py-2 pr-4 text-right">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {bk.map((r) => {
                const pct = totalReceita > 0 ? (Number(r.receita) / totalReceita) * 100 : 0;
                const leads = leadsMap[r.canal] ?? 0;
                const conv = leads > 0 ? (Number(r.vendas) / leads) * 100 : 0;
                const spend = spendMap[r.canal] ?? 0;
                const roas = spend > 0 ? Number(r.receita) / spend : 0;
                const cpa = Number(r.vendas) > 0 && spend > 0 ? spend / Number(r.vendas) : 0;
                const selected = canal === r.canal;
                return (
                  <tr
                    key={r.canal}
                    onClick={() => setCanal(selected ? null : r.canal)}
                    className={cn(
                      "border-b border-border/50 last:border-0 cursor-pointer transition hover:bg-accent/20",
                      selected && "bg-accent/30",
                    )}
                  >
                    <td className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-sm" style={{ background: channelColor(r.canal) }} />
                        <span>{r.canal}</span>
                      </div>
                      {topSourcesByCanal[r.canal]?.length ? (
                        <div className="flex gap-1.5 mt-1 ml-4">
                          {topSourcesByCanal[r.canal].map((s) => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[120px]" title={s}>{s}</span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-right">{fmtNum(leads)}</td>
                    <td className="py-3 pr-4 text-right">{fmtNum(Number(r.vendas))}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{fmtBRLFull(Number(r.receita))}</td>
                    <td className="py-3 pr-4 text-right">{spend > 0 ? fmtBRLFull(spend) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{roas > 0 ? `${roas.toFixed(1)}x` : "—"}</td>
                    <td className="py-3 pr-4 text-right">{cpa > 0 ? fmtBRLFull(cpa) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{fmtPct(conv)}</td>
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
              {/* Linha de resumo — soma dos canais visíveis */}
              <tr className="border-t border-border bg-muted/30">
                <td className="py-3 pr-4 font-semibold text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: "#6366f1" }} />
                    Total
                  </span>
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{fmtNum(totalLeads)}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{fmtNum(totalVendas)}</td>
                <td className="py-3 pr-4 text-right font-bold text-muted-foreground">{fmtBRLFull(totalReceita)}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{totalSpend > 0 ? fmtBRLFull(totalSpend) : "—"}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{totalSpend > 0 ? `${(totalReceita / totalSpend).toFixed(1)}x` : "—"}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{totalSpend > 0 && totalVendas > 0 ? fmtBRLFull(totalSpend / totalVendas) : "—"}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{fmtPct(totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0)}</td>
                <td className="py-3 pr-4 text-right font-semibold text-muted-foreground">{fmtBRLFull(ticketGeral)}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">100%</td>
              </tr>
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

      <UtmTabs sections={UTM_SECTIONS} utmData={utmData} loading={isLoading} />
    </>
  );
}

function UtmTabs({
  sections,
  utmData,
  loading,
}: {
  sections: readonly { key: string; label: string }[];
  utmData: Record<string, { key: string; vendas: number; receita: number; ticket: number }[]>;
  loading?: boolean;
}) {
  const [active, setActive] = useState(sections[0].key);
  const rows = utmData[active] ?? [];

  return (
    <Card title="Detalhamento UTMs">
      <div className="flex flex-wrap gap-2 mb-4">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition",
              active === s.key
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-card/40 border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
            {(utmData[s.key]?.length ?? 0) > 0 && (
              <span className="ml-1.5 text-[10px] opacity-60">({utmData[s.key].length})</span>
            )}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Valor</th>
              <th className="py-2 pr-4 text-right">Vendas</th>
              <th className="py-2 pr-4 text-right">Receita</th>
              <th className="py-2 pr-4 text-right">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">Carregando…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">Sem dados para esta UTM</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition">
                <td className="py-2.5 pr-4 text-muted-foreground text-xs">{i + 1}</td>
                <td className="py-2.5 pr-4 font-medium max-w-[320px] truncate" title={r.key}>{r.key}</td>
                <td className="py-2.5 pr-4 text-right">{fmtNum(r.vendas)}</td>
                <td className="py-2.5 pr-4 text-right font-semibold">{fmtBRL(r.receita)}</td>
                <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtBRL(r.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
