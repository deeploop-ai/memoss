import { MemossError } from '../errors.js';
import { buildSystemPrompt, createPromptContext } from './context.js';
import { INGEST_TOOL_NAMES, pickTools } from './pick-tools.js';
import { runAgentLoop } from './orchestrator.js';
import {
  createRunnerSetup,
  createSourceForIngest,
  ensureDraftBranch,
  inferSourceKind,
  resolveRunnerModel,
  vaultExists,
} from './runner-setup.js';
import type { IngestRunOptions, IngestRunResult } from './types.js';
import { summarizeAgentStep } from './step-summary.js';

function buildIngestPrompt(source: string, kind: string): string {
  return [
    'Ingest the following source into the knowledge base.',
    '',
    `Source URI: ${source}`,
    `Source kind: ${kind}`,
    '',
    'Read the source, analyze the knowledge base, update affected pages, create new pages as needed,',
    'refresh indexes, append to the activity log, and commit when complete.',
  ].join('\n');
}

export async function runIngest(
  opts: IngestRunOptions,
): Promise<IngestRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const sourceKind = opts.kind ?? 'auto';
  const resolvedKind =
    sourceKind === 'auto' ? inferSourceKind(opts.source) : sourceKind;
  const source = createSourceForIngest(opts.source, sourceKind);

  const useDraft = !opts.noDraft;
  const setup = createRunnerSetup({
    vaultRoot: opts.vaultRoot,
    source,
    draftMode: useDraft,
  });

  let draftBranch: string | undefined;
  if (useDraft) {
    draftBranch = await ensureDraftBranch(setup.ctx, 'ingest');
  }

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'ingest',
  });

  const tools = pickTools(setup.tools, INGEST_TOOL_NAMES);
  const model = resolveRunnerModel(setup.config, 'default', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: buildIngestPrompt(opts.source, resolvedKind),
    tools,
    maxSteps: setup.config.agent.max_steps,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      opts.onStepFinish?.(summarizeAgentStep(step, 0));
    },
  });

  let diff: string | undefined;
  if (useDraft && setup.config.git.enabled) {
    diff = await setup.ctx.git.diff();
  }

  return {
    ...agentResult,
    draftBranch,
    diff,
  };
}
