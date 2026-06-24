import { defineCommand } from 'citty';
import { consola } from 'consola';
import { approveDraftBranch } from '../utils/draft-workflow.js';
import { resolveVaultRoot } from '../utils/vault.js';

export const approveCommand = defineCommand({
  meta: {
    name: 'approve',
    description: 'Merge the current draft branch into main',
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
    const merged = await approveDraftBranch(vaultRoot);
    consola.success(`Merged draft branch ${merged} into main.`);
  },
});
