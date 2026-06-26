import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpCapability } from './capabilities.js';
import { createMemossMcpServer } from './mcp-tools.js';

export interface StartMcpServerOptions {
  vaultRoot: string;
  capabilities?: readonly McpCapability[];
}

export async function startMcpServer(opts: StartMcpServerOptions): Promise<void> {
  const server = createMemossMcpServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
