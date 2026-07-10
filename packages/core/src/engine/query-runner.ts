import {
  buildSystemPrompt,
  createPromptContext,
  QUERY_COMPARISON_INSTRUCTIONS,
  QUERY_SAVE_HEURISTIC,
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

export async function runQuery(opts: QueryRunOptions): Promise<QueryRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const setup = createRunnerSetup({
    vaultRoot: opts.vaultRoot,
    draftMode: opts.save ?? false,
  });

  const extra: Record<string, string> = {};
  if (opts.save) {
    extra.save_instructions = QUERY_SAVE_INSTRUCTIONS;
  } else if (opts.suggestSave) {
    extra.save_instructions = QUERY_SAVE_HEURISTIC;
  }
  if (opts.format === 'comparison') {
    extra.format_instructions = QUERY_COMPARISON_INSTRUCTIONS;
  }

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'query',
    extra,
  });

  const toolNames = opts.save ? QUERY_SAVE_TOOL_NAMES : QUERY_TOOL_NAMES;
  const tools = pickTools(setup.tools, toolNames);
  const model = resolveRunnerModel(setup.config, 'flash', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: opts.question,
    tools,
    maxSteps: setup.config.agent.max_steps,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (summary) => {
      if (opts.onTextDelta && summary.text) {
        opts.onTextDelta(summary.text);
      }
      opts.onStepFinish?.(summary);
    },
  });

  return { ...agentResult };
}
