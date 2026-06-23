import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { MemossError } from '../errors.js';
import { FsKnowledgeStore } from './fs-store.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): { dir: string; store: FsKnowledgeStore } {
  const dir = mkdtempSync(join(tmpdir(), 'memoss-vault-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'topics'), { recursive: true });
  return { dir, store: new FsKnowledgeStore(dir) };
}

describe('FsKnowledgeStore', () => {
  it('reads, writes, and deletes OKF pages', async () => {
    const { store } = createVault();
    const doc = {
      frontmatter: {
        type: 'Topic',
        title: 'Alpha',
        description: 'First topic.',
      },
      body: '# Alpha\n',
    };

    await store.writePage('topics/alpha.md', doc);
    expect(await store.readPage('topics/alpha.md')).toEqual(doc);
    await store.deletePage('topics/alpha.md');
    await expect(store.readPage('topics/alpha.md')).rejects.toThrow(MemossError);
  });

  it('lists pages excluding reserved files', async () => {
    const { store } = createVault();
    writeFileSync(join(store.vaultRoot, 'index.md'), '# Index\n', 'utf8');
    writeFileSync(join(store.vaultRoot, 'log.md'), '# Log\n', 'utf8');
    await store.writePage('topics/alpha.md', {
      frontmatter: { type: 'Topic', title: 'Alpha', description: 'A' },
      body: '# Alpha\n',
    });

    const pages = await store.listPages();
    expect(pages).toEqual(['topics/alpha.md']);
  });

  it('rejects path traversal', async () => {
    const { store } = createVault();
    await expect(
      store.readPage('../outside.md'),
    ).rejects.toThrow(/Path traversal|escapes vault root/);
  });

  it('appends log entries by date', async () => {
    const { store } = createVault();
    await store.appendLog('**Creation**: Initialized knowledge base.', '2026-06-20');
    await store.appendLog('**Ingest**: Updated [alpha](topics/alpha.md).', '2026-06-23');

    const log = await store.readLog();
    expect(log).toContain('## 2026-06-23');
    expect(log).toContain('**Ingest**: Updated [alpha](topics/alpha.md).');
    expect(log).toContain('## 2026-06-20');
  });
});
