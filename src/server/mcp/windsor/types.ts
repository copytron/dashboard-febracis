/**
 * Tipos compartilhados para o MCP Server Windsor.ai
 */

export interface WindsorConnectorAccount {
  id: string;
  name: string | null;
}

export interface WindsorConnector {
  id: string;
  accounts: WindsorConnectorAccount[];
}

export interface WindsorField {
  id: string;
  name: string;
  description: string;
  type: string;
  table: string;
}

export type FilterOperator =
  | "eq" | "neq"
  | "gt" | "gte" | "lt" | "lte"
  | "contains" | "ncontains" | "in"
  | "null" | "notnull";

export type FilterCondition = [string, FilterOperator, string | number | boolean | null];
export type FilterLogic = "and" | "or";
export type WindsorFilter = (FilterCondition | FilterLogic | WindsorFilter)[];

export interface GetDataParams {
  connector: string;
  fields: string[];
  accounts?: string[];
  date_from?: string;
  date_to?: string;
  date_preset?: string;
  filters?: WindsorFilter;
}

export interface GetFieldsParams {
  connector: string;
  fields?: string[];
}

export interface GetConnectorsParams {
  include_not_yet_connected?: boolean;
}

export interface GetOptionsParams {
  connector: string;
  accounts: string[];
}
