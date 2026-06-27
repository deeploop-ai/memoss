import { MemossError } from '../errors.js';
import { buildSystemPrompt, createPromptContext } from '../engine/context.js';
import { runAgentLoop } from '../engine/orchestrator.js';
import {
  createRunnerSetup,
  resolveRunnerModel,
  vaultExists,
} from '../engine/runner-setup.js';
import { summarizeAgentStep } from '../engine/step-summary.js';
import type { RunnerBaseOptions } from '../engine/types.js';
import {
  createShellToolRegistry,
  type ShellProposalState,
} from './shell-tools.js';
import type { ShellSession } from './session.js';

const SHELL_MAX_STEPS = 8;

export interface ShellAgentTurnOptions extends RunnerBaseOptions {
  message: string;
  session: ShellSession;
}

export interface ShellAgentTurnResult {
  text: string;
  proposal?: ShellProposalState['proposal'];
  status: 'complete' | 'incomplete';
}

export async function runShellAgentTurn(
  opts: ShellAgentTurnOptions,
): Promise<ShellAgentTurnResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const setup = createRunnerSetup({ vaultRoot: opts.vaultRoot });
  const state: ShellProposalState = {};
  const tools = createShellToolRegistry(setup.ctx, state);

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'shell',
    extra: {
      session_context: opts.session.formatSessionContext(),
      last_task_result: opts.session.formatLastTaskResult(),
    },
  });

  const model = resolveRunnerModel(setup.config, 'flash', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: opts.message,
    tools,
    maxSteps: SHELL_MAX_STEPS,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      opts.onStepFinish?.(summarizeAgentStep(step, 0));
    },
  });

  return {
    text: agentResult.text,
    proposal: state.proposal,
    status: agentResult.status,
  };
}
