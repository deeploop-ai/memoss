import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverRebuildSources } from './discover-sources.js';
import { saveSourceManifest } from '../provenance/manifest.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-rebuild-'));
  tempDirs.push(vaultRoot);
  mkdirSync(join(vaultRoot, 'sources', 'raw'), { recursive: true });
  mkdirSync(join(vaultRoot, 'sources', 'inbox'), { recursive: true });
  mkdirSync(join(vaultRoot, 'sources', 'extracted'), { recursive: true });
  return vaultRoot;
}

describe('discoverRebuildSources', () => {
  it('reads URIs from manifest', () => {
    const vaultRoot = createVault();
    saveSourceManifest(vaultRoot, {
      sources: [
        {
          id: 'a',
          uri: 'https://example.com/a',
          content_hash: 'sha256:a',
        },
        {
          id: 'b',
          uri: './sources/raw/report.pdf',
          content_hash: 'sha256:b',
        },
      ],
    });

    const sources = discoverRebuildSources(vaultRoot, 'manifest');
    expect(sources.map((item) => item.uri)).toEqual([
      'https://example.com/a',
      './sources/raw/report.pdf',
    ]);
  });

  it('falls back to raw, inbox, and extracted when manifest is empty', () => {
    const vaultRoot = createVault();
    writeFileSync(join(vaultRoot, 'sources/raw/report.pdf'), 'pdf');
    writeFileSync(join(vaultRoot, 'sources/inbox/clip.html'), '<html></html>');
    writeFileSync(
      join(vaultRoot, 'sources/extracted/clip.md'),
      '# Clip\n',
    );
    writeFileSync(
      join(vaultRoot, 'sources/extracted/clip.meta.json'),
      JSON.stringify({ source_uri: 'https://example.com/clip' }),
    );

    const sources = discoverRebuildSources(vaultRoot, 'manifest');
    expect(sources.map((item) => item.uri)).toEqual([
      join(vaultRoot, 'sources/raw/report.pdf').replace(/\\/g, '/'),
      join(vaultRoot, 'sources/inbox/clip.html').replace(/\\/g, '/'),
      'https://example.com/clip',
    ]);
  });

  it('deduplicates repeated URIs', () => {
    const vaultRoot = createVault();
    saveSourceManifest(vaultRoot, {
      sources: [
        {
          id: 'a',
          uri: 'https://example.com/article',
          content_hash: 'sha256:1',
        },
        {
          id: 'b',
          uri: 'https://example.com/article',
          content_hash: 'sha256:2',
        },
      ],
    });

    const sources = discoverRebuildSources(vaultRoot, 'manifest');
    expect(sources).toHaveLength(1);
  });
});
