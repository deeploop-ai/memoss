import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { searchKb } from './search-kb.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVaultWithPages(pageCount: number): FsKnowledgeStore {
  const root = mkdtempSync(join(tmpdir(), 'memoss-search-'));
  tempDirs.push(root);
  mkdirSync(join(root, 'topics'), { recursive: true });

  for (let index = 0; index < pageCount; index += 1) {
    writeFileSync(
      join(root, 'topics', `page-${index}.md`),
      [
        '---',
        `title: Page ${index}`,
        `description: Search fixture page ${index}`,
        '---',
        '',
        `# Page ${index}`,
        '',
        `Unique keyword alpha-${index} appears here for search testing.`,
      ].join('\n'),
    );
  }

  return new FsKnowledgeStore(root);
}

describe('searchKb', () => {
  it('respects maxResults limit', async () => {
    const store = createVaultWithPages(60);
    const results = await searchKb(store, 'Unique keyword', { maxResults: 10 });
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('returns empty array for blank query', async () => {
    const store = createVaultWithPages(2);
    await expect(searchKb(store, '   ')).resolves.toEqual([]);
  });
});
