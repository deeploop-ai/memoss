import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverVaultPath, isVaultRoot } from './vault-discovery.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('discoverVaultPath', () => {
  it('finds vault by walking up from cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'memoss-discover-'));
    tempDirs.push(root);
    mkdirSync(join(root, '.memoss'), { recursive: true });
    const configPath = join(root, '.memoss', 'config.yaml');
    writeFileSync(configPath, 'name: x\nokf_version: "0.1"\n');

    const nested = join(root, 'topics');
    mkdirSync(nested, { recursive: true });

    expect(isVaultRoot(root)).toBe(true);
    expect(discoverVaultPath({ cwd: nested })).toBe(root);
  });
});
