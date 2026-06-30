import { generateText, streamText, stepCountIs, type ToolSet } from 'ai';
import type { AgentLoopOptions, AgentResult, AgentStepSummary } from './types.js';
import { summarizeAgentStep } from './step-summary.js';

function summarizeStep<TOOLS extends ToolSet>(
  step: Parameters<NonNullable<AgentLoopOptions<TOOLS>['onStepFinish']>>[0],
  stepNumber: number,
): AgentStepSummary {
  return summarizeAgentStep(step, stepNumber);
}

export async function runAgentLoop<TOOLS extends ToolSet>(
  opts: AgentLoopOptions<TOOLS>,
): Promise<AgentResult> {
  const steps: AgentStepSummary[] = [];

  try {
    const result = await generateText({
      model: opts.model,
      system: opts.system,
      prompt: opts.prompt,
      tools: opts.tools,
      stopWhen: stepCountIs(opts.maxSteps),
      temperature: opts.temperature,
      abortSignal: opts.abortSignal,
      onStepFinish: (step) => {
        const summary = summarizeStep(step, steps.length + 1);
        steps.push(summary);
        opts.onStepFinish?.(step);
      },
    });

    const status =
      result.finishReason === 'stop' ? 'complete'
      : result.finishReason === 'error' ? 'error'
      : 'incomplete';

    return {
      status,
      text: result.text,
      steps,
      finishReason: result.finishReason,
      totalSteps: result.steps.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      text: `Agent error: ${message}`,
      steps,
      finishReason: 'error',
      totalSteps: steps.length,
    };
  }
}

export interface AgentStreamOptions<TOOLS extends ToolSet>
  extends Omit<AgentLoopOptions<TOOLS>, 'onStepFinish'> {
  onTextDelta?: (delta: string) => void;
}

/** Single-turn stream (no tools) for query-style responses. */
export async function runAgentStream<TOOLS extends ToolSet>(
  opts: AgentStreamOptions<TOOLS>,
): Promise<AgentResult> {
  try {
    const result = streamText({
      model: opts.model,
      system: opts.system,
      prompt: opts.prompt,
      tools: opts.tools,
      stopWhen: stepCountIs(opts.maxSteps),
      temperature: opts.temperature,
      abortSignal: opts.abortSignal,
    });

    let text = '';
    for await (const part of result.textStream) {
      text += part;
      opts.onTextDelta?.(part);
    }

    const finishReason = await result.finishReason;

    const status =
      finishReason === 'stop' ? 'complete'
      : finishReason === 'error' ? 'error'
      : 'incomplete';

    return {
      status,
      text,
      steps: [],
      finishReason,
      totalSteps: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      text: `Agent error: ${message}`,
      steps: [],
      finishReason: 'error',
      totalSteps: 0,
    };
  }
}
