import { defineCommand } from 'citty';
import { consola } from 'consola';
import { runIngest, type SourceKind } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import { resolveModelArgs } from '../utils/model-args.js';
import { logAgentStep } from '../utils/errors.js';
import { ExitCode } from '../exit-codes.js';

export const ingestCommand = defineCommand({
  meta: {
    name: 'ingest',
    description: 'Ingest a source into the knowledge base',
  },
  args: {
    source: {
      type: 'positional',
      description: 'Source URI or path',
      required: true,
    },
    type: {
      type: 'string',
      description: 'Source type',
      default: 'auto',
    },
    noDraft: {
      type: 'boolean',
      description: 'Write directly without creating a draft branch',
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
    const kind = args.type as SourceKind | 'auto';

    consola.info(`Ingesting ${args.source} into ${vaultRoot}`);

    const result = await runIngest({
      vaultRoot,
      source: args.source,
      kind,
      noDraft: args.noDraft,
      model: resolveModelArgs(args),
      onStepFinish: (step) => {
        for (const call of step.toolCalls) {
          logAgentStep(call.toolName, call.input);
        }
      },
    });

    if (result.draftBranch) {
      consola.info(`Draft branch: ${result.draftBranch}`);
    }

    if (result.text) {
      consola.log(result.text);
    }

    if (result.diff?.trim()) {
      consola.box('Diff summary');
      consola.log(result.diff);
      consola.info('Review changes, then run `memoss approve` or `memoss reject`.');
    }

    if (result.status === 'incomplete') {
      consola.warn('Agent stopped before completing (max steps reached).');
      process.exit(ExitCode.AGENT_INCOMPLETE);
    }
  },
});
