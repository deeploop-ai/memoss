import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ModelSpec } from '../config/vault-config.js';
import { MemossError } from '../errors.js';

const DEFAULT_KEY_ENV: Record<ModelSpec['provider'], string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
};

export function resolveModel(spec: ModelSpec): LanguageModel {
  const envVar = spec.api_key_env ?? DEFAULT_KEY_ENV[spec.provider];
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new MemossError(
      'MISSING_API_KEY',
      `Set ${envVar} for provider "${spec.provider}"`,
    );
  }

  switch (spec.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(spec.model);
    case 'openai':
      return createOpenAI({
        apiKey,
        baseURL: spec.base_url,
      })(spec.model);
    default: {
      const exhaustive: never = spec.provider;
      throw new MemossError(
        'MISSING_API_KEY',
        `Unsupported provider: ${exhaustive}`,
      );
    }
  }
}

/** Parse `provider/model` override strings (CLI / MCP). */
export function parseModelOverride(
  value: string,
  baseUrl?: string,
): ModelSpec {
  const slash = value.indexOf('/');
  if (slash <= 0 || slash === value.length - 1) {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Invalid model override "${value}". Expected format: provider/model`,
    );
  }

  const provider = value.slice(0, slash);
  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Unsupported provider "${provider}". Use anthropic or openai.`,
    );
  }

  return {
    provider,
    model: value.slice(slash + 1),
    ...(baseUrl ? { base_url: baseUrl } : {}),
  };
}
