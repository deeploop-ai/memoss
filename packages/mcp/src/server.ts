import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMemossMcpServer } from './mcp-tools.js';

export interface StartMcpServerOptions {
  vaultRoot: string;
}

export async function startMcpServer(opts: StartMcpServerOptions): Promise<void> {
  const server = createMemossMcpServer(opts.vaultRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
