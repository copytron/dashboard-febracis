import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql, SQL } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { fmtBRL, fmtBRLFull, fmtNum, fmtPct, channelColor, TIPO_BADGE } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Server functions ────────────────────────────────────────────────────────

type VendasAggInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  turmas?: string[];
  estados?: string[];
  canais?: string[];
  cursos?: string[];
  unidadesGeradoras?: string[];
  utmSrc?: string[];
  search?: string | null;
  tipo?: string;
};

const getVendasAgg = createServerFn({ method: "POST" })
  .inputValidator((d: VendasAggInput) => d)
  .handler(async ({ data }) => {
    const input = data as VendasAggInput;
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_matricula >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_matricula <= ${input.dateTo}`);
    if (input.turmas?.length) conditions.push(sql`turma IN (${sql.join(input.turmas.map(v => sql`${v}`), sql`, `)})`);
    if (input.estados?.length) conditions.push(sql`estado IN (${sql.join(input.estados.map(v => sql`${v}`), sql`, `)})`);
    if (input.canais?.length) conditions.push(sql`canal IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    if (input.cursos?.length) conditions.push(sql`curso IN (${sql.join(input.cursos.map(v => sql`${v}`), sql`, `)})`);
    if (input.unidadesGeradoras?.length) conditions.push(sql`unidade_geradora IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)})`);
    if (input.utmSrc?.length) conditions.push(sql`utm_src IN (${sql.join(input.utmSrc.map(v => sql`${v}`), sql`, `)})`);
    if (input.search) conditions.push(sql`(nome ILIKE ${"%" + input.search + "%"} OR email ILIKE ${"%" + input.search + "%"})`);
    if (input.tipo === "Com Lead") conditions.push(sql`tipo_atribuicao = ANY(ARRAY['Lead Anterior','Lead Posterior'])`);
    if (input.tipo === "Sem Atribuicao") conditions.push(sql`tipo_atribuicao = 'Sem Atribuição'`);

    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(valor_convertido), 0)::numeric AS receita_sum,
        COUNT(*) FILTER (WHERE tipo_atribuicao IN ('Lead Anterior','Lead Posterior'))::int AS com_lead_count
      FROM vendas_atribuidas
      ${where}
    `);
    const row = ((result as any[])[0]) as any;
    return {
      total_count: Number(row?.total_count ?? 0),
      receita_sum: Number(row?.receita_sum ?? 0),
      com_lead_count: Number(row?.com_lead_count ?? 0),
    };
  });

type VendasPageInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  turmas?: string[];
  estados?: string[];
  canais?: string[];
  cursos?: string[];
  unidadesGeradoras?: string[];
  utmSrc?: string[];
  search?: string | null;
  tipo?: string;
  pageSize: number;
  offset: number;
};

const getVendasPage = createServerFn({ method: "POST" })
  .inputValidator((d: VendasPageInput) => d)
  .handler(async ({ data }) => {
    const input = data as VendasPageInput;
    const conditions: SQL[] = [];
    if (input.dateFrom) conditions.push(sql`data_matricula >= ${input.dateFrom}`);
    if (input.dateTo) conditions.push(sql`data_matricula <= ${input.dateTo}`);
    if (input.turmas?.length) conditions.push(sql`turma IN (${sql.join(input.turmas.map(v => sql`${v}`), sql`, `)})`);
    if (input.estados?.length) conditions.push(sql`estado IN (${sql.join(input.estados.map(v => sql`${v}`), sql`, `)})`);
    if (input.canais?.length) conditions.push(sql`canal IN (${sql.join(input.canais.map(v => sql`${v}`), sql`, `)})`);
    if (input.cursos?.length) conditions.push(sql`curso IN (${sql.join(input.cursos.map(v => sql`${v}`), sql`, `)})`);
    if (input.unidadesGeradoras?.length) conditions.push(sql`unidade_geradora IN (${sql.join(input.unidadesGeradoras.map(v => sql`${v}`), sql`, `)})`);
    if (input.utmSrc?.length) conditions.push(sql`utm_src IN (${sql.join(input.utmSrc.map(v => sql`${v}`), sql`, `)})`);
    if (input.search) conditions.push(sql`(nome ILIKE ${"%" + input.search + "%"} OR email ILIKE ${"%" + input.search + "%"})`);
    if (input.tipo === "Com Lead") conditions.push(sql`tipo_atribuicao = ANY(ARRAY['Lead Anterior','Lead Posterior'])`);
    if (input.tipo === "Sem Atribuicao") conditions.push(sql`tipo_atribuicao = 'Sem Atribuição'`);

    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const result = await db.execute(sql`
      SELECT nome, email, turma, data_matricula, valor_convertido, estado,
             canal, tipo_atribuicao, tipo_match, match_score, match_lag_days, utm_campanha,
             curso, cidade, unidade_geradora, utm_origem, utm_midia, utm_conteudo, utm_termo,
             origem_lead, ultima_origem_lead, canal_venda, fase, promocao, pacote, data_criacao
      FROM vendas_atribuidas
      ${where}
      ORDER BY data_matricula DESC NULLS LAST
      LIMIT ${input.pageSize} OFFSET ${input.offset}
    `);
    return (result as any[]);
  });

const getJornadaByEmails = createServerFn({ method: "POST" })
  .inputValidator((d: { emails: string[] }) => d)
  .handler(async ({ data }) => {
    const input = data as { emails: string[] };
    if (!input.emails.length) return [];
    const result = await db.execute(sql`
      SELECT email, turma, toque_num, tipo, data_lead, dias_antes_compra,
             canal_normalizado, utm_campanha, utm_conteudo, utm_origem
      FROM jornada_normalizada
      WHERE email IN (${sql.join(input.emails.map(v => sql`${v}`), sql`, `)})
      LIMIT 1000
    `);
    return (result as any[]) as JornadaRow[];
  });

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas · Febracis MKT" },
      { name: "description", content: "Base completa de vendas com atribuição de lead por venda." },
    ],
  }),
  component: Vendas,
});

type JornadaRow = {
  email: string;
  turma: string;
  toque_num: number;
  tipo: string;
  data_lead: string | null;
  dias_antes_compra: number | null;
  canal_normalizado: string;
  utm_campanha: string | null;
  utm_conteudo: string | null;
  utm_origem: string | null;
};

type TipoFiltro = "Todas" | "Com Lead" | "Sem Atribuicao";

const TIPO_OPTIONS: { value: TipoFiltro; label: string }[] = [
  { value: "Todas", label: "Todas" },
  { value: "Com Lead", label: "Com Lead" },
  { value: "Sem Atribuicao", label: "Sem Atribuição" },
];

const PAGE_SIZE = 50;

function Vendas() {
  const { filters } = useFilters();
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("Todas");
  const [busca, setBusca] = useState("");
  const [debouncedBusca, setDebouncedBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(1);

  // Debounce text search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedBusca(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Reset page when filters change
  useEffect(() => {
    setPagina(1);
  }, [filters, tipoFiltro]);

  const from = (pagina - 1) * PAGE_SIZE;

  // Query 1: KPI aggregates via server function
  const { data: aggData, isLoading: loadingAgg } = useQuery({
    queryKey: ["vendas-agg", filters, tipoFiltro, debouncedBusca],
    queryFn: () =>
      getVendasAgg({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          turmas: filters.turmas,
          estados: filters.estados,
          canais: filters.canais,
          cursos: filters.cursos,
          unidadesGeradoras: filters.unidadesGeradoras,
          utmSrc: filters.utmSrc,
          search: debouncedBusca || null,
          tipo: tipoFiltro,
        },
      }),
  });

  // Query 2: Current page data (server-side paginated, 50 rows at a time)
  const { data: pageData, isLoading: loadingPage } = useQuery({
    queryKey: ["vendas-page", filters, tipoFiltro, debouncedBusca, pagina],
    queryFn: () =>
      getVendasPage({
        data: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          turmas: filters.turmas,
          estados: filters.estados,
          canais: filters.canais,
          cursos: filters.cursos,
          unidadesGeradoras: filters.unidadesGeradoras,
          utmSrc: filters.utmSrc,
          search: debouncedBusca || null,
          tipo: tipoFiltro,
          pageSize: PAGE_SIZE,
          offset: from,
        },
      }),
  });

  // Query 3: Jornada for emails on the current page only
  const pageEmails = useMemo(
    () => Array.from(new Set((pageData ?? []).map((r: any) => r.email).filter(Boolean))),
    [pageData],
  );

  const { data: jornadaData } = useQuery({
    queryKey: ["vendas-jornada", pageEmails],
    enabled: pageEmails.length > 0,
    queryFn: () => getJornadaByEmails({ data: { emails: pageEmails as string[] } }),
  });

  const isLoading = loadingAgg || loadingPage;

  // KPIs
  const totalVendas = Number(aggData?.total_count ?? 0);
  const receitaTotal = Number(aggData?.receita_sum ?? 0);
  const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;
  const comLead = Number(aggData?.com_lead_count ?? 0);
  const pctAtrib = totalVendas > 0 ? (comLead / totalVendas) * 100 : 0;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalVendas / PAGE_SIZE));

  // Jornada index for current page
  const jornadaMap = useMemo(() => {
    const m: Record<string, JornadaRow[]> = {};
    for (const j of jornadaData ?? []) {
      const k = `${j.email}|${j.turma}`;
      m[k] = m[k] ?? [];
      m[k].push(j);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => a.toque_num - b.toque_num);
    }
    return m;
  }, [jornadaData]);

  function toggleExpand(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const exportCsv = () => {
    const rows = pageData ?? [];
    const headers = ["nome", "email", "turma", "data", "valor", "canal", "tipo_atribuicao", "estado", "utm_campanha"];
    const csv = [
      headers.join(","),
      ...rows.map((r: any) =>
        [
          `"${r.nome ?? ""}"`,
          `"${r.email ?? ""}"`,
          `"${r.turma ?? ""}"`,
          `"${r.data_matricula ?? ""}"`,
          (r.valor_convertido ?? 0).toFixed(2),
          `"${r.canal ?? ""}"`,
          `"${r.tipo_atribuicao ?? ""}"`,
          `"${r.estado ?? ""}"`,
          `"${r.utm_campanha ?? ""}"`,
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendas-pagina-atual.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Vendas" subtitle="Base completa — atribuição last-click por venda" tutorialKey="vendas" />
      <GlobalFilters />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total de Vendas" value={fmtNum(totalVendas)} accent="#6366f1" loading={isLoading} />
        <KpiCard label="Receita Total" value={fmtBRLFull(receitaTotal)} accent="#8b5cf6" loading={isLoading} />
        <KpiCard label="Ticket Médio" value={fmtBRLFull(ticketMedio)} accent="#a78bfa" loading={isLoading} />
        <KpiCard
          label="Canal Identificado"
          value={fmtPct(pctAtrib)}
          hint={`${fmtNum(comLead)} de ${fmtNum(totalVendas)}`}
          accent="#4ade80"
          loading={isLoading}
        />
      </div>

      <Card>
        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <Input
            placeholder="Buscar nome ou email…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-[220px] text-xs bg-card"
          />
          <div className="flex gap-1">
            {TIPO_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setTipoFiltro(value); setPagina(1); }}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium border transition",
                  tipoFiltro === value
                    ? "bg-primary/20 border-primary/40 text-foreground"
                    : "bg-card border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{fmtNum(totalVendas)} registros</span>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-8 text-xs">
            <Download className="size-3.5 mr-1.5" /> Exportar CSV
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-2 w-6" />
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">Turma</th>
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4 text-right">Valor</th>
                <th className="py-2 pr-4">Canal</th>
                <th className="py-2 pr-4">Atribuição</th>
                <th className="py-2 pr-4">UF</th>
                <th className="py-2 pr-4">Cidade</th>
                <th className="py-2 pr-4">Curso</th>
                <th className="py-2 pr-4">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {loadingPage && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-foreground text-xs">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loadingPage && (pageData ?? []).length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-foreground text-xs">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
              {(pageData ?? []).map((r: any, i: number) => {
                const rowKey = `${r.email}|${r.turma}|${i}`;
                const expanded = expandidos.has(rowKey);
                const leads = jornadaMap[`${r.email}|${r.turma}`] ?? [];
                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      onClick={() => toggleExpand(rowKey)}
                      className="border-b border-border/30 cursor-pointer hover:bg-accent/30 transition"
                    >
                      <td className="py-2.5 pr-2 text-muted-foreground">
                        {expanded
                          ? <ChevronDown className="size-3.5" />
                          : <ChevronRight className="size-3.5" />}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="font-medium truncate max-w-[180px]" title={r.nome}>{r.nome ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{r.email}</div>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground truncate max-w-[200px]">{r.turma ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {r.data_matricula ? String(r.data_matricula).slice(0, 10) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold whitespace-nowrap">
                        {fmtBRL(Number(r.valor_convertido ?? 0))}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="size-2 rounded-sm" style={{ background: channelColor(r.canal) }} />
                          {r.canal ?? "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded inline-block w-fit ${
                              TIPO_BADGE[r.tipo_atribuicao] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {r.tipo_atribuicao ?? "—"}
                          </span>
                          {r.tipo_match && r.tipo_match !== "sem" && (
                            <span className="text-[9px] text-muted-foreground">
                              {r.tipo_match}
                              {r.match_score ? ` · ${Number(r.match_score).toFixed(2)}` : ""}
                              {r.match_lag_days != null ? ` · ${r.match_lag_days}d` : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{r.estado ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{r.cidade ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground truncate max-w-[150px]">{r.curso ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground truncate max-w-[150px]">{r.unidade_geradora ?? "—"}</td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-border/30 bg-card/60">
                        <td colSpan={11} className="px-8 py-3">
                          {leads.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-1">
                              Nenhum lead registrado para esta venda.
                            </div>
                          ) : (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                {leads.length} toque{leads.length > 1 ? "s" : ""} de lead
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/40">
                                    <th className="py-1 pr-3 text-left">#</th>
                                    <th className="py-1 pr-3 text-left">Tipo</th>
                                    <th className="py-1 pr-3 text-left">Data Lead</th>
                                    <th className="py-1 pr-3 text-left">Canal</th>
                                    <th className="py-1 pr-3 text-left">Campanha</th>
                                    <th className="py-1 pr-3 text-left">Origem UTM</th>
                                    <th className="py-1 pr-3 text-right">Dias antes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {leads.map((l) => (
                                    <tr key={l.toque_num} className="border-b border-border/20 last:border-0">
                                      <td className="py-1.5 pr-3 text-muted-foreground">{l.toque_num}</td>
                                      <td className="py-1.5 pr-3">
                                        <span
                                          className={cn(
                                            "px-1.5 py-0.5 rounded text-[10px]",
                                            l.tipo === "Único" || l.tipo === "Unico"
                                              ? "bg-emerald-950 text-emerald-400"
                                              : l.tipo === "Último Toque" || l.tipo === "Ultimo Toque"
                                              ? "bg-indigo-950 text-indigo-400"
                                              : l.tipo === "Primeiro Toque"
                                              ? "bg-violet-950 text-violet-400"
                                              : "bg-muted text-muted-foreground",
                                          )}
                                        >
                                          {l.tipo}
                                        </span>
                                      </td>
                                      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                                        {l.data_lead ? String(l.data_lead).slice(0, 10) : "—"}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        <span className="flex items-center gap-1">
                                          <span
                                            className="size-1.5 rounded-sm"
                                            style={{ background: channelColor(l.canal_normalizado) }}
                                          />
                                          {l.canal_normalizado || "—"}
                                        </span>
                                      </td>
                                      <td
                                        className="py-1.5 pr-3 text-muted-foreground truncate max-w-[200px]"
                                        title={l.utm_campanha ?? ""}
                                      >
                                        {l.utm_campanha || "—"}
                                      </td>
                                      <td className="py-1.5 pr-3 text-muted-foreground">
                                        {l.utm_origem || "—"}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right text-muted-foreground">
                                        {l.dias_antes_compra != null ? `${l.dias_antes_compra}d` : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Marketing Details */}
                          <div className="mt-3 pt-3 border-t border-border/30">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Detalhes de Marketing
                            </div>
                            <div className="grid grid-cols-3 gap-x-6 gap-y-1.5">
                              {([
                                ["Origem Lead", r.origem_lead],
                                ["Ultima Origem", r.ultima_origem_lead],
                                ["UTM Source", r.utm_origem],
                                ["UTM Medium", r.utm_midia],
                                ["UTM Content", r.utm_conteudo],
                                ["UTM Term", r.utm_termo],
                                ["Canal Venda", r.canal_venda],
                                ["Fase", r.fase],
                                ["Promocao", r.promocao],
                                ["Pacote", r.pacote],
                                ["Unidade Geradora", r.unidade_geradora],
                              ] as [string, any][]).map(([label, value]) => (
                                <div key={label} className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground">{label}</span>
                                  <span className="text-xs truncate" title={value ?? ""}>{value || "—"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Página {pagina} de {totalPages} · {fmtNum(totalVendas)} registros
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={pagina >= totalPages}
              onClick={() => setPagina((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
