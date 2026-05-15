#!/usr/bin/env node
/**
 * Entry point para uso do MCP Server Windsor via stdio (Claude).
 *
 * Configurar no .claude/settings.json:
 * {
 *   "mcpServers": {
 *     "windsor": {
 *       "command": "npx",
 *       "args": ["tsx", "src/server/mcp/windsor/index.ts"]
 *     }
 *   }
 * }
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWindsorMcpServer } from "./server.js";

const server = createWindsorMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
