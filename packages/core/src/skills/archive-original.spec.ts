import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isPlainTextExtractSource,
  maybeArchiveOriginal,
  shouldArchiveOriginal,
} from './archive-original.js';
import { hashFileContent } from './source-identity.js';
import { sourceToSlug } from './slug.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeVault(): string {
  const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-archive-'));
  tempDirs.push(vaultRoot);
  mkdirSync(join(vaultRoot, 'sources', 'inbox'), { recursive: true });
  return vaultRoot;
}

describe('shouldArchiveOriginal', () => {
  it('detects markdown URLs by extension', () => {
    const source = 'https://raw.githubusercontent.com/org/repo/main/README.md';
    expect(
      isPlainTextExtractSource(source, 'web'),
    ).toBe(true);
  });

  it('skips plain-text markdown URLs in auto mode', () => {
    expect(
      shouldArchiveOriginal(
        'https://raw.githubusercontent.com/org/repo/main/README.md',
        'web',
        'auto',
        '/vault',
      ),
    ).toBe(false);
  });

  it('archives web URLs in auto mode', () => {
    expect(
      shouldArchiveOriginal(
        'https://example.com/article',
        'web',
        'auto',
        '/vault',
      ),
    ).toBe(true);
  });

  it('never archives when mode is never', () => {
    expect(
      shouldArchiveOriginal(
        'https://example.com/article',
        'web',
        'never',
        '/vault',
      ),
    ).toBe(false);
  });
});

describe('maybeArchiveOriginal', () => {
  it('references in-vault files without copying in auto mode', async () => {
    const vaultRoot = makeVault();
    const inboxPath = join(vaultRoot, 'sources', 'inbox', 'report.pdf');
    writeFileSync(inboxPath, '%PDF-1.4 sample');

    const archive = await maybeArchiveOriginal({
      vaultRoot,
      source: inboxPath,
      extractKind: 'pdf',
      config: { archive_original: 'auto', raw_dir: 'sources/raw' },
    });

    expect(archive).toEqual({
      raw_path: 'sources/inbox/report.pdf',
      raw_content_hash: expect.stringMatching(/^sha256:/),
      copied: false,
    });
    expect(existsSync(join(vaultRoot, 'sources', 'raw', 'report.pdf'))).toBe(false);
  });

  it('copies external binary files into sources/raw', async () => {
    const vaultRoot = makeVault();
    const externalDir = mkdtempSync(join(tmpdir(), 'memoss-external-'));
    tempDirs.push(externalDir);
    const externalPdf = join(externalDir, 'notes.pdf');
    writeFileSync(externalPdf, '%PDF-1.4 external');

    const archive = await maybeArchiveOriginal({
      vaultRoot,
      source: externalPdf,
      extractKind: 'pdf',
      config: { archive_original: 'auto', raw_dir: 'sources/raw' },
    });

    expect(archive?.copied).toBe(true);
    const rawHash = hashFileContent(externalPdf);
    const expectedSlug = sourceToSlug(externalPdf, { contentHash: rawHash });
    expect(archive?.raw_path).toBe(`sources/raw/${expectedSlug}.pdf`);
    const archived = join(vaultRoot, 'sources', 'raw', `${expectedSlug}.pdf`);
    expect(readFileSync(archived, 'utf8')).toBe('%PDF-1.4 external');
  });

  it('uses distinct raw paths for same-named files with different bytes', async () => {
    const vaultRoot = makeVault();
    const externalDir = mkdtempSync(join(tmpdir(), 'memoss-external-'));
    tempDirs.push(externalDir);
    const fileA = join(externalDir, 'llm.pdf');
    const fileB = join(externalDir, 'subdir', 'llm.pdf');
    mkdirSync(join(externalDir, 'subdir'), { recursive: true });
    writeFileSync(fileA, '%PDF-1.4 version-a');
    writeFileSync(fileB, '%PDF-1.4 version-b');

    const archiveA = await maybeArchiveOriginal({
      vaultRoot,
      source: fileA,
      extractKind: 'pdf',
      config: { archive_original: 'auto', raw_dir: 'sources/raw' },
    });
    const archiveB = await maybeArchiveOriginal({
      vaultRoot,
      source: fileB,
      extractKind: 'pdf',
      config: { archive_original: 'auto', raw_dir: 'sources/raw' },
    });

    expect(archiveA?.raw_path).not.toBe(archiveB?.raw_path);
    expect(existsSync(join(vaultRoot, archiveA!.raw_path))).toBe(true);
    expect(existsSync(join(vaultRoot, archiveB!.raw_path))).toBe(true);
  });

  it('skips plain markdown files in auto mode', async () => {
    const vaultRoot = makeVault();
    const mdPath = join(vaultRoot, 'sources', 'inbox', 'note.md');
    writeFileSync(mdPath, '# hello');

    const archive = await maybeArchiveOriginal({
      vaultRoot,
      source: mdPath,
      extractKind: 'markdown',
      config: { archive_original: 'auto', raw_dir: 'sources/raw' },
    });

    expect(archive).toBeNull();
  });
});
