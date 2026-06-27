import { defineCommand } from 'citty';
import { consola } from 'consola';
import {
  listSchemaPacks,
  loadVaultConfig,
  runSwitchSchemaPack,
  SimpleGitAdapter,
  type SchemaPackName,
} from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';

function parsePack(value: string | undefined): SchemaPackName | undefined {
  if (!value) {
    return undefined;
  }
  if (value === 'personal' || value === 'research' || value === 'data-catalog') {
    return value;
  }
  throw new Error(
    `Unsupported schema pack "${value}". Use personal, research, or data-catalog.`,
  );
}

export const packCommand = defineCommand({
  meta: {
    name: 'pack',
    description: 'Show or switch the vault schema pack',
  },
  args: {
    pack: {
      type: 'positional',
      description: 'Target schema pack (personal, research, data-catalog)',
      required: false,
    },
    dryRun: {
      type: 'boolean',
      description: 'Report changes without writing files',
      default: false,
    },
    updateIndex: {
      type: 'boolean',
      description: 'Also copy missing root index.md / README.md from the pack',
      default: false,
    },
    noCommit: {
      type: 'boolean',
      description: 'Do not create a git commit after switching',
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
    const targetPack = parsePack(args.pack);

    if (!targetPack) {
      consola.info(`Vault: ${config.name} (${vaultRoot})`);
      consola.info(`Current schema pack: ${config.schema_pack}`);
      consola.info(`Available packs: ${listSchemaPacks().join(', ')}`);
      consola.info('Run `memoss pack <name>` to switch.');
      return;
    }

    if (targetPack === config.schema_pack) {
      consola.info(`Schema pack is already "${targetPack}".`);
      return;
    }

    const report = await runSwitchSchemaPack({
      vaultRoot,
      pack: targetPack,
      dryRun: args.dryRun,
      updateIndex: args.updateIndex,
    });

    if (args.dryRun) {
      consola.info(`Would switch ${report.previousPack} -> ${report.newPack}`);
      if (report.configUpdated) {
        consola.info('Would update .memoss/config.yaml');
      }
      if (report.instructionsUpdated) {
        consola.info('Would update .memoss/instructions.md');
      }
      if (report.scaffoldAdded.length > 0) {
        consola.info(`Would add ${report.scaffoldAdded.length} scaffold file(s):`);
        for (const path of report.scaffoldAdded) {
          consola.log(`  + ${path}`);
        }
      }
      consola.info('Dry run — no files modified.');
      return;
    }

    consola.success(
      `Switched schema pack: ${report.previousPack} -> ${report.newPack}`,
    );
    if (report.instructionsUpdated) {
      consola.info('Updated .memoss/instructions.md');
    }
    if (report.scaffoldAdded.length > 0) {
      consola.info(`Added ${report.scaffoldAdded.length} scaffold file(s).`);
    }

    if (!args.noCommit && config.git.enabled) {
      const git = new SimpleGitAdapter(vaultRoot);
      if (await git.isRepo()) {
        const hash = await git.commit(
          `chore: switch schema pack ${report.previousPack} -> ${report.newPack}`,
        );
        consola.info(`Committed ${hash.slice(0, 7)}`);
      }
    }

    consola.info('Existing wiki pages were preserved.');
  },
});
