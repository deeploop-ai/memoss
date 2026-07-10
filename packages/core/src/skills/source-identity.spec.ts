import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hashFileContent,
  tryHashLocalSource,
} from './source-identity.js';
import { sourceToSlug } from './slug.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('source identity', () => {
  it('hashes local file bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'memoss-identity-'));
    tempDirs.push(dir);
    const fileA = join(dir, 'llm.pdf');
    const fileB = join(dir, 'llm-copy.pdf');
    writeFileSync(fileA, '%PDF-1.4 version-a');
    writeFileSync(fileB, '%PDF-1.4 version-b');

    const hashA = tryHashLocalSource(fileA, dir);
    const hashB = tryHashLocalSource(fileB, dir);

    expect(hashA).toMatch(/^sha256:/);
    expect(hashB).toMatch(/^sha256:/);
    expect(hashA).not.toBe(hashB);
    expect(sourceToSlug(fileA, { contentHash: hashA })).not.toBe(
      sourceToSlug(fileB, { contentHash: hashB }),
    );
  });

  it('returns undefined for HTTP sources', () => {
    expect(tryHashLocalSource('https://example.com/doc.pdf', '/vault')).toBeUndefined();
  });

  it('matches hashFileContent and tryHashLocalSource', () => {
    const dir = mkdtempSync(join(tmpdir(), 'memoss-identity-'));
    tempDirs.push(dir);
    const filePath = join(dir, 'note.txt');
    writeFileSync(filePath, 'hello');

    expect(tryHashLocalSource(filePath, dir)).toBe(hashFileContent(filePath));
  });
});
