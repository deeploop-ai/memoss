import { defineCommand } from 'citty';
import { parseMcpCapabilities, startMcpServer } from '@memoss/mcp-server';
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
    capabilities: {
      type: 'string',
      description:
        'Comma-separated tool levels: agent, read, write (default: agent). Use "full" for all.',
      default: 'agent',
    },
  },
  async run({ args }) {
    const vaultRoot = resolveVaultRoot(args);
    const capabilities = parseMcpCapabilities(
      args.capabilities ?? process.env.MEMOSS_MCP_CAPABILITIES,
    );
    await startMcpServer({ vaultRoot, capabilities });
  },
});
