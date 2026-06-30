import { describe, expect, it, vi } from 'vitest';
import { runAgentLoop, runAgentStream } from './orchestrator.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

import { generateText, streamText } from 'ai';

const mockedGenerateText = vi.mocked(generateText);
const mockedStreamText = vi.mocked(streamText);

describe('runAgentLoop', () => {
  it('returns complete status when finishReason is stop', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Done.',
      finishReason: 'stop',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgentLoop({
      model: { modelId: 'mock' } as never,
      system: 'sys',
      prompt: 'go',
      tools: {},
      maxSteps: 5,
    });

    expect(result.status).toBe('complete');
    expect(result.finishReason).toBe('stop');
  });

  it('returns error status when generateText throws', async () => {
    mockedGenerateText.mockRejectedValue(new Error('network timeout'));

    const result = await runAgentLoop({
      model: { modelId: 'mock' } as never,
      system: 'sys',
      prompt: 'go',
      tools: {},
      maxSteps: 5,
    });

    expect(result.status).toBe('error');
    expect(result.finishReason).toBe('error');
    expect(result.text).toContain('network timeout');
  });

  it('returns incomplete status for length finishReason', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Truncated.',
      finishReason: 'length',
      steps: [],
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgentLoop({
      model: { modelId: 'mock' } as never,
      system: 'sys',
      prompt: 'go',
      tools: {},
      maxSteps: 5,
    });

    expect(result.status).toBe('incomplete');
    expect(result.finishReason).toBe('length');
  });
});

describe('runAgentStream', () => {
  it('returns error status when streamText throws', async () => {
    mockedStreamText.mockImplementation(() => {
      throw new Error('stream failed');
    });

    const result = await runAgentStream({
      model: { modelId: 'mock' } as never,
      system: 'sys',
      prompt: 'go',
      tools: {},
      maxSteps: 5,
    });

    expect(result.status).toBe('error');
    expect(result.text).toContain('stream failed');
  });
});
