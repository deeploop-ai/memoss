import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadSourceManifest,
  registerExtractProvenance,
  registerIngestProvenance,
} from './manifest.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('source manifest', () => {
  it('records extract and ingest provenance', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-manifest-'));
    tempDirs.push(vaultRoot);

    registerExtractProvenance(vaultRoot, {
      sourceUri: 'https://example.com/article',
      extractedPath: join(vaultRoot, 'sources/extracted/example-com-article.md'),
      meta: {
        source_uri: 'https://example.com/article',
        extract_kind: 'web',
        extracted_at: '2026-06-26T10:00:00.000Z',
        content_hash: 'sha256:abc',
        fallback: false,
        skill: 'defuddle',
        raw_path: 'sources/raw/example-com-article.html',
        raw_content_hash: 'sha256:raw',
      },
    });

    registerIngestProvenance(vaultRoot, {
      sourceUri: 'https://example.com/article',
      ingested_at: '2026-06-26T10:05:00.000Z',
    });

    const manifest = loadSourceManifest(vaultRoot);
    expect(manifest.sources).toHaveLength(1);
    expect(manifest.sources[0]?.uri).toBe('https://example.com/article');
    expect(manifest.sources[0]?.extractor).toBe('defuddle');
    expect(manifest.sources[0]?.raw_path).toBe(
      'sources/raw/example-com-article.html',
    );
    expect(manifest.sources[0]?.raw_content_hash).toBe('sha256:raw');
    expect(manifest.sources[0]?.ingested_at).toBe('2026-06-26T10:05:00.000Z');

    const yaml = readFileSync(join(vaultRoot, 'sources', 'manifest.yaml'), 'utf8');
    expect(yaml).toContain('content_hash');
  });
});
