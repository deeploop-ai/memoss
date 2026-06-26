import { defineCommand } from 'citty';
import { consola } from 'consola';
import { runExtract, type SourceKind } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import { resolveModelArgs } from '../utils/model-args.js';
import { logAgentStep } from '../utils/errors.js';
import { ExitCode } from '../exit-codes.js';

export const extractCommand = defineCommand({
  meta: {
    name: 'extract',
    description: 'Extract a source to markdown using agent skills',
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
    skill: {
      type: 'string',
      description: 'Extraction skill name (from skills.sh / .agents/skills)',
    },
    model: {
      type: 'string',
      description: 'Model override (provider/model)',
    },
    baseUrl: {
      type: 'string',
      description: 'OpenAI-compatible base URL (with --model openai/...)',
    },
    noCache: {
      type: 'boolean',
      description: 'Bypass extract cache',
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
    const kind = args.type as SourceKind | 'auto';

    consola.info(`Extracting ${args.source} → ${vaultRoot}`);

    const result = await runExtract({
      vaultRoot,
      source: args.source,
      kind,
      skill: args.skill,
      noCache: args.noCache,
      model: resolveModelArgs(args),
      onStepFinish: (step) => {
        for (const call of step.toolCalls) {
          logAgentStep(call.toolName, call.input);
        }
      },
      onWarning: (message) => {
        consola.warn(message);
      },
    });

    if (result.status === 'skipped') {
      consola.info('Extraction skipped (markdown/text source).');
      consola.log(result.outputPath);
      return;
    }

    consola.success(`Wrote ${result.outputPath}`);
    if (result.cached) {
      consola.info('Used cached extraction result.');
    }

    if (result.meta?.fallback) {
      consola.info('Used built-in fallback extractor.');
    } else if (result.meta?.skill) {
      consola.info(`Skill: ${result.meta.skill}`);
    }

    if (result.text) {
      consola.log(result.text);
    }

    if (result.status === 'incomplete') {
      consola.warn('Extract agent stopped before completing (max steps reached).');
      process.exit(ExitCode.AGENT_INCOMPLETE);
    }
  },
});
