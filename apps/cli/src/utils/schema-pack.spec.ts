import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { initVaultFromSchemaPack } from './schema-pack.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('initVaultFromSchemaPack', () => {
  it('creates a research vault with token replacement', () => {
    const target = mkdtempSync(join(tmpdir(), 'memoss-init-'));
    tempDirs.push(target);

    initVaultFromSchemaPack(target, 'research', {
      name: 'my-research',
      description: 'Test vault',
    });

    expect(existsSync(join(target, '.memoss', 'config.yaml'))).toBe(true);
    const config = readFileSync(join(target, '.memoss', 'config.yaml'), 'utf8');
    expect(config).toContain('name: my-research');
    expect(config).toContain('description: "Test vault"');
    expect(existsSync(join(target, 'topics', 'index.md'))).toBe(true);
    expect(existsSync(join(target, 'log.md'))).toBe(true);
  });
});
