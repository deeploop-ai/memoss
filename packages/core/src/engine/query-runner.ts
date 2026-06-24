import {
  buildSystemPrompt,
  createPromptContext,
  QUERY_SAVE_INSTRUCTIONS,
} from './context.js';
import { pickTools, QUERY_SAVE_TOOL_NAMES, QUERY_TOOL_NAMES } from './pick-tools.js';
import { runAgentLoop } from './orchestrator.js';
import {
  createRunnerSetup,
  resolveRunnerModel,
  vaultExists,
} from './runner-setup.js';
import type { QueryRunOptions, QueryRunResult } from './types.js';
import { MemossError } from '../errors.js';
import { summarizeAgentStep } from './step-summary.js';

export async function runQuery(opts: QueryRunOptions): Promise<QueryRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const setup = createRunnerSetup({
    vaultRoot: opts.vaultRoot,
    draftMode: false,
  });

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'query',
    extra: opts.save
      ? { save_instructions: QUERY_SAVE_INSTRUCTIONS }
      : undefined,
  });

  const toolNames = opts.save ? QUERY_SAVE_TOOL_NAMES : QUERY_TOOL_NAMES;
  const tools = pickTools(setup.tools, toolNames);
  const model = resolveRunnerModel(setup.config, 'lightweight', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: opts.question,
    tools,
    maxSteps: setup.config.agent.max_steps,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      opts.onStepFinish?.(summarizeAgentStep(step, 0));
    },
  });

  return { ...agentResult };
}
