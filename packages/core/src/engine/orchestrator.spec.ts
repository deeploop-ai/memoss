import { describe, expect, it, vi } from 'vitest';
import { runAgentLoop } from './orchestrator.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from 'ai';

const mockedGenerateText = vi.mocked(generateText);

describe('runAgentLoop', () => {
  it('returns complete when finishReason is stop', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'Done.',
      finishReason: 'stop',
      steps: [{ text: 'Done.', toolCalls: [] }],
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgentLoop({
      model: {} as never,
      system: 'sys',
      prompt: 'go',
      tools: {},
      maxSteps: 5,
      temperature: 0.3,
    });

    expect(result.status).toBe('complete');
    expect(result.text).toBe('Done.');
    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'sys',
        prompt: 'go',
        temperature: 0.3,
      }),
    );
  });

  it('returns incomplete when finishReason is tool-calls', async () => {
    mockedGenerateText.mockResolvedValue({
      text: '',
      finishReason: 'tool-calls',
      steps: [{ text: '', toolCalls: [{ toolName: 'read_page', input: {} }] }],
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await runAgentLoop({
      model: {} as never,
      system: 'sys',
      prompt: 'go',
      tools: {},
      maxSteps: 2,
      temperature: 0.3,
    });

    expect(result.status).toBe('incomplete');
    expect(result.finishReason).toBe('tool-calls');
  });
});
