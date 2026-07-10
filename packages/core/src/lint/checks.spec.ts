import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { runDeterministicLint } from './checks.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): FsKnowledgeStore {
  const root = mkdtempSync(join(tmpdir(), 'memoss-lint-checks-'));
  tempDirs.push(root);
  mkdirSync(join(root, 'topics'), { recursive: true });
  return new FsKnowledgeStore(root);
}

describe('runDeterministicLint', () => {
  it('flags substantive pages missing sources as info', async () => {
    const store = createVault();
    await store.writePage('topics/no-sources.md', {
      frontmatter: {
        type: 'Concept',
        title: 'No Sources',
        description: 'Page without provenance frontmatter.',
      },
      body: [
        '# No Sources',
        '',
        'This page has substantive factual content that should carry provenance metadata in frontmatter.',
        '',
        '# Citations',
        '',
        '- [Example](https://example.com)',
      ].join('\n'),
    });

    const result = await runDeterministicLint(store);
    const issue = result.issues.find(
      (entry) => entry.code === 'MISSING_SOURCES' && entry.path === 'topics/no-sources.md',
    );
    expect(issue?.severity).toBe('info');
    expect(result.provenanceCoverage.with_sources).toBe(0);
  });

  it('counts pages with sources and verified_at', async () => {
    const store = createVault();
    await store.writePage('topics/provenanced.md', {
      frontmatter: {
        type: 'Concept',
        title: 'Provenanced',
        description: 'Page with provenance.',
        sources: [{ source_id: 'example-com-doc' }],
        verified_at: '2026-06-28T00:00:00.000Z',
      },
      body: '# Provenanced\n\nShort.',
    });

    const result = await runDeterministicLint(store);
    expect(result.provenanceCoverage.with_sources).toBe(1);
    expect(result.provenanceCoverage.with_verified_at).toBe(1);
    expect(result.provenanceCoverage.sources_pct).toBe(100);
  });
});
