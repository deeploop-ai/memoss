import type { GitAdapter, KnowledgeStore, SourceAdapter } from '../adapters/types.js';
import type { VaultConfig } from '../config/vault-config.js';
import type { PolicyRunner } from '../policies/runner.js';

export interface ToolContext {
  store: KnowledgeStore;
  git: GitAdapter;
  config: VaultConfig;
  policies: PolicyRunner;
  source?: SourceAdapter;
  draftMode: boolean;
}
