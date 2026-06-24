import type { StepResult } from 'ai';
import type { ToolSet } from 'ai';
import type { AgentStepSummary } from './types.js';

export function summarizeAgentStep<TOOLS extends ToolSet>(
  step: StepResult<TOOLS>,
  stepNumber: number,
): AgentStepSummary {
  return {
    stepNumber,
    text: step.text,
    toolCalls: step.toolCalls.map((call) => ({
      toolName: call.toolName,
      input: 'input' in call ? call.input : undefined,
    })),
  };
}
