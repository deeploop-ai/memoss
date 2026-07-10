import { defineCommand } from 'citty';
import { consola } from 'consola';
import { resolve } from 'pathe';
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
    report: {
      type: 'string',
      description: 'Write lint-report.json to this path',
    },
    minScore: {
      type: 'string',
      description: 'Exit non-zero if health_score is below N (CI gate)',
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
    const minScore = args.minScore ? Number.parseInt(args.minScore, 10) : undefined;
    if (args.minScore && Number.isNaN(minScore)) {
      throw new Error(`Invalid --min-score value: ${args.minScore}`);
    }

    const reportPath = args.report ? resolve(args.report) : undefined;

    const result = await runLint({
      vaultRoot,
      fix: args.fix,
      minScore,
      reportPath,
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
            report: result.report,
            minScoreFailed: result.minScoreFailed,
          },
          null,
          2,
        ),
      );
    } else if (result.text) {
      consola.log(result.text);
    }

    if (result.report) {
      consola.info(
        `Health score: ${result.report.health_score}/100 (${result.report.summary.errors} errors, ${result.report.summary.warnings} warnings)`,
      );
    }

    if (reportPath) {
      consola.info(`Lint report written to ${reportPath}`);
    }

    if (result.draftBranch) {
      consola.info(`Draft branch: ${result.draftBranch}`);
      consola.info('Review fixes, then run `memoss approve` or `memoss reject`.');
    }

    if (result.status === 'incomplete') {
      process.exit(ExitCode.AGENT_INCOMPLETE);
    }

    if (result.minScoreFailed) {
      consola.error(
        `Health score ${result.report?.health_score ?? 0} is below minimum ${minScore}.`,
      );
      process.exit(ExitCode.LINT_SCORE);
    }

    if ((result.report?.summary.errors ?? 0) > 0) {
      process.exit(ExitCode.LINT_ERRORS);
    }
  },
});
