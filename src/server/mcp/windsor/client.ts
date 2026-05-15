/**
 * MCP Client para o Windsor.ai MCP Server local.
 *
 * Conecta ao server in-process (sem network) e expõe funções tipadas
 * para uso pelo sync e outras partes do dashboard.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createWindsorMcpServer } from "./server.js";
import type {
  WindsorConnector,
  WindsorField,
  GetDataParams,
  GetFieldsParams,
  GetConnectorsParams,
  GetOptionsParams,
} from "./types.js";

let _client: WindsorMcpClient | null = null;

export class WindsorMcpClient {
  private client: Client;
  private ready: Promise<void>;

  constructor() {
    this.client = new Client({ name: "dashboard-febracis", version: "1.0.0" });

    const server = createWindsorMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    this.ready = Promise.all([
      this.client.connect(clientTransport),
      server.connect(serverTransport),
    ]).then(() => {});
  }

  private async callTool<T = any>(name: string, args: Record<string, any>): Promise<T> {
    await this.ready;
    const result = await this.client.callTool({ name, arguments: args });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const text = textContent?.[0]?.text;
    if (!text) throw new Error(`MCP tool ${name} retornou vazio`);
    return JSON.parse(text) as T;
  }

  async getConnectors(
    params: GetConnectorsParams = {},
  ): Promise<WindsorConnector[]> {
    return this.callTool("get_connectors", params);
  }

  async getFields(params: GetFieldsParams): Promise<WindsorField[]> {
    return this.callTool("get_fields", params);
  }

  async getData(params: GetDataParams): Promise<any[]> {
    return this.callTool("get_data", params);
  }

  async getOptions(params: GetOptionsParams): Promise<any> {
    return this.callTool("get_options", params);
  }
}

/** Singleton — reutiliza conexão MCP in-process */
export function getWindsorClient(): WindsorMcpClient {
  if (!_client) _client = new WindsorMcpClient();
  return _client;
}
