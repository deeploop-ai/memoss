import { MemossError } from '../errors.js';
import {
  buildSystemPrompt,
  createPromptContext,
  LINT_FIX_INSTRUCTIONS,
} from './context.js';
import {
  LINT_FIX_TOOL_NAMES,
  LINT_TOOL_NAMES,
  pickTools,
} from './pick-tools.js';
import { runAgentLoop } from './orchestrator.js';
import {
  createRunnerSetup,
  ensureDraftBranch,
  resolveRunnerModel,
  vaultExists,
} from './runner-setup.js';
import type { LintRunOptions, LintRunResult } from './types.js';
import { summarizeAgentStep } from './step-summary.js';
import { runVaultLintChecks } from '../lint/vault-lint.js';
import { buildLintReport, writeLintReport, type LintReport } from '../lint/report.js';

function formatDeterministicIssuesForPrompt(
  report: LintReport,
): string {
  if (report.issues.length === 0) {
    return '_No deterministic issues found._';
  }
  const lines = [
    `Health score (deterministic): ${report.health_score}/100`,
    `Issues: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.info} info`,
    '',
  ];
  for (const issue of report.issues.slice(0, 40)) {
    lines.push(
      `- [${issue.severity}] ${issue.code}${issue.path ? ` @ ${issue.path}` : ''}: ${issue.message}`,
    );
  }
  if (report.issues.length > 40) {
    lines.push(`- ... and ${report.issues.length - 40} more`);
  }
  return lines.join('\n');
}

export async function runLint(opts: LintRunOptions): Promise<LintRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const setup = createRunnerSetup({
    vaultRoot: opts.vaultRoot,
    draftMode: opts.fix ?? false,
  });

  const deterministic = await runVaultLintChecks({
    vaultRoot: opts.vaultRoot,
    config: setup.config,
  });
  let report = buildLintReport({
    issues: deterministic.issues,
    pageCount: deterministic.pageCount,
  });

  let draftBranch: string | undefined;
  if (opts.fix) {
    draftBranch = await ensureDraftBranch(setup.ctx, 'lint');
  }

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const fixInstructions = opts.fix
    ? `${LINT_FIX_INSTRUCTIONS}\n\nWhen fixing orphan pages, add file-relative cross-links from related concept pages.`
    : '';

  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'lint',
    extra: {
      fix_instructions: fixInstructions,
      deterministic_lint: formatDeterministicIssuesForPrompt(report),
    },
  });

  const toolNames = opts.fix ? LINT_FIX_TOOL_NAMES : LINT_TOOL_NAMES;
  const tools = pickTools(setup.tools, toolNames);
  const model = resolveRunnerModel(setup.config, 'flash', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: [
      'Audit the knowledge base and produce a lint report.',
      'Incorporate the deterministic findings below; add any additional issues you find (especially contradictions).',
      'List every issue with severity (error / warning / info), affected paths, and a short explanation.',
      'End with a one-line summary: "Health: N/100 (deterministic baseline was X/100)" using your judgment.',
    ].join('\n'),
    tools,
    maxSteps: setup.config.agent.max_steps,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      opts.onStepFinish?.(summarizeAgentStep(step, 0));
    },
  });

  report = buildLintReport({
    issues: deterministic.issues,
    pageCount: deterministic.pageCount,
    agentSummary: agentResult.text,
  });

  if (opts.reportPath) {
    writeLintReport(opts.reportPath, report);
  }

  let diff: string | undefined;
  if (opts.fix && setup.config.git.enabled) {
    diff = await setup.ctx.git.diff();
  }

  return {
    ...agentResult,
    draftBranch,
    diff,
    report,
    minScoreFailed:
      opts.minScore !== undefined && report.health_score < opts.minScore,
  };
}

/** Deterministic-only lint (no LLM). */
export async function runLintDeterministic(
  vaultRoot: string,
): Promise<LintReport> {
  if (!vaultExists(vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${vaultRoot}`,
    );
  }
  const setup = createRunnerSetup({ vaultRoot });
  const check = await runVaultLintChecks({
    vaultRoot,
    config: setup.config,
  });
  return buildLintReport({
    issues: check.issues,
    pageCount: check.pageCount,
  });
}
