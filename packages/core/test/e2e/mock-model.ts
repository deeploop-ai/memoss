import type { ToolSet } from 'ai';

export interface MockToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface MockAgentStep {
  text?: string;
  toolCalls?: MockToolCall[];
  finishReason?: 'stop' | 'length' | 'error';
}

/** Execute tool calls against an AI SDK tool map (from pickTools). */
export async function executeToolCalls(
  tools: ToolSet,
  calls: MockToolCall[],
): Promise<void> {
  for (const call of calls) {
    const tool = tools[call.toolName];
    if (!tool || !('execute' in tool) || typeof tool.execute !== 'function') {
      throw new Error(`Tool "${call.toolName}" is not executable in mock model`);
    }
    await tool.execute(call.input, {
      toolCallId: `mock-${call.toolName}`,
      messages: [],
    });
  }
}

/** Build a generateText mock that runs deterministic tool-call steps. */
export function createMockGenerateTextFromSteps(steps: MockAgentStep[]) {
  let callIndex = 0;

  return async (opts: {
    tools?: ToolSet;
    onStepFinish?: (step: unknown) => void;
  }) => {
    const step = steps[callIndex] ?? steps.at(-1)!;
    callIndex += 1;

    if (step.toolCalls?.length) {
      await executeToolCalls(opts.tools ?? {}, step.toolCalls);
    }

    const summary = {
      text: step.text ?? 'Done.',
      toolCalls: step.toolCalls?.map((call) => ({
        toolName: call.toolName,
        input: call.input,
      })),
    };
    opts.onStepFinish?.(summary);

    return {
      text: step.text ?? 'Done.',
      finishReason: step.finishReason ?? 'stop',
      steps: [summary],
    };
  };
}

/** Approve the current draft branch (mirrors CLI draft-workflow). */
export async function approveDraftBranch(vaultRoot: string): Promise<string> {
  const { SimpleGitAdapter } = await import('../../src/adapters/simple-git.js');
  const { MemossError } = await import('../../src/errors.js');

  const git = new SimpleGitAdapter(vaultRoot);
  const draftBranch = await git.getCurrentBranch();

  if (!draftBranch.startsWith('memoss/draft/')) {
    throw new MemossError(
      'GIT_ERROR',
      `Not on a draft branch (current: ${draftBranch})`,
    );
  }

  const branches = await git.listLocalBranches();
  const mainBranch = branches.includes('main')
    ? 'main'
    : branches.includes('master')
      ? 'master'
      : await git.getCurrentBranch();

  await git.checkout(mainBranch);
  await git.merge(draftBranch, { ffOnly: true });
  await git.deleteBranch(draftBranch);
  return draftBranch;
}
