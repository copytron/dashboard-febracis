export const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const fmtBRLFull = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const fmtNum = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR");

export const fmtPct = (v: number | null | undefined) =>
  `${(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const fmtDateBR = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
};

export const CHANNEL_COLORS: Record<string, string> = {
  "Mídia": "#6366f1",
  CRM: "#10b981",
  YouTube: "#ef4444",
  Redes: "#f59e0b",
  "Orgânicos": "#22c55e",
  Outros: "#64748b",
};

export const CANAIS_LIST = ["Mídia", "CRM", "YouTube", "Redes", "Orgânicos", "Outros"] as const;

export const channelColor = (c: string) => CHANNEL_COLORS[c] ?? "#6b7280";

export const TIPO_BADGE: Record<string, string> = {
  "Lead Anterior": "bg-emerald-950 text-emerald-400 border border-emerald-900",
  "Lead Posterior": "bg-amber-950 text-amber-400 border border-amber-900",
  "UTM Direta": "bg-indigo-950 text-indigo-300 border border-indigo-900",
  "Sem Atribuição": "bg-red-950 text-red-400 border border-red-900",
  // legados
  Existente: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  Inferida: "bg-amber-950 text-amber-400 border border-amber-900",
  "Sem Atribuicao": "bg-red-950 text-red-400 border border-red-900",
};

export const SEVERITY_BADGE: Record<string, string> = {
  error: "bg-red-950 text-red-400 border border-red-900",
  warn: "bg-amber-950 text-amber-400 border border-amber-900",
  info: "bg-slate-900 text-slate-300 border border-slate-800",
};

export const MATCH_METHOD_LABEL: Record<string, string> = {
  email: "Email (1.0)",
  telefone: "Telefone (0.9)",
  "nome+cidade": "Nome+Cidade (0.75)",
  "nome+estado": "Nome+Estado (0.6)",
  sem: "Sem match",
};
