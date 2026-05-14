import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtNum, channelColor } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads · Febracis MKT" },
      { name: "description", content: "Visão de leads do funil de marketing." },
    ],
  }),
  component: LeadsPage,
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
  search?: string | null;
  pageSize: number;
  offset: number;
};

const getLeadsAgg = createServerFn({ method: "POST" })
  .inputValidator((d: Omit<FiltersInput, "pageSize" | "offset">) => d)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`(data->>'data_lead')::date >= ${input.dateFrom}::date`);
    if (input.dateTo) conditions.push(sql`(data->>'data_lead')::date <= ${input.dateTo}::date`);
    if (input.estados?.length) conditions.push(sql`data->>'estado' IN (${sql.join(input.estados.map(v => sql`${v}`), sql`, `)})`);
    if (input.canais?.length) conditions.push(sql`derive_canal_dynamic(data->>'ultima_origem_lead', data->>'origem_lead', data->>'utm_source', data->>'utm_medium', data->>'utm_campaign') IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    // Leads não têm unidade_geradora — filtrar via vendas que possuem esse campo
    if (input.unidadesGeradoras?.length) conditions.push(sql`lower(data->>'email') IN (SELECT DISTINCT lower(data->>'email') FROM rd_vendas WHERE data->>'unidade_geradora' IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)}) AND data->>'email' IS NOT NULL)`);
    if (input.utmSrc?.length) conditions.push(sql`data->>'utm_src' IN (${sql.join(input.utmSrc.map(v => sql`${v}`), sql`, `)})`);
    if (input.search) conditions.push(sql`(data->>'nome' ILIKE ${"%" + input.search + "%"} OR data->>'email' ILIKE ${"%" + input.search + "%"})`);

    const where = conditions.length > 0 ? sql`WHERE data->>'email' IS NOT NULL AND data->>'email' <> '' AND ${sql.join(conditions, sql` AND `)}` : sql`WHERE data->>'email' IS NOT NULL AND data->>'email' <> ''`;

    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(DISTINCT data->>'email')::int AS emails_unicos
      FROM planilha_leads
      ${where}
    `);
    const row = (result as any[])[0] as any;
    return {
      total: Number(row?.total ?? 0),
      emails_unicos: Number(row?.emails_unicos ?? 0),
    };
  });

const getLeadsPage = createServerFn({ method: "POST" })
  .inputValidator((d: FiltersInput) => d)
  .handler(async ({ data: input }) => {
    const conditions: SQL[] = [sql`data->>'email' IS NOT NULL`, sql`data->>'email' <> ''`];
    if (input.dateFrom) conditions.push(sql`(data->>'data_lead')::date >= ${input.dateFrom}::date`);
    if (input.dateTo) conditions.push(sql`(data->>'data_lead')::date <= ${input.dateTo}::date`);
    if (input.estados?.length) conditions.push(sql`data->>'estado' IN (${sql.join(input.estados.map(v => sql`${v}`), sql`, `)})`);
    if (input.canais?.length) conditions.push(sql`derive_canal_dynamic(data->>'ultima_origem_lead', data->>'origem_lead', data->>'utm_source', data->>'utm_medium', data->>'utm_campaign') IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    // Leads não têm unidade_geradora — filtrar via vendas que possuem esse campo
    if (input.unidadesGeradoras?.length) conditions.push(sql`lower(data->>'email') IN (SELECT DISTINCT lower(data->>'email') FROM rd_vendas WHERE data->>'unidade_geradora' IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)}) AND data->>'email' IS NOT NULL)`);
    if (input.utmSrc?.length) conditions.push(sql`data->>'utm_src' IN (${sql.join(input.utmSrc.map(v => sql`${v}`), sql`, `)})`);
    if (input.search) conditions.push(sql`(data->>'nome' ILIKE ${"%" + input.search + "%"} OR data->>'email' ILIKE ${"%" + input.search + "%"})`);

    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const result = await db.execute(sql`
      SELECT
        data->>'nome' AS nome,
        data->>'email' AS email,
        data->>'origem_lead' AS origem,
        data->>'ultima_origem_lead' AS ultima_origem,
        data->>'data_lead' AS data_lead,
        data->>'estado' AS estado,
        data->>'cidade' AS cidade,
        data->>'utm_source' AS utm_source,
        data->>'utm_medium' AS utm_medium,
        data->>'utm_campaign' AS utm_campaign,
        data->>'utm_content' AS utm_content,
        data->>'utm_term' AS utm_term,
        (SELECT rv.data->>'unidade_geradora'
         FROM rd_vendas rv
         WHERE lower(rv.data->>'email') = lower(pl.data->>'email')
         ORDER BY rv.id DESC LIMIT 1
        ) AS unidade_geradora,
        derive_canal_dynamic(
          data->>'ultima_origem_lead',
          data->>'origem_lead',
          data->>'utm_source',
          data->>'utm_medium',
          data->>'utm_campaign'
        ) AS canal
      FROM planilha_leads pl
      ${where}
      ORDER BY (data->>'data_lead') DESC NULLS LAST
      LIMIT ${input.pageSize} OFFSET ${input.offset}
    `);
    return result as any[];
  });

function LeadsPage() {
  const { filters } = useFilters();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Debounce search
  useState(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  });

  const filterData = useMemo(() => ({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    estados: filters.estados,
    canais: filters.canais,
    unidadesGeradoras: filters.unidadesGeradoras,
    utmSrc: filters.utmSrc,
    search: debouncedSearch || null,
  }), [filters, debouncedSearch]);

  const { data: agg, isLoading: aggLoading } = useQuery({
    queryKey: ["leads-agg", filterData],
    queryFn: () => getLeadsAgg({ data: filterData }),
  });

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["leads-page", filterData, page],
    queryFn: () => getLeadsPage({ data: { ...filterData, pageSize, offset: page * pageSize } }),
  });

  const leads = rows ?? [];

  return (
    <>
      <PageHeader title="Leads" subtitle="Visão dos leads captados pelo marketing" />
      <GlobalFilters />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total de Leads" value={aggLoading ? null : fmtNum(agg?.total ?? 0)} />
        <KpiCard label="E-mails Únicos" value={aggLoading ? null : fmtNum(agg?.emails_unicos ?? 0)} />
        <KpiCard label="Duplicidade" value={aggLoading ? null : agg && agg.total > 0 ? `${((1 - agg.emails_unicos / agg.total) * 100).toFixed(1)}%` : "0%"} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setDebouncedSearch(e.target.value); setPage(0); }}
          className="max-w-sm h-9 text-xs"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Nome</th>
                <th className="text-left px-3 py-2 font-medium">E-mail</th>
                <th className="text-left px-3 py-2 font-medium">Data Lead</th>
                <th className="text-left px-3 py-2 font-medium">Canal</th>
                <th className="text-left px-3 py-2 font-medium">Origem</th>
                <th className="text-left px-3 py-2 font-medium">UTM Campaign</th>
                <th className="text-left px-3 py-2 font-medium">Estado</th>
                <th className="text-left px-3 py-2 font-medium">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {rowsLoading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum lead encontrado</td></tr>
              ) : (
                leads.map((row: any, i: number) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30 transition">
                    <td className="px-3 py-2 font-medium">{row.nome || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.email}</td>
                    <td className="px-3 py-2">{row.data_lead ? new Date(row.data_lead).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{ backgroundColor: channelColor(row.canal) + "22", color: channelColor(row.canal) }}
                      >
                        {row.canal}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[140px] truncate" title={row.ultima_origem || row.origem}>{row.ultima_origem || row.origem || "—"}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={row.utm_campaign}>{row.utm_campaign || "—"}</td>
                    <td className="px-3 py-2">{row.estado || "—"}</td>
                    <td className="px-3 py-2">{row.unidade_geradora || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-muted-foreground">
          Mostrando {leads.length > 0 ? page * pageSize + 1 : 0}–{page * pageSize + leads.length}
          {agg ? ` de ${fmtNum(agg.total)}` : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm" disabled={leads.length < pageSize} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </>
  );
}
