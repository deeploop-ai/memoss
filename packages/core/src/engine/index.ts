export {
  createRunnerSetup,
  createSourceForIngest,
  ensureDraftBranch,
  inferSourceKind,
  resolveRunnerModel,
  vaultExists,
} from './runner-setup.js';
export { runIngest } from './ingest-runner.js';
export { runExtract, resolveIngestSource } from './extract-runner.js';
export { runQuery } from './query-runner.js';
export { runLint } from './lint-runner.js';
export { runAgentLoop } from './orchestrator.js';
export { resolveModel, parseModelOverride } from './model-registry.js';
export {
  buildSystemPrompt,
  createPromptContext,
  loadVaultInstructions,
} from './context.js';
export {
  pickTools,
  INGEST_TOOL_NAMES,
  QUERY_TOOL_NAMES,
  LINT_TOOL_NAMES,
} from './pick-tools.js';
export type {
  AgentResult,
  AgentStatus,
  AgentStepSummary,
  IngestRunOptions,
  IngestRunResult,
  ExtractRunOptions,
  ExtractRunResult,
  QueryRunOptions,
  QueryRunResult,
  LintRunOptions,
  LintRunResult,
} from './types.js';
