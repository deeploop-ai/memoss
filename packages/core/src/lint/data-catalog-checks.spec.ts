import { describe, expect, it, afterEach } from 'vitest';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDataCatalogLint } from './data-catalog-checks.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runDataCatalogLint', () => {
  it('requires SQL block in metric references', async () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-dc-'));
    tempDirs.push(vaultRoot);
    mkdirSync(join(vaultRoot, 'references/metrics'), { recursive: true });
    const page = 'references/metrics/bad.md';
    writeFileSync(
      join(vaultRoot, page),
      '---\ntype: Metric\n---\n\n# bad\n\nNo sql here.\n',
      'utf8',
    );

    const store = new FsKnowledgeStore(vaultRoot);
    const issues = await runDataCatalogLint(store, [page]);
    expect(issues.some((i) => i.code === 'METRIC_MISSING_SQL')).toBe(true);
  });

  it('passes metric with sql block', async () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-dc-'));
    tempDirs.push(vaultRoot);
    mkdirSync(join(vaultRoot, 'references/metrics'), { recursive: true });
    const page = 'references/metrics/good.md';
    writeFileSync(
      join(vaultRoot, page),
      '---\ntype: Metric\n---\n\n# good\n\n```sql\nSELECT 1\n```\n',
      'utf8',
    );

    const store = new FsKnowledgeStore(vaultRoot);
    const issues = await runDataCatalogLint(store, [page]);
    expect(issues.filter((i) => i.code === 'METRIC_MISSING_SQL')).toHaveLength(0);
  });
});
