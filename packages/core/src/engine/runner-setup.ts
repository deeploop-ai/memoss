import { existsSync } from 'node:fs';
import { createDraftBranchName, SimpleGitAdapter } from '../adapters/simple-git.js';
import { createSourceAdapter } from '../adapters/source-registry.js';
import type { SourceAdapter, SourceKind } from '../adapters/types.js';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { loadVaultConfig, type ModelSpec, type VaultConfig } from '../config/vault-config.js';
import { PolicyRunner } from '../policies/runner.js';
import { createToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/context.js';
import { resolveModel } from './model-registry.js';
import type { LanguageModel } from 'ai';

export interface RunnerSetup {
  vaultRoot: string;
  config: VaultConfig;
  ctx: ToolContext;
  tools: ReturnType<typeof createToolRegistry>;
}

export function inferSourceKind(source: string): SourceKind {
  if (/^https?:\/\//i.test(source)) {
    if (/github\.com/i.test(source)) {
      return 'github';
    }
    return 'web';
  }
  return 'file';
}

export interface RunnerSetupOptions {
  vaultRoot: string;
  source?: SourceAdapter;
  draftMode?: boolean;
}

export function createRunnerSetup(opts: RunnerSetupOptions): RunnerSetup {
  const config = loadVaultConfig(opts.vaultRoot);

  const ctx: ToolContext = {
    store: new FsKnowledgeStore(opts.vaultRoot),
    git: new SimpleGitAdapter(opts.vaultRoot),
    config,
    policies: new PolicyRunner(),
    source: opts.source,
    draftMode: opts.draftMode ?? config.git.draft_branch,
  };

  return {
    vaultRoot: opts.vaultRoot,
    config,
    ctx,
    tools: createToolRegistry(ctx),
  };
}

export async function ensureDraftBranch(
  ctx: ToolContext,
  operation: string,
): Promise<string | undefined> {
  if (!ctx.config.git.enabled || !ctx.draftMode) {
    return undefined;
  }

  if (!(await ctx.git.isRepo())) {
    await ctx.git.init();
  }

  const branch = createDraftBranchName(operation);
  await ctx.git.createBranch(branch);
  return branch;
}

export function createSourceForIngest(
  source: string,
  kind: SourceKind | 'auto',
): SourceAdapter {
  const resolvedKind = kind === 'auto' ? inferSourceKind(source) : kind;
  return createSourceAdapter({ kind: resolvedKind, uri: source });
}

export function resolveRunnerModel(
  config: VaultConfig,
  tier: 'default' | 'lightweight',
  override?: ModelSpec,
): LanguageModel {
  const spec =
    override ??
    (tier === 'default'
      ? config.agent.default_model
      : config.agent.lightweight_model);
  return resolveModel(spec);
}

export function vaultExists(vaultRoot: string): boolean {
  return existsSync(vaultRoot) && existsSync(`${vaultRoot}/.memoss/config.yaml`);
}
