import { defineCommand } from 'citty';
import { consola } from 'consola';
import { runQuery } from '@memoss/core';
import { resolveVaultRoot } from '../utils/vault.js';
import { resolveModelArgs } from '../utils/model-args.js';
import { logAgentStep } from '../utils/errors.js';
import { ExitCode } from '../exit-codes.js';

export const queryCommand = defineCommand({
  meta: {
    name: 'query',
    description: 'Ask a question against the knowledge base',
  },
  args: {
    question: {
      type: 'positional',
      description: 'Question to ask',
      required: true,
    },
    save: {
      type: 'boolean',
      description: 'Save the answer as a Note in notes/',
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

    const result = await runQuery({
      vaultRoot,
      question: args.question,
      save: args.save,
      model: resolveModelArgs(args),
      onStepFinish: (step) => {
        for (const call of step.toolCalls) {
          logAgentStep(call.toolName, call.input);
        }
      },
    });

    if (result.text) {
      consola.log(result.text);
    }

    if (result.status === 'incomplete') {
      consola.warn('Agent stopped before completing (max steps reached).');
      process.exit(ExitCode.AGENT_INCOMPLETE);
    }
  },
});
