import { defineCommand } from 'citty';
import { consola } from 'consola';
import { join } from 'pathe';
import { generateGraphHtml, loadVaultConfig } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import { openInDefaultBrowser } from '../utils/open-browser.js';

export const graphCommand = defineCommand({
  meta: {
    name: 'graph',
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
    const vaultRoot = resolveVaultRoot(args);
    const config = loadVaultConfig(vaultRoot);
    const output = args.output ?? join(vaultRoot, '.memoss', 'viz.html');

    const result = generateGraphHtml({
      bundleRoot: vaultRoot,
      outPath: output,
      bundleName: config.name,
    });

    consola.success(
      `Wrote ${output} (${result.concepts} concepts, ${result.edges} edges, ${result.bytes} bytes)`,
    );

    if (!args.noOpen) {
      await openInDefaultBrowser(output);
      consola.info('Opened graph in your default browser.');
    }
  },
});
