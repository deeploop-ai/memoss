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

  it('creates openai chat model when base_url is set', () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const model = resolveModel({
      provider: 'openai',
      model: 'deepseek-v4-flash',
      base_url: 'https://api.deepseek.com/v1',
      api_key_env: 'DEEPSEEK_API_KEY',
    });

    expect(model.modelId).toBe('deepseek-v4-flash');
    expect(model.provider).toBe('openai.chat');
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
