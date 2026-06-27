import { defineCommand } from 'citty';
import { consola } from 'consola';
import { runMigrate } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';

export const migrateCommand = defineCommand({
  meta: {
    name: 'migrate',
    description: 'Upgrade vault config and optionally fix indexes/citations',
  },
  args: {
    dryRun: {
      type: 'boolean',
      description: 'Report only; do not write changes',
      default: false,
    },
    fix: {
      type: 'boolean',
      description: 'Apply safe deterministic fixes (indexes, citations, config)',
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
    const report = await runMigrate({
      vaultRoot,
      dryRun: args.dryRun,
      fix: args.fix,
    });

    consola.info(`Health score (before): ${report.healthScoreBefore}/100`);
    if (report.healthScoreAfter !== undefined) {
      consola.info(`Health score (after): ${report.healthScoreAfter}/100`);
    }
    if (report.configUpgraded) {
      consola.success('Config upgraded (flash_model + policies).');
    }
    if (report.indexesRebuilt.length > 0) {
      consola.success(`Rebuilt ${report.indexesRebuilt.length} index.md files.`);
    }
    if (report.citationsFixed.length > 0) {
      consola.success(`Fixed citations on ${report.citationsFixed.length} pages.`);
    }
    consola.log(
      `Issues before — errors: ${report.issuesBefore.errors}, warnings: ${report.issuesBefore.warnings}, info: ${report.issuesBefore.info}`,
    );
    if (args.dryRun) {
      consola.info('Dry run — no files modified.');
    }
  },
});
