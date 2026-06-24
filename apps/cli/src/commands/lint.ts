import { defineCommand } from 'citty';
import { consola } from 'consola';
import { runLint } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import { resolveModelArgs } from '../utils/model-args.js';
import { logAgentStep } from '../utils/errors.js';
import { ExitCode } from '../exit-codes.js';

export const lintCommand = defineCommand({
  meta: {
    name: 'lint',
    description: 'Audit the knowledge base for quality issues',
  },
  args: {
    fix: {
      type: 'boolean',
      description: 'Propose fixes on a draft branch',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output machine-readable JSON',
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

    const result = await runLint({
      vaultRoot,
      fix: args.fix,
      model: resolveModelArgs(args),
      onStepFinish: (step) => {
        for (const call of step.toolCalls) {
          logAgentStep(call.toolName, call.input);
        }
      },
    });

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            status: result.status,
            text: result.text,
            draftBranch: result.draftBranch,
            finishReason: result.finishReason,
            totalSteps: result.totalSteps,
          },
          null,
          2,
        ),
      );
    } else if (result.text) {
      consola.log(result.text);
    }

    if (result.draftBranch) {
      consola.info(`Draft branch: ${result.draftBranch}`);
      consola.info('Review fixes, then run `memoss approve` or `memoss reject`.');
    }

    if (result.status === 'incomplete') {
      process.exit(ExitCode.AGENT_INCOMPLETE);
    }

    if (/^\s*\*\*\*?\s*error/i.test(result.text) || /\berror:\s*\d+/i.test(result.text)) {
      process.exit(ExitCode.LINT_ERRORS);
    }
  },
});
