import { createDraftBranchName, SimpleGitAdapter } from '../adapters/simple-git.js';
import { loadVaultConfig, type ModelSpec } from '../config/vault-config.js';
import { runIngest } from '../engine/ingest-runner.js';
import type { AgentStepSummary } from '../engine/types.js';
import { MemossError } from '../errors.js';
import { regenerateIndexes } from '../okf/index-builder.js';
import { vaultExists } from '../engine/runner-setup.js';
import {
  discoverRebuildSources,
  type RebuildSource,
  type RebuildSourceOrigin,
} from './discover-sources.js';
import { resetWikiContent } from './reset-wiki.js';

export interface RebuildOptions {
  vaultRoot: string;
  from?: RebuildSourceOrigin;
  reset?: boolean;
  noDraft?: boolean;
  noCache?: boolean;
  skipValidate?: boolean;
  dryRun?: boolean;
  model?: ModelSpec;
  abortSignal?: AbortSignal;
  onStepFinish?: (step: AgentStepSummary) => void;
  onWarning?: (message: string) => void;
  onSourceStart?: (source: RebuildSource, index: number, total: number) => void;
  onSourceComplete?: (
    source: RebuildSource,
    result: RebuildSourceResult,
    index: number,
    total: number,
  ) => void;
}

export type RebuildSourceStatus = 'complete' | 'incomplete' | 'rejected';

export interface RebuildSourceResult {
  source: string;
  origin: RebuildSourceOrigin;
  status: RebuildSourceStatus;
  text?: string;
  totalSteps?: number;
}

export interface RebuildReport {
  sources: RebuildSource[];
  reset: boolean;
  pagesRemoved: number;
  results: RebuildSourceResult[];
  indexesRebuilt: string[];
  draftBranch?: string;
  dryRun: boolean;
}

export async function runRebuild(opts: RebuildOptions): Promise<RebuildReport> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const from = opts.from ?? 'manifest';
  const sources = discoverRebuildSources(opts.vaultRoot, from);
  if (sources.length === 0) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No sources found (origin: ${from}). Add sources via ingest or place files under sources/raw/.`,
    );
  }

  const reset = opts.reset !== false;
  const dryRun = opts.dryRun === true;

  if (dryRun) {
    return {
      sources,
      reset,
      pagesRemoved: 0,
      results: [],
      indexesRebuilt: [],
      dryRun: true,
    };
  }

  const config = loadVaultConfig(opts.vaultRoot);
  let pagesRemoved = 0;

  if (reset) {
    const resetReport = await resetWikiContent(opts.vaultRoot, config);
    pagesRemoved = resetReport.pagesRemoved;
  }

  const git = new SimpleGitAdapter(opts.vaultRoot);
  const useDraft = !opts.noDraft && config.git.enabled && config.git.draft_branch;
  let draftBranch: string | undefined;

  if (useDraft) {
    if (!(await git.isRepo())) {
      await git.init();
    }
    draftBranch = createDraftBranchName('rebuild');
    await git.createBranch(draftBranch);
  }

  const results: RebuildSourceResult[] = [];
  const total = sources.length;

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]!;
    opts.onSourceStart?.(source, index + 1, total);

    const ingestResult = await runIngest({
      vaultRoot: opts.vaultRoot,
      source: source.uri,
      kind: 'auto',
      extract: 'auto',
      noDraft: true,
      noCache: opts.noCache,
      skipValidate: opts.skipValidate,
      model: opts.model,
      abortSignal: opts.abortSignal,
      onStepFinish: opts.onStepFinish,
      onWarning: opts.onWarning,
      emphasis:
        'Full vault rebuild: treat this as a fresh integration pass. Create or rewrite pages as needed for this source.',
    });

    const result: RebuildSourceResult = {
      source: source.uri,
      origin: source.origin,
      status: ingestResult.status,
      text: ingestResult.text,
      totalSteps: ingestResult.totalSteps,
    };
    results.push(result);
    opts.onSourceComplete?.(source, result, index + 1, total);
  }

  const indexesRebuilt = regenerateIndexes(opts.vaultRoot);

  if (config.git.enabled && config.git.auto_commit) {
    if (!(await git.isRepo())) {
      await git.init();
    }
    await git.commit(
      `chore: rebuild knowledge base from ${sources.length} source(s)`,
    );
  }

  return {
    sources,
    reset,
    pagesRemoved,
    results,
    indexesRebuilt,
    draftBranch,
    dryRun: false,
  };
}
