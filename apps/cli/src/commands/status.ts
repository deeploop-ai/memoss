import { defineCommand } from 'citty';
import {
  FsKnowledgeStore,
  loadVaultConfig,
  SimpleGitAdapter,
} from '@memoss/core';
import { isDraftBranch } from '../utils/draft-workflow.js';
import { resolveVaultRoot } from '../utils/vault.js';

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Show vault and git status',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output machine-readable JSON',
      default: false,
    },
    vault: {
      type: 'string',
      alias: 'C',
      description: 'Vault root path',
    },
  },
  async run({ args }) {
    const vaultRoot = resolveVaultRoot(args);
    const config = loadVaultConfig(vaultRoot);
    const store = new FsKnowledgeStore(vaultRoot);
    const git = new SimpleGitAdapter(vaultRoot);

    const pages = await store.listPages();
    const log = await store.readLog();
    const logLines = log.split('\n').filter(Boolean).slice(-5);

    let gitState: Record<string, unknown> = { enabled: config.git.enabled };
    if (config.git.enabled && (await git.isRepo())) {
      const branch = await git.getCurrentBranch();
      const commits = await git.log(3);
      gitState = {
        enabled: true,
        branch,
        onDraft: isDraftBranch(branch),
        recentCommits: commits,
      };
    }

    const payload = {
      vault: vaultRoot,
      name: config.name,
      schemaPack: config.schema_pack,
      pageCount: pages.length,
      pages: pages.slice(0, 20),
      logTail: logLines,
      git: gitState,
    };

    if (args.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(`Vault: ${config.name} (${vaultRoot})`);
    console.log(`Schema pack: ${config.schema_pack}`);
    console.log(`Pages: ${pages.length}`);
    if (config.git.enabled && gitState.branch) {
      console.log(`Git branch: ${gitState.branch}${gitState.onDraft ? ' (draft)' : ''}`);
    }
    if (logLines.length > 0) {
      console.log('\nRecent log:');
      for (const line of logLines) {
        console.log(`  ${line}`);
      }
    }
  },
});
