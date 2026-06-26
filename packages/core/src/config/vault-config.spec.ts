import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadVaultConfig } from './vault-config.js';
import * as userPaths from './user-paths.js';

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeYaml(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

describe('loadVaultConfig', () => {
  it('merges user defaults under vault-specific settings', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-vault-config-'));
    tempDirs.push(vaultRoot);

    const userConfigPath = join(vaultRoot, 'user-config.yaml');
    writeYaml(
      userConfigPath,
      [
        'agent:',
        '  default_model:',
        '    provider: openai',
        '    model: gpt-4o',
        '    base_url: https://api.example.com/v1',
        '  lightweight_model:',
        '    provider: openai',
        '    model: gpt-4o-mini',
      ].join('\n'),
    );

    writeYaml(
      join(vaultRoot, '.memoss', 'config.yaml'),
      [
        'name: project-vault',
        'okf_version: "0.1"',
        'agent:',
        '  default_model:',
        '    provider: anthropic',
        '    model: claude-sonnet-4-6',
        '  lightweight_model:',
        '    provider: anthropic',
        '    model: claude-haiku-4-5',
      ].join('\n'),
    );

    vi.spyOn(userPaths, 'getUserConfigPath').mockReturnValue(userConfigPath);

    const config = loadVaultConfig(vaultRoot);
    expect(config.name).toBe('project-vault');
    expect(config.agent.default_model.provider).toBe('anthropic');
    expect(config.agent.default_model.model).toBe('claude-sonnet-4-6');
  });

  it('falls back to user config when vault config is missing', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-vault-config-'));
    tempDirs.push(vaultRoot);

    const userConfigPath = join(vaultRoot, 'user-config.yaml');
    writeYaml(
      userConfigPath,
      [
        'name: shared-defaults',
        'okf_version: "0.1"',
        'agent:',
        '  default_model:',
        '    provider: anthropic',
        '    model: claude-sonnet-4-6',
        '  lightweight_model:',
        '    provider: anthropic',
        '    model: claude-haiku-4-5',
      ].join('\n'),
    );

    vi.spyOn(userPaths, 'getUserConfigPath').mockReturnValue(userConfigPath);

    const config = loadVaultConfig(vaultRoot);
    expect(config.name).toBe('shared-defaults');
  });
});
