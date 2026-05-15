/**
 * MCP Server local para Windsor.ai
 *
 * Encapsula a API REST do Windsor.ai em ferramentas MCP padronizadas.
 * Pode ser consumido in-process pelo sync do dashboard ou via stdio pelo Claude.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WindsorConnector, WindsorField } from "./types.js";

const WINDSOR_BASE = "https://connectors.windsor.ai";

// ─── Helpers HTTP internos ──────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) throw new Error("WINDSOR_API_KEY nao configurada.");
  return key;
}

async function windsorFetch(
  connector: string,
  params: Record<string, string>,
): Promise<any> {
  const url = new URL(`${WINDSOR_BASE}/${connector}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Windsor.ai erro ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return json;
}

// ─── Criar MCP Server ───────────────────────────────────────────────────────

export function createWindsorMcpServer(): McpServer {
  const server = new McpServer({
    name: "windsor-ai",
    version: "1.0.0",
  });

  // ── get_connectors ──────────────────────────────────────────────────────

  server.tool(
    "get_connectors",
    "Lista conectores Windsor.ai e suas contas conectadas",
    {
      include_not_yet_connected: z
        .boolean()
        .optional()
        .default(false)
        .describe("Incluir conectores ainda nao configurados"),
    },
    async ({ include_not_yet_connected }) => {
      const url = new URL(`${WINDSOR_BASE}/connectors`);
      url.searchParams.set("api_key", getApiKey());
      if (include_not_yet_connected) {
        url.searchParams.set("include_not_yet_connected", "true");
      }

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Erro ao listar conectores: ${res.status}`);
      }
      const data = await res.json();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── get_fields ──────────────────────────────────────────────────────────

  server.tool(
    "get_fields",
    "Lista campos disponiveis de um conector Windsor.ai",
    {
      connector: z.string().describe("ID do conector (ex: salesforce, facebook, google_ads)"),
      fields: z
        .array(z.string())
        .optional()
        .describe("Lista de field IDs para obter detalhes. Omita para listar todos."),
    },
    async ({ connector, fields }) => {
      const params: Record<string, string> = {};
      if (fields?.length) params.fields = fields.join(",");

      const data = await windsorFetch(`${connector}/fields`, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── get_data ────────────────────────────────────────────────────────────

  server.tool(
    "get_data",
    "Busca dados de um conector Windsor.ai",
    {
      connector: z.string().describe("ID do conector"),
      fields: z.array(z.string()).describe("Lista de field IDs para buscar"),
      accounts: z.array(z.string()).optional().describe("IDs das contas para filtrar"),
      date_from: z.string().optional().describe("Data inicio YYYY-MM-DD"),
      date_to: z.string().optional().describe("Data fim YYYY-MM-DD"),
      date_preset: z.string().optional().describe("Preset de data (ex: this_month, last_30d)"),
      filters: z.any().optional().describe("Filtros no formato Windsor"),
    },
    async ({ connector, fields, accounts, date_from, date_to, date_preset, filters }) => {
      const params: Record<string, string> = {
        fields: fields.join(","),
      };
      if (accounts?.length) params.accounts = accounts.join(",");
      if (date_from) params.date_from = date_from;
      if (date_to) params.date_to = date_to;
      if (date_preset) params.date_preset = date_preset;
      if (filters) params.filters = JSON.stringify(filters);

      const data = await windsorFetch(connector, params);
      const rows = Array.isArray(data) ? data : data?.data ?? [];
      return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
    },
  );

  // ── get_options ─────────────────────────────────────────────────────────

  server.tool(
    "get_options",
    "Opcoes e filtros disponiveis para um conector Windsor.ai",
    {
      connector: z.string().describe("ID do conector"),
      accounts: z.array(z.string()).describe("IDs das contas"),
    },
    async ({ connector, accounts }) => {
      const params: Record<string, string> = {
        accounts: accounts.join(","),
      };
      const data = await windsorFetch(`${connector}/options`, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  return server;
}
