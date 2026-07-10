import { registerIngestProvenance } from '../provenance/manifest.js';
import { sourceManifestId } from '../provenance/hash.js';
import { tryHashLocalSource } from '../skills/source-identity.js';
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
import { runValidate } from './validate-runner.js';
import { runTuningPass } from './tuning-runner.js';

function buildIngestPrompt(
  source: string,
  kind: string,
  emphasis?: string,
): string {
  const lines = [
    'Ingest the following source into the knowledge base.',
    '',
    `Source URI: ${source}`,
    `Source kind: ${kind}`,
    '',
    'Read the source, analyze the knowledge base, update affected pages, create new pages as needed,',
    'refresh indexes, append to the activity log, and commit when complete.',
  ];
  if (emphasis) {
    lines.push('', `User emphasis: ${emphasis}`);
  }
  return lines.join('\n');
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
    crawl: opts.crawl,
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

    if (!validation.approved || validation.status !== 'complete') {
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

  let qualityOverlay = opts.qualityOverlay ?? '';
  if (!opts.skipTuning && !qualityOverlay) {
    const tuning = await runTuningPass({
      vaultRoot: opts.vaultRoot,
      source: resolved.source,
      kind: resolvedKind,
      emphasis: opts.emphasis,
      model: opts.model,
      abortSignal: opts.abortSignal,
      onStepFinish: opts.onStepFinish,
    });
    qualityOverlay = tuning.overlay;
  } else if (opts.emphasis && !qualityOverlay) {
    qualityOverlay = `**User emphasis:** ${opts.emphasis}`;
  }

  const source = createSourceForIngest(resolved.source, resolved.kind);

  const useDraft = !opts.noDraft;
  const setup = createRunnerSetup({
    vaultRoot: opts.vaultRoot,
    source,
    draftMode: useDraft,
  });

  setup.ctx.policies.reset();

  const rawContentHash =
    resolved.extractMeta?.raw_content_hash ??
    tryHashLocalSource(resolved.originalSource, opts.vaultRoot);
  setup.ctx.ingestSourceId = sourceManifestId(
    resolved.originalSource,
    rawContentHash,
  );

  let draftBranch: string | undefined;
  if (useDraft) {
    draftBranch = await ensureDraftBranch(setup.ctx, 'ingest');
  }

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'ingest',
    extra: {
      quality_overlay: qualityOverlay || '_No session overlay._',
    },
  });

  const tools = pickTools(setup.tools, INGEST_TOOL_NAMES);
  const model = resolveRunnerModel(setup.config, 'default', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: buildIngestPrompt(resolved.source, resolvedKind, opts.emphasis),
    tools,
    maxSteps: setup.config.agent.max_steps,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: opts.onStepFinish,
  });

  let diff: string | undefined;
  if (useDraft && setup.config.git.enabled) {
    diff = await setup.ctx.git.diff();
  }

  const affects = [...setup.ctx.policies.writtenPages];
  const trackProvenance =
    setup.config.provenance.enabled ||
    setup.config.policies.provenance.track_affects;

  if (trackProvenance && affects.length > 0) {
    registerIngestProvenance(opts.vaultRoot, {
      sourceUri: resolved.originalSource,
      rawContentHash,
      affects,
    });
  }

  return {
    ...agentResult,
    draftBranch,
    diff,
    affects,
  };
}
