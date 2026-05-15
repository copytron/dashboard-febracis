import { createContext, useContext, useState, ReactNode, useMemo } from "react";

export type Filters = {
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null;
  turmas: string[];
  estados: string[];
  canais: string[];
  canaisVenda: string[];
  modalidades: string[];
  fases: string[];
  cursos: string[];
  unidadesGeradoras: string[];
  utmSrc: string[];
};

type Ctx = {
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  reset: () => void;
};

const defaultFilters: Filters = {
  dateFrom: null,
  dateTo: null,
  turmas: [],
  estados: [],
  canais: [],
  canaisVenda: [],
  modalidades: [],
  fases: [],
  cursos: [],
  unidadesGeradoras: [],
  utmSrc: [],
};

const FiltersContext = createContext<Ctx | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setF] = useState<Filters>(defaultFilters);
  const value = useMemo<Ctx>(
    () => ({
      filters,
      setFilters: (patch) => setF((p) => ({ ...p, ...patch })),
      reset: () => setF(defaultFilters),
    }),
    [filters],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}

/** Apply filters to a vendas_atribuidas query builder */
export function applyVendasFilters<T extends { gte: any; lte: any; in: any }>(
  q: T,
  f: Filters,
): T {
  let r: any = q;
  if (f.dateFrom) r = r.gte("data_matricula", f.dateFrom);
  if (f.dateTo) r = r.lte("data_matricula", f.dateTo);
  if (f.turmas.length) r = r.in("turma", f.turmas);
  if (f.estados.length) r = r.in("estado", f.estados);
  if (f.canais.length) r = r.in("canal", f.canais);
  if (f.canaisVenda.length) r = r.in("canal_venda", f.canaisVenda);
  if (f.modalidades.length) r = r.in("modalidade", f.modalidades);
  if (f.fases.length) r = r.in("fase", f.fases);
  return r;
}
