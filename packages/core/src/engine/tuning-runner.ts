import { MemossError } from '../errors.js';
import { buildSystemPrompt, createPromptContext } from './context.js';
import { runAgentLoop } from './orchestrator.js';
import {
  createRunnerSetup,
  createSourceForIngest,
  inferSourceKind,
  resolveRunnerModel,
  vaultExists,
} from './runner-setup.js';
import { summarizeAgentStep } from './step-summary.js';
import type { RunnerBaseOptions } from './types.js';
import {
  createTuningToolRegistry,
  formatTuningOverlay,
  type TuningReport,
  type TuningReportState,
} from '../tools/tuning-tools.js';
import type { SourceKind } from '../adapters/types.js';

const TUNING_MAX_STEPS = 10;

export interface TuningRunOptions extends RunnerBaseOptions {
  source: string;
  kind?: SourceKind | 'auto';
  emphasis?: string;
}

export interface TuningRunResult {
  report: TuningReport;
  overlay: string;
  status: 'complete' | 'incomplete';
  text: string;
}

export async function runTuningPass(
  opts: TuningRunOptions,
): Promise<TuningRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const sourceKind =
    opts.kind === undefined || opts.kind === 'auto'
      ? inferSourceKind(opts.source)
      : opts.kind;
  const source = createSourceForIngest(opts.source, sourceKind);
  const setup = createRunnerSetup({ vaultRoot: opts.vaultRoot, source });

  const state: TuningReportState = {};
  const allowFetch = sourceKind === 'web';
  const tools = createTuningToolRegistry(setup.ctx, state, allowFetch);

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'tuning',
  });

  const model = resolveRunnerModel(setup.config, 'flash', opts.model);

  const userLines = [
    'Analyze this source and produce an ingest tuning plan.',
    '',
    `Source: ${opts.source}`,
    `Kind: ${sourceKind}`,
  ];
  if (opts.emphasis) {
    userLines.push(`User emphasis: ${opts.emphasis}`);
  }

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: userLines.join('\n'),
    tools,
    maxSteps: TUNING_MAX_STEPS,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: (step) => {
      opts.onStepFinish?.(summarizeAgentStep(step, 0));
    },
  });

  if (!state.report) {
    return {
      report: {
        summary: 'Tuning agent did not submit a plan; proceeding with default ingest.',
        emphasis: opts.emphasis ? [opts.emphasis] : [],
        skip_patterns: [],
        cross_link_targets: [],
        pack_hints: [],
        proposed_pages: [],
        confidence: 'low',
      },
      overlay: opts.emphasis
        ? `**User emphasis:** ${opts.emphasis}`
        : '_No tuning overlay._',
      status: agentResult.status,
      text: agentResult.text,
    };
  }

  let overlay = formatTuningOverlay(state.report);
  if (opts.emphasis) {
    overlay += `\n\n**User emphasis:** ${opts.emphasis}`;
  }

  return {
    report: state.report,
    overlay,
    status: agentResult.status,
    text: agentResult.text,
  };
}
