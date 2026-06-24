import { afterEach, describe, expect, it } from 'vitest';
import { MemossError } from '../errors.js';
import { parseModelOverride, resolveModel } from './model-registry.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('resolveModel', () => {
  it('throws MISSING_API_KEY when env var is unset', () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() =>
      resolveModel({ provider: 'anthropic', model: 'claude-haiku-4-5' }),
    ).toThrow(MemossError);
  });

  it('creates anthropic model when key is present', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const model = resolveModel({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    });

    expect(model).toBeDefined();
    expect(model.modelId).toBe('claude-haiku-4-5');
  });

  it('creates openai model with custom base_url', () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const model = resolveModel({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      base_url: 'https://api.example.com/v1',
    });

    expect(model.modelId).toBe('gpt-4.1-mini');
  });
});

describe('parseModelOverride', () => {
  it('parses provider/model format', () => {
    expect(parseModelOverride('openai/gpt-4.1-mini')).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
    });
  });

  it('includes base_url when provided', () => {
    expect(
      parseModelOverride('openai/deepseek-chat', 'https://api.deepseek.com/v1'),
    ).toEqual({
      provider: 'openai',
      model: 'deepseek-chat',
      base_url: 'https://api.deepseek.com/v1',
    });
  });

  it('rejects invalid format', () => {
    expect(() => parseModelOverride('invalid')).toThrow(MemossError);
  });
});
