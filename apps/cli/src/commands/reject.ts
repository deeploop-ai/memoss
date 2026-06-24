import { defineCommand } from 'citty';
import { consola } from 'consola';
import { rejectDraftBranch } from '../utils/draft-workflow.js';
import { resolveVaultRoot } from '../utils/vault.js';

export const rejectCommand = defineCommand({
  meta: {
    name: 'reject',
    description: 'Discard a draft branch without merging',
  },
  args: {
    branch: {
      type: 'string',
      description: 'Draft branch to discard (default: current branch)',
    },
    vault: {
      type: 'string',
      alias: 'C',
      description: 'Vault root path',
    },
  },
  async run({ args }) {
    const vaultRoot = resolveVaultRoot(args);
    const rejected = await rejectDraftBranch(vaultRoot, args.branch);
    consola.warn(`Discarded draft branch ${rejected}.`);
  },
});
