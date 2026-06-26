import { describe, expect, it } from 'vitest';
import { deepMergeRecord } from './merge.js';

describe('deepMergeRecord', () => {
  it('merges nested objects with override precedence', () => {
    const merged = deepMergeRecord(
      {
        name: 'user',
        agent: {
          default_model: { provider: 'openai', model: 'gpt-4o' },
          max_steps: 25,
        },
      },
      {
        name: 'vault',
        agent: {
          default_model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      },
    );

    expect(merged).toEqual({
      name: 'vault',
      agent: {
        default_model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        max_steps: 25,
      },
    });
  });
});
