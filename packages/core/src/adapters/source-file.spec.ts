import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSourceAdapter } from './source-file.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('FileSourceAdapter', () => {
  it('lists and reads markdown files from a directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'memoss-source-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, 'notes.md'), '# Notes\n', 'utf8');
    writeFileSync(join(dir, 'readme.txt'), 'plain text', 'utf8');

    const source = new FileSourceAdapter(dir);
    const items = await source.listItems();
    expect(items.map((item) => item.id).sort()).toEqual(['notes.md', 'readme.txt']);

    const content = await source.readItem('notes.md');
    expect(content.text).toContain('# Notes');
    expect(content.mime).toBe('text/markdown');
  });
});
