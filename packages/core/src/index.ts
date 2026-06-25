export * from './okf/types.js';
export { parseOKF, serializeOKF } from './okf/document.js';
export { validateForRead, validateForWrite } from './okf/validator.js';
export {
  conceptIdToPath,
  isReservedFilename,
  parseConceptId,
  pathToConceptId,
  resolveLink,
  RESERVED_FILENAMES,
} from './okf/paths.js';
export { regenerateIndexes } from './okf/index-builder.js';
export { FsKnowledgeStore } from './adapters/fs-store.js';
export {
  createDraftBranchName,
  SimpleGitAdapter,
} from './adapters/simple-git.js';
export { fetchUrl, type FetchResult } from './adapters/fetch.js';
export { createSourceAdapter } from './adapters/source-registry.js';
export type {
  CreateSourceAdapterInput,
  GitAdapter,
  GitCommit,
  KnowledgeStore,
  SourceAdapter,
  SourceContent,
  SourceItem,
  SourceKind,
} from './adapters/types.js';
export { createToolRegistry, TOOL_NAMES, type ToolName, type ToolRegistry } from './tools/registry.js';
export { getToolInputSchema } from './tools/extract-schema.js';
export {
  appendLogSchema,
  emptySchema,
  fetchUrlSchema,
  gitCommitSchema,
  gitCreateBranchSchema,
  gitDiffSchema,
  gitLogSchema,
  gitMergeSchema,
  listPagesSchema,
  pathSchema,
  readIndexSchema,
  readSourceSchema,
  runIngestSchema,
  runLintSchema,
  runQuerySchema,
  searchKbSchema,
  writeIndexSchema,
  writePageSchema,
} from './tools/tool-schemas.js';
export { loadVaultConfig, parseVaultConfig, createDefaultVaultConfig, type VaultConfig, type ModelSpec } from './config/vault-config.js';
export { discoverVaultPath, isVaultRoot } from './config/vault-discovery.js';
export {
  runIngest,
  runQuery,
  runLint,
  runAgentLoop,
  resolveModel,
  parseModelOverride,
  buildSystemPrompt,
  pickTools,
  type AgentResult,
  type IngestRunOptions,
  type QueryRunOptions,
  type LintRunOptions,
} from './engine/index.js';
export { createRunnerSetup } from './engine/index.js';
export { generateGraphHtml, type GraphGenerationResult } from './viewer/generate.js';

export {
  MemossError,
  OKFDocumentError,
  OKFValidationError,
  type ErrorCode,
} from './errors.js';

export const CORE_VERSION = '0.0.1';
