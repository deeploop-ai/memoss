import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve } from 'pathe';
import { getDefaultVaultPath, SimpleGitAdapter } from '@memoss/core';
import { basename } from 'node:path';
import { initVaultFromSchemaPack, type SchemaPackName } from '../utils/schema-pack.js';

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Create a new knowledge vault from a schema pack',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Target directory (default: ~/.memoss-vault)',
      required: false,
    },
    pack: {
      type: 'string',
      description: 'Schema pack name',
      default: 'research',
    },
    name: {
      type: 'string',
      description: 'Vault name',
    },
    description: {
      type: 'string',
      description: 'Vault description',
      default: '',
    },
  },
  async run({ args }) {
    const targetPath = resolve(args.path ?? getDefaultVaultPath());
    const pack = args.pack as SchemaPackName;
    if (pack !== 'research' && pack !== 'personal' && pack !== 'data-catalog') {
      throw new Error(
        `Unsupported schema pack "${pack}". Use research, personal, or data-catalog.`,
      );
    }

    const name = args.name ?? basename(targetPath);
    initVaultFromSchemaPack(targetPath, pack, {
      name,
      description: args.description ?? '',
    });

    const git = new SimpleGitAdapter(targetPath);
    await git.init();
    await git.commit('chore: initialize memoss vault');

    consola.success(`Initialized ${pack} vault at ${targetPath}`);
  },
});
