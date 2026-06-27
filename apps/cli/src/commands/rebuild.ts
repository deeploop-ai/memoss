import { defineCommand } from 'citty';
import { consola } from 'consola';
import { runRebuild, type RebuildSourceOrigin } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import { resolveSchemaPacksRoot } from '../utils/schema-pack.js';
import { resolveModelArgs } from '../utils/model-args.js';
import { logAgentStep } from '../utils/errors.js';
import { ExitCode } from '../exit-codes.js';

export const rebuildCommand = defineCommand({
  meta: {
    name: 'rebuild',
    description:
      'Rebuild the wiki from sources (manifest, raw files, or extracted markdown)',
  },
  args: {
    from: {
      type: 'string',
      description:
        'Source origin: manifest (default), raw, inbox, or extracted',
      default: 'manifest',
    },
    reset: {
      type: 'boolean',
      description: 'Remove existing wiki pages before re-ingesting',
      default: true,
    },
    noReset: {
      type: 'boolean',
      description: 'Keep existing wiki pages and re-ingest on top',
      default: false,
    },
    noDraft: {
      type: 'boolean',
      description: 'Write directly without creating a draft branch',
      default: false,
    },
    noCache: {
      type: 'boolean',
      description: 'Bypass extract cache for every source',
      default: false,
    },
    skipValidate: {
      type: 'boolean',
      description: 'Skip pre-ingest content validation',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      description: 'List sources that would be rebuilt without making changes',
      default: false,
    },
    model: {
      type: 'string',
      description: 'Model override (provider/model)',
    },
    baseUrl: {
      type: 'string',
      description: 'OpenAI-compatible base URL (with --model openai/...)',
    },
    vault: {
      type: 'string',
      alias: 'C',
      description: 'Vault root path',
    },
  },
  async run({ args }) {
    const vaultRoot = resolveVaultRoot(args);
    const from = args.from as RebuildSourceOrigin;
    if (
      from !== 'manifest' &&
      from !== 'raw' &&
      from !== 'inbox' &&
      from !== 'extracted'
    ) {
      throw new Error(
        `Unsupported --from value "${from}". Use manifest, raw, inbox, or extracted.`,
      );
    }

    const reset = args.noReset ? false : args.reset;

    if (reset && !args.dryRun) {
      consola.warn(
        'Rebuild will delete existing wiki pages (sources/ is preserved).',
      );
    }

    consola.info(`Rebuilding knowledge base at ${vaultRoot} from ${from}`);

    const report = await runRebuild({
      vaultRoot,
      from,
      reset,
      schemaPacksRoot: resolveSchemaPacksRoot(),
      noDraft: args.noDraft,
      noCache: args.noCache,
      skipValidate: args.skipValidate,
      dryRun: args.dryRun,
      model: resolveModelArgs(args),
      onSourceStart: (source, index, total) => {
        consola.info(`[${index}/${total}] Ingesting ${source.uri}`);
      },
      onStepFinish: (step) => {
        for (const call of step.toolCalls) {
          logAgentStep(call.toolName, call.input);
        }
      },
      onWarning: (message) => {
        consola.warn(message);
      },
    });

    if (args.dryRun) {
      consola.info(`Dry run — ${report.sources.length} source(s) would be rebuilt.`);
      for (const source of report.sources) {
        consola.log(`  • [${source.origin}] ${source.uri}`);
      }
      if (report.reset) {
        consola.info('Wiki pages would be reset before re-ingesting.');
      }
      return;
    }

    if (report.reset) {
      consola.info(`Removed ${report.pagesRemoved} wiki page(s).`);
    }

    consola.success(`Rebuilt from ${report.sources.length} source(s).`);
    if (report.indexesRebuilt.length > 0) {
      consola.success(`Regenerated ${report.indexesRebuilt.length} index.md file(s).`);
    }

    const failed = report.results.filter((item) => item.status !== 'complete');
    for (const item of report.results) {
      const label =
        item.status === 'complete'
          ? 'OK'
          : item.status === 'rejected'
            ? 'REJECTED'
            : 'INCOMPLETE';
      consola.log(`  • [${label}] ${item.source}`);
    }

    if (report.draftBranch) {
      consola.info(`Draft branch: ${report.draftBranch}`);
      consola.info('Review changes, then run `memoss approve` or `memoss reject`.');
    }

    if (failed.some((item) => item.status === 'rejected')) {
      process.exit(ExitCode.INGEST_REJECTED);
    }

    if (failed.some((item) => item.status === 'incomplete')) {
      process.exit(ExitCode.AGENT_INCOMPLETE);
    }
  },
});
