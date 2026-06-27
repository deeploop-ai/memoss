import { registerIngestProvenance } from '../provenance/manifest.js';
import { MemossError } from '../errors.js';
import { buildSystemPrompt, createPromptContext } from './context.js';
import { resolveIngestSource } from './extract-runner.js';
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
import type { IngestRunOptions, IngestRunResult, ValidateRunResult } from './types.js';
import { summarizeAgentStep } from './step-summary.js';
import { runValidate } from './validate-runner.js';

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

function formatValidationFailure(validation: ValidateRunResult): string {
  const lines = [validation.summary, ''];
  if (validation.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of validation.issues) {
      lines.push(`- ${issue}`);
    }
  }
  lines.push('', 'Ingest was aborted; no knowledge-base pages were modified.');
  return lines.join('\n');
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
  const resolved = await resolveIngestSource({
    vaultRoot: opts.vaultRoot,
    source: opts.source,
    kind: sourceKind,
    skill: opts.skill,
    extract: opts.noExtract ? false : (opts.extract ?? 'auto'),
    noCache: opts.noCache,
    model: opts.model,
    abortSignal: opts.abortSignal,
    onStepFinish: opts.onStepFinish,
    onWarning: opts.onWarning,
  });

  const resolvedKind =
    resolved.kind === 'auto'
      ? inferSourceKind(resolved.source)
      : resolved.kind;

  if (opts.skipValidate !== true) {
    const validation = await runValidate({
      vaultRoot: opts.vaultRoot,
      source: resolved.source,
      kind: resolvedKind,
      originalSource: resolved.originalSource,
      extracted: resolved.extracted,
      model: opts.model,
      abortSignal: opts.abortSignal,
      onStepFinish: opts.onStepFinish,
    });

    if (!validation.approved) {
      return {
        status: 'rejected',
        text: formatValidationFailure(validation),
        steps: validation.steps,
        finishReason: validation.finishReason,
        totalSteps: validation.totalSteps,
        validation,
      };
    }
  }

  const source = createSourceForIngest(resolved.source, resolved.kind);

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
    prompt: buildIngestPrompt(resolved.source, resolvedKind),
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

  if (setup.config.provenance.enabled && agentResult.status === 'complete') {
    registerIngestProvenance(opts.vaultRoot, {
      sourceUri: resolved.originalSource,
    });
  }

  return {
    ...agentResult,
    draftBranch,
    diff,
  };
}
