import { defineCommand } from 'citty';
import { consola } from 'consola';
import { startMcpServer } from '@memoss/mcp-server';
import { resolveVaultRoot } from '../utils/vault.js';

export const serveCommand = defineCommand({
  meta: {
    name: 'serve',
    description: 'Start the MCP server on stdio',
  },
  args: {
    vault: {
      type: 'string',
      alias: 'C',
      description: 'Vault root path',
    },
  },
  async run({ args }) {
    const vaultRoot = resolveVaultRoot(args);
    consola.info(`Starting MCP server for ${vaultRoot}`);
    await startMcpServer({ vaultRoot });
  },
});
