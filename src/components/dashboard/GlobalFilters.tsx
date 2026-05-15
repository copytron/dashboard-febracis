import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { useFilters } from "@/lib/filters";
import { CANAIS_LIST } from "@/lib/format";
import { DateRangePicker } from "./DateRangePicker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const getFilterOptions = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(
    sql`SELECT DISTINCT turma, estado, curso, unidade_geradora, utm_src, canal_venda, modalidade, fase FROM vendas_atribuidas LIMIT 5000`
  );
  return result as unknown as { turma: string | null; estado: string | null; curso: string | null; unidade_geradora: string | null; utm_src: string | null; canal_venda: string | null; modalidade: string | null; fase: string | null }[];
});

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 justify-between min-w-[140px] bg-card">
          <span className="text-xs">
            {label}
            {selected.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-primary text-primary-foreground text-[10px] font-semibold">
                {selected.length}
              </span>
            )}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nada encontrado</div>
          )}
          {filtered.map((o) => {
            const sel = selected.includes(o);
            return (
              <button
                key={o}
                onClick={() => toggle(o)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-accent transition",
                  sel && "bg-accent/60",
                )}
              >
                <div
                  className={cn(
                    "size-4 rounded border flex items-center justify-center",
                    sel ? "bg-primary border-primary" : "border-border",
                  )}
                >
                  {sel && <Check className="size-3 text-primary-foreground" />}
                </div>
                <span className="flex-1 truncate">{o}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange([])}>
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function GlobalFilters() {
  const { filters, setFilters, reset } = useFilters();
  const [turmas, setTurmas] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [cursos, setCursos] = useState<string[]>([]);
  const [unidadesGeradoras, setUnidadesGeradoras] = useState<string[]>([]);
  const [utmSrcOptions, setUtmSrcOptions] = useState<string[]>([]);
  const [canaisVendaOptions, setCanaisVendaOptions] = useState<string[]>([]);
  const [modalidadeOptions, setModalidadeOptions] = useState<string[]>([]);
  const [faseOptions, setFaseOptions] = useState<string[]>([]);
  const canais = [...CANAIS_LIST];

  useEffect(() => {
    getFilterOptions().then((data) => {
      const t = Array.from(new Set(data.map((r) => r.turma).filter(Boolean))).sort();
      const e = Array.from(new Set(data.map((r) => r.estado).filter(Boolean))).sort();
      const c = Array.from(new Set(data.map((r) => r.curso).filter(Boolean))).sort();
      const u = Array.from(new Set(data.map((r) => r.unidade_geradora).filter(Boolean))).sort();
      const s = Array.from(new Set(data.map((r) => r.utm_src).filter(Boolean))).sort();
      const cv = Array.from(new Set(data.map((r) => r.canal_venda).filter(Boolean))).sort();
      const mod = Array.from(new Set(data.map((r) => r.modalidade).filter(Boolean))).sort();
      const fas = Array.from(new Set(data.map((r) => r.fase).filter(Boolean))).sort();
      setTurmas(t as string[]);
      setEstados(e as string[]);
      setCursos(c as string[]);
      setUnidadesGeradoras(u as string[]);
      setUtmSrcOptions(s as string[]);
      setCanaisVendaOptions(cv as string[]);
      setModalidadeOptions(mod as string[]);
      setFaseOptions(fas as string[]);
    });
  }, []);

  const hasFilters =
    filters.dateFrom || filters.dateTo || filters.turmas.length || filters.estados.length || filters.canais.length || filters.canaisVenda.length || filters.modalidades.length || filters.fases.length || filters.cursos.length || filters.unidadesGeradoras.length || filters.utmSrc.length;

  return (
    <div data-tour="filters" className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-xl border border-border bg-card/50">
      <DateRangePicker
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onChange={(from, to) => setFilters({ dateFrom: from, dateTo: to })}
      />
      <MultiSelect
        label="Unidade Geradora"
        options={unidadesGeradoras}
        selected={filters.unidadesGeradoras}
        onChange={(v) => setFilters({ unidadesGeradoras: v })}
      />
      <MultiSelect
        label="Canal Marketing"
        options={canais}
        selected={filters.canais}
        onChange={(v) => setFilters({ canais: v })}
      />
      <MultiSelect
        label="Canal Venda"
        options={canaisVendaOptions}
        selected={filters.canaisVenda}
        onChange={(v) => setFilters({ canaisVenda: v })}
      />
      <MultiSelect
        label="Modalidade"
        options={modalidadeOptions}
        selected={filters.modalidades}
        onChange={(v) => setFilters({ modalidades: v })}
      />
      <MultiSelect
        label="Fase"
        options={faseOptions}
        selected={filters.fases}
        onChange={(v) => setFilters({ fases: v })}
      />
      <MultiSelect
        label="Turma"
        options={turmas}
        selected={filters.turmas}
        onChange={(v) => setFilters({ turmas: v })}
      />
      <MultiSelect
        label="Estado"
        options={estados}
        selected={filters.estados}
        onChange={(v) => setFilters({ estados: v })}
      />
      <MultiSelect
        label="Curso"
        options={cursos}
        selected={filters.cursos}
        onChange={(v) => setFilters({ cursos: v })}
      />
      <MultiSelect
        label="SRC (Setor)"
        options={utmSrcOptions}
        selected={filters.utmSrc}
        onChange={(v) => setFilters({ utmSrc: v })}
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9 text-xs">
          <X className="size-3.5 mr-1" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
