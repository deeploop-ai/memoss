import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { MemossError } from '../errors.js';
import { deepMergeRecord } from './merge.js';
import { getUserConfigPath } from './user-paths.js';

export const modelSpecSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  model: z.string(),
  base_url: z.string().url().optional(),
  api_key_env: z.string().optional(),
});

export type ModelSpec = z.infer<typeof modelSpecSchema>;

export const vaultConfigSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  mode: z.enum(['wiki', 'catalog', 'hybrid']).default('wiki'),
  okf_version: z.literal('0.1'),
  schema_pack: z
    .enum(['personal', 'research', 'data-catalog'])
    .default('research'),
  agent: z.object({
    default_model: modelSpecSchema,
    lightweight_model: modelSpecSchema,
    max_steps: z.number().int().positive().default(50),
    temperature: z.number().min(0).max(2).default(0.3),
  }),
  git: z.object({
    enabled: z.boolean().default(true),
    auto_commit: z.boolean().default(true),
    draft_branch: z.boolean().default(true),
  }),
  search: z.object({
    strategy: z.enum(['auto', 'index', 'grep', 'hybrid']).default('auto'),
    hybrid_threshold_pages: z.number().int().default(200),
  }),
  provenance: z.object({
    enabled: z.boolean().default(false),
    track_source_hash: z.boolean().default(false),
  }),
});

export type VaultConfig = z.infer<typeof vaultConfigSchema>;

/** Shared user-level defaults; all fields optional. */
export const userConfigSchema = vaultConfigSchema.partial();

export type UserConfig = z.infer<typeof userConfigSchema>;

export function parseVaultConfig(data: unknown): VaultConfig {
  return vaultConfigSchema.parse(data);
}

export function parseUserConfig(data: unknown): UserConfig {
  return userConfigSchema.parse(data);
}

export function loadUserConfig(): UserConfig | undefined {
  const configPath = getUserConfigPath();
  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const raw = parseYaml(readFileSync(configPath, 'utf8'));
    return parseUserConfig(raw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown user config error';
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Failed to load user config at ${configPath}: ${message}`,
    );
  }
}

export function loadVaultConfig(vaultRoot: string): VaultConfig {
  const userDefaults = loadUserConfig();
  const configPath = join(vaultRoot, '.memoss', 'config.yaml');

  let vaultRaw: Record<string, unknown> | undefined;
  try {
    vaultRaw = parseYaml(readFileSync(configPath, 'utf8')) as Record<
      string,
      unknown
    >;
  } catch (error) {
    if (userDefaults) {
      return mergeVaultConfigLayers(userDefaults);
    }
    const message =
      error instanceof Error ? error.message : 'Unknown vault config error';
    throw new MemossError(
      'VAULT_NOT_FOUND',
      `Failed to load vault config at ${configPath}: ${message}`,
    );
  }

  return mergeVaultConfigLayers(userDefaults, vaultRaw);
}

function mergeVaultConfigLayers(
  userDefaults?: UserConfig,
  vaultOverrides?: Record<string, unknown>,
): VaultConfig {
  let merged = createDefaultVaultConfig() as Record<string, unknown>;

  if (userDefaults) {
    merged = deepMergeRecord(merged, userDefaults as Record<string, unknown>);
  }
  if (vaultOverrides) {
    merged = deepMergeRecord(merged, vaultOverrides);
  }

  return parseVaultConfig(merged);
}

export function createDefaultVaultConfig(
  overrides: Partial<VaultConfig> = {},
): VaultConfig {
  return vaultConfigSchema.parse({
    name: 'test-vault',
    okf_version: '0.1',
    agent: {
      default_model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      lightweight_model: { provider: 'anthropic', model: 'claude-haiku-4-5' },
    },
    git: { enabled: true, auto_commit: true, draft_branch: true },
    search: { strategy: 'auto', hybrid_threshold_pages: 200 },
    provenance: { enabled: false, track_source_hash: false },
    ...overrides,
  });
}
