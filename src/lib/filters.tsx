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
