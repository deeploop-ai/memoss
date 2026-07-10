import type { SourceAdapter, SourceKind } from '../adapters/types.js';
import { MemossError } from '../errors.js';
import { checkSourceContent } from '../validation/content-heuristics.js';
import {
  createValidateToolRegistry,
  reportValidationSchema,
  type ValidationReport,
  type ValidationReportState,
} from '../tools/validate-tools.js';
import { buildSystemPrompt, createPromptContext } from './context.js';
import { runAgentLoop } from './orchestrator.js';
import {
  createRunnerSetup,
  createSourceForIngest,
  inferSourceKind,
  resolveRunnerModel,
  vaultExists,
} from './runner-setup.js';
import type { AgentStepSummary, ValidateRunOptions, ValidateRunResult } from './types.js';

const VALIDATE_MAX_STEPS = 8;

async function readAllSourceText(source: SourceAdapter): Promise<string> {
  const items = await source.listItems();
  const parts: string[] = [];
  for (const item of items) {
    const content = await source.readItem(item.id);
    parts.push(content.text);
  }
  return parts.join('\n\n');
}

function findReportInSteps(steps: AgentStepSummary[]): ValidationReport | undefined {
  for (const step of steps) {
    for (const call of step.toolCalls) {
      if (call.toolName === 'report_validation' && call.input) {
        const parsed = reportValidationSchema.safeParse(call.input);
        if (parsed.success) {
          return parsed.data;
        }
      }
    }
  }
  return undefined;
}

function buildValidatePrompt(opts: {
  sourceUri: string;
  originalSource: string;
  extracted: boolean;
}): string {
  return [
    'Validate whether the following source is suitable for knowledge-base ingestion.',
    '',
    `Source to review: ${opts.sourceUri}`,
    opts.originalSource !== opts.sourceUri
      ? `Original URI: ${opts.originalSource}`
      : '',
    `Already extracted: ${opts.extracted ? 'yes' : 'no'}`,
    '',
    'Read the source, then call report_validation with your verdict.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runValidate(
  opts: ValidateRunOptions,
): Promise<ValidateRunResult> {
  if (!vaultExists(opts.vaultRoot)) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `No vault found at ${opts.vaultRoot}`,
    );
  }

  const sourceKind: SourceKind | 'auto' =
    opts.kind === undefined || opts.kind === 'auto'
      ? inferSourceKind(opts.source)
      : opts.kind;
  const source = createSourceForIngest(opts.source, sourceKind);
  const setup = createRunnerSetup({
    vaultRoot: opts.vaultRoot,
    source,
  });

  const text = await readAllSourceText(source);
  const heuristic = checkSourceContent(text);

  if (heuristic.blocking) {
    return {
      approved: false,
      summary: 'Source content failed automated pre-ingest checks.',
      issues: heuristic.issues,
      method: 'heuristic',
      status: 'complete',
      text: heuristic.issues.join('\n'),
      steps: [],
      finishReason: 'stop',
      totalSteps: 0,
    };
  }

  const reportState: ValidationReportState = {};
  const tools = createValidateToolRegistry(setup.ctx, reportState);

  const promptCtx = createPromptContext(opts.vaultRoot, setup.config);
  const system = buildSystemPrompt({
    ...promptCtx,
    prompt: 'validate',
    extra: {
      source_uri: opts.source,
      source_kind: sourceKind,
      extracted: opts.extracted ? 'yes' : 'no',
      heuristic_notes: '_No automated blocking issues detected._',
    },
  });

  const model = resolveRunnerModel(setup.config, 'flash', opts.model);

  const agentResult = await runAgentLoop({
    model,
    system,
    prompt: buildValidatePrompt({
      sourceUri: opts.source,
      originalSource: opts.originalSource ?? opts.source,
      extracted: opts.extracted ?? false,
    }),
    tools,
    maxSteps: VALIDATE_MAX_STEPS,
    temperature: setup.config.agent.temperature,
    abortSignal: opts.abortSignal,
    onStepFinish: opts.onStepFinish,
  });

  const report =
    reportState.report ?? findReportInSteps(agentResult.steps);

  if (!report) {
    return {
      approved: false,
      summary: 'Validation agent did not submit a verdict.',
      issues: [
        'The validation agent finished without calling report_validation.',
        'Ingest was aborted as a precaution.',
      ],
      method: 'agent',
      status: agentResult.status,
      text: agentResult.text,
      steps: agentResult.steps,
      finishReason: agentResult.finishReason,
      totalSteps: agentResult.totalSteps,
    };
  }

  return {
    approved: report.approved && agentResult.status === 'complete',
    summary: report.summary,
    issues:
      agentResult.status === 'complete'
        ? report.issues
        : [
            ...report.issues,
            `Validation agent did not complete successfully (status: ${agentResult.status}).`,
          ],
    method: 'agent',
    status: agentResult.status,
    text: agentResult.text,
    steps: agentResult.steps,
    finishReason: agentResult.finishReason,
    totalSteps: agentResult.totalSteps,
  };
}
