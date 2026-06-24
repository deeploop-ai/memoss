import type { FinishReason, LanguageModel, StepResult, ToolSet } from 'ai';
import type { ModelSpec } from '../config/vault-config.js';
import type { SourceKind } from '../adapters/types.js';

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

export interface IngestRunOptions extends RunnerBaseOptions {
  source: string;
  kind?: SourceKind | 'auto';
  noDraft?: boolean;
}

export interface QueryRunOptions extends RunnerBaseOptions {
  question: string;
  save?: boolean;
}

export interface LintRunOptions extends RunnerBaseOptions {
  fix?: boolean;
}

export interface IngestRunResult extends AgentResult {
  draftBranch?: string;
  diff?: string;
}

export interface QueryRunResult extends AgentResult {
  savedNotePath?: string;
}

export interface LintRunResult extends AgentResult {
  draftBranch?: string;
  diff?: string;
}
