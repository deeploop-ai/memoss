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

  let draftBranch: string | undefined;
  if (opts.fix) {
    draftBranch = await ensureDraftBranch(setup.ctx, 'lint');
  }

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'lint',
    extra: opts.fix ? { fix_instructions: LINT_FIX_INSTRUCTIONS } : undefined,
  });

  const toolNames = opts.fix ? LINT_FIX_TOOL_NAMES : LINT_TOOL_NAMES;
  const tools = pickTools(setup.tools, toolNames);
  const model = resolveRunnerModel(setup.config, 'lightweight', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt:
      'Audit the entire knowledge base and produce a lint report. List every issue with severity (error / warning / info), affected paths, and a short explanation.',
    tools,
    maxSteps: setup.config.agent.max_steps,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      opts.onStepFinish?.(summarizeAgentStep(step, 0));
    },
  });

  let diff: string | undefined;
  if (opts.fix && setup.config.git.enabled) {
    diff = await setup.ctx.git.diff();
  }

  return {
    ...agentResult,
    draftBranch,
    diff,
  };
}
