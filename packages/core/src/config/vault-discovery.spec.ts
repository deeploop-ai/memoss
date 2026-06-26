import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverVaultPath, findVaultInAncestors, isVaultRoot } from './vault-discovery.js';
import * as userPaths from './user-paths.js';

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeVaultConfig(root: string): void {
  mkdirSync(join(root, '.memoss'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    [
      'name: x',
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
}

describe('discoverVaultPath', () => {
  it('finds vault by walking up from cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'memoss-discover-'));
    tempDirs.push(root);
    writeVaultConfig(root);

    const nested = join(root, 'topics');
    mkdirSync(nested, { recursive: true });

    expect(isVaultRoot(root)).toBe(true);
    expect(findVaultInAncestors(nested)).toBe(root);
    expect(discoverVaultPath({ cwd: nested })).toBe(root);
  });

  it('falls back to the default vault when cwd is outside any vault', () => {
    const defaultVault = mkdtempSync(join(tmpdir(), 'memoss-default-vault-'));
    tempDirs.push(defaultVault);
    writeVaultConfig(defaultVault);

    const unrelated = mkdtempSync(join(tmpdir(), 'memoss-unrelated-'));
    tempDirs.push(unrelated);

    vi.spyOn(userPaths, 'getDefaultVaultPath').mockReturnValue(defaultVault);

    expect(discoverVaultPath({ cwd: unrelated })).toBe(defaultVault);
  });

  it('prefers an ancestor vault over the default vault', () => {
    const defaultVault = mkdtempSync(join(tmpdir(), 'memoss-default-vault-'));
    tempDirs.push(defaultVault);
    writeVaultConfig(defaultVault);

    const projectVault = mkdtempSync(join(tmpdir(), 'memoss-project-vault-'));
    tempDirs.push(projectVault);
    writeVaultConfig(projectVault);

    vi.spyOn(userPaths, 'getDefaultVaultPath').mockReturnValue(defaultVault);

    expect(discoverVaultPath({ cwd: projectVault })).toBe(projectVault);
  });

  it('does not treat the user config directory as a vault root', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'memoss-home-'));
    tempDirs.push(fakeHome);
    const userConfigDir = join(fakeHome, '.memoss');
    mkdirSync(userConfigDir, { recursive: true });
    writeFileSync(join(userConfigDir, 'config.yaml'), 'name: shared\nokf_version: "0.1"\n');

    vi.spyOn(userPaths, 'getUserConfigDir').mockReturnValue(userConfigDir);

    expect(isVaultRoot(fakeHome)).toBe(false);
    expect(findVaultInAncestors(join(fakeHome, 'projects', 'app'))).toBeUndefined();
  });
});
