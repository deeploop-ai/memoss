import { generateText, stepCountIs, type StepResult, type ToolSet } from 'ai';
import type { AgentLoopOptions, AgentResult, AgentStepSummary } from './types.js';
import { summarizeAgentStep } from './step-summary.js';

function summarizeStep<TOOLS extends ToolSet>(
  step: StepResult<TOOLS>,
  stepNumber: number,
): AgentStepSummary {
  return summarizeAgentStep(step, stepNumber);
}

export async function runAgentLoop<TOOLS extends ToolSet>(
  opts: AgentLoopOptions<TOOLS>,
): Promise<AgentResult> {
  const steps: AgentStepSummary[] = [];

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

  const status = result.finishReason === 'stop' ? 'complete' : 'incomplete';

  return {
    status,
    text: result.text,
    steps,
    finishReason: result.finishReason,
    totalSteps: result.steps.length,
  };
}
