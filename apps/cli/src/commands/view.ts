import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolveVaultRoot } from '../utils/vault.js';

export const viewCommand = defineCommand({
  meta: {
    name: 'view',
    description: 'Generate and open the knowledge graph viewer',
  },
  args: {
    noOpen: {
      type: 'boolean',
      description: 'Generate without opening a browser',
      default: false,
    },
    output: {
      type: 'string',
      description: 'Output HTML path',
    },
    vault: {
      type: 'string',
      alias: 'C',
      description: 'Vault root path',
    },
  },
  async run({ args }) {
    resolveVaultRoot(args);
    consola.warn('Graph viewer is planned for M7. Use `memoss status` for now.');
  },
});
