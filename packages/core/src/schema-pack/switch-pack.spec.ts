import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadVaultConfig } from '../config/vault-config.js';
import { resolveSchemaPacksRoot } from './resolve-root.js';
import {
  listSchemaPacks,
  runSwitchSchemaPack,
} from './switch-pack.js';

const tempDirs: string[] = [];

function makeTempVault(pack: 'research' | 'personal' = 'research'): string {
  const dir = join(
    tmpdir(),
    `memoss-pack-switch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  tempDirs.push(dir);
  cpSync(join(resolveSchemaPacksRoot(), pack), dir, { recursive: true });
  const configPath = join(dir, '.memoss', 'config.yaml');
  writeFileSync(
    configPath,
    readFileSync(configPath, 'utf8')
      .replace('{{name}}', 'test-vault')
      .replace('{{description}}', 'switch test'),
    'utf8',
  );
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runSwitchSchemaPack', () => {
  it('lists known schema packs', () => {
    expect(listSchemaPacks()).toEqual(['personal', 'research', 'data-catalog']);
  });

  it('switches research vault to personal', async () => {
    const vaultRoot = makeTempVault('research');
    expect(loadVaultConfig(vaultRoot).schema_pack).toBe('research');

    const report = await runSwitchSchemaPack({
      vaultRoot,
      pack: 'personal',
    });

    expect(report.previousPack).toBe('research');
    expect(report.newPack).toBe('personal');
    expect(report.changed).toBe(true);
    expect(report.configUpdated).toBe(true);
    expect(report.instructionsUpdated).toBe(true);
    expect(loadVaultConfig(vaultRoot).schema_pack).toBe('personal');
    expect(readFileSync(join(vaultRoot, '.memoss', 'instructions.md'), 'utf8')).toContain(
      'Personal Vault Instructions',
    );
  });

  it('is a no-op when pack is unchanged', async () => {
    const vaultRoot = makeTempVault('personal');
    const report = await runSwitchSchemaPack({
      vaultRoot,
      pack: 'personal',
    });

    expect(report.changed).toBe(false);
    expect(report.configUpdated).toBe(false);
    expect(report.instructionsUpdated).toBe(false);
  });

  it('preserves existing wiki pages and adds missing scaffold only', async () => {
    const vaultRoot = makeTempVault('personal');
    const topicPath = join(vaultRoot, 'topics', 'existing-topic.md');
    mkdirSync(join(vaultRoot, 'topics'), { recursive: true });
    writeFileSync(topicPath, '# Existing\n\nKeep me.\n', 'utf8');

    const report = await runSwitchSchemaPack({
      vaultRoot,
      pack: 'research',
    });

    expect(existsSync(topicPath)).toBe(true);
    expect(readFileSync(topicPath, 'utf8')).toContain('Keep me.');
    expect(report.scaffoldAdded).toContain('references/index.md');
    expect(existsSync(join(vaultRoot, 'references', 'index.md'))).toBe(true);
  });

  it('dry run does not write files', async () => {
    const vaultRoot = makeTempVault('research');
    const before = readFileSync(join(vaultRoot, '.memoss', 'config.yaml'), 'utf8');

    const report = await runSwitchSchemaPack({
      vaultRoot,
      pack: 'personal',
      dryRun: true,
    });

    expect(report.changed).toBe(true);
    expect(readFileSync(join(vaultRoot, '.memoss', 'config.yaml'), 'utf8')).toBe(before);
    expect(loadVaultConfig(vaultRoot).schema_pack).toBe('research');
  });
});
