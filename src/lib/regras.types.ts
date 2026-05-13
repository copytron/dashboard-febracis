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

export type CondicaoGroup = {
  logica: "AND" | "OR";
  condicoes: Condicao[];
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
