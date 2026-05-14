export type FieldName =
  | "ultima_origem_lead"
  | "origem_lead"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign";

export type Operador = "contem" | "nao_contem" | "igual" | "comeca_com" | "regex";

export type Condicao = {
  campo: FieldName;
  operador: Operador;
  valor: string;
};

/** Um grupo de condições com sua própria lógica interna */
export type CondicaoSubGroup = {
  logica: "AND" | "OR";
  condicoes: Condicao[];
};

/**
 * Configuração de uma regra de classificação.
 * Suporta dois formatos:
 * - Legado: { logica, condicoes } — grupo único flat
 * - Novo:   { logica_grupos, grupos } — múltiplos grupos compostos
 */
export type CondicaoGroup = {
  /** Lógica entre grupos (novo formato) */
  logica_grupos?: "AND" | "OR";
  /** Grupos de condições (novo formato) */
  grupos?: CondicaoSubGroup[];
  /** Lógica flat - backward compat */
  logica: "AND" | "OR";
  /** Condições flat - backward compat */
  condicoes?: Condicao[];
};

export type RegraClassificacao = {
  id: string;
  nome: string;
  canal: string;
  prioridade: number;
  ativo: boolean;
  config: CondicaoGroup;
  created_at: string;
};

export const FIELD_LABELS: Record<FieldName, string> = {
  ultima_origem_lead: "Última Origem do Lead",
  origem_lead: "Origem do Lead",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
};

export const OPERADOR_LABELS: Record<Operador, string> = {
  contem: "Contém",
  nao_contem: "Não contém",
  igual: "Igual a",
  comeca_com: "Começa com",
  regex: "Regex",
};

/** Normaliza config legado (flat) para o formato de grupos */
export function normalizeConfig(config: CondicaoGroup): { logica_grupos: "AND" | "OR"; grupos: CondicaoSubGroup[] } {
  if (config.grupos?.length) {
    return {
      logica_grupos: config.logica_grupos ?? "OR",
      grupos: config.grupos,
    };
  }
  // Legado: converte condicoes flat em um único grupo
  return {
    logica_grupos: "OR",
    grupos: [{
      logica: config.logica ?? "OR",
      condicoes: config.condicoes ?? [],
    }],
  };
}
