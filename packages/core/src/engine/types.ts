import type { FinishReason, LanguageModel, StepResult, ToolSet } from 'ai';
import type { ModelSpec } from '../config/vault-config.js';
import type { SourceKind } from '../adapters/types.js';
import type { ExtractKind, ExtractMeta, ExtractRoute } from '../skills/types.js';

export type AgentStatus = 'complete' | 'incomplete';

export interface AgentStepSummary {
  stepNumber: number;
  text: string;
  toolCalls: Array<{
    toolName: string;
    input: unknown;
  }>;
}

export interface AgentResult {
  status: AgentStatus;
  text: string;
  steps: AgentStepSummary[];
  finishReason: FinishReason;
  totalSteps: number;
}

export interface AgentLoopOptions<TOOLS extends ToolSet> {
  model: LanguageModel;
  system: string;
  prompt: string;
  tools: TOOLS;
  maxSteps: number;
  temperature: number;
  abortSignal?: AbortSignal;
  onStepFinish?: (step: StepResult<TOOLS>) => void;
}

export interface RunnerBaseOptions {
  vaultRoot: string;
  model?: ModelSpec;
  abortSignal?: AbortSignal;
  onStepFinish?: (step: AgentStepSummary) => void;
}

export interface ValidateRunOptions extends RunnerBaseOptions {
  source: string;
  kind?: SourceKind | 'auto';
  originalSource?: string;
  extracted?: boolean;
}

export type ValidationMethod = 'heuristic' | 'agent';

export interface ValidateRunResult {
  approved: boolean;
  summary: string;
  issues: string[];
  method: ValidationMethod;
  status: AgentStatus;
  text: string;
  steps: AgentStepSummary[];
  finishReason: FinishReason;
  totalSteps: number;
}

export interface IngestRunOptions extends RunnerBaseOptions {
  source: string;
  kind?: SourceKind | 'auto';
  noDraft?: boolean;
  extract?: boolean | 'auto';
  skill?: string;
  noExtract?: boolean;
  noCache?: boolean;
  skipValidate?: boolean;
  skipTuning?: boolean;
  emphasis?: string;
  qualityOverlay?: string;
  crawl?: ExtractRunOptions['crawl'];
  onWarning?: (message: string) => void;
}

export interface ExtractRunOptions extends RunnerBaseOptions {
  source: string;
  kind?: SourceKind | 'auto';
  skill?: string;
  onWarning?: (message: string) => void;
  noCache?: boolean;
  crawl?: {
    maxPages?: number;
    allowedHosts?: string[];
  };
}

export type ExtractRunStatus = 'complete' | 'incomplete' | 'skipped';

export interface ExtractRunResult {
  status: ExtractRunStatus;
  source: string;
  outputPath: string;
  extractKind: ExtractKind;
  route: ExtractRoute;
  meta?: ExtractMeta;
  cached?: boolean;
  text?: string;
  steps?: AgentStepSummary[];
  finishReason?: FinishReason;
  totalSteps?: number;
}

export interface QueryRunOptions extends RunnerBaseOptions {
  question: string;
  save?: boolean;
  suggestSave?: boolean;
  format?: 'default' | 'comparison';
  onTextDelta?: (delta: string) => void;
}

export interface LintRunOptions extends RunnerBaseOptions {
  fix?: boolean;
  minScore?: number;
  reportPath?: string;
}

export type IngestRunStatus = AgentStatus | 'rejected';

export interface IngestRunResult extends Omit<AgentResult, 'status'> {
  status: IngestRunStatus;
  draftBranch?: string;
  diff?: string;
  validation?: ValidateRunResult;
  affects?: string[];
}

export interface QueryRunResult extends AgentResult {
  savedNotePath?: string;
}

export interface LintRunResult extends AgentResult {
  draftBranch?: string;
  diff?: string;
  report?: import('../lint/report.js').LintReport;
  minScoreFailed?: boolean;
}
