import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildExtractCacheKey,
  readExtractCache,
  writeExtractCache,
} from './extract-cache.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('extract cache', () => {
  it('stores and reads cache records', () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-cache-'));
    tempDirs.push(vaultRoot);
    const outputPath = join(vaultRoot, 'sources/extracted/example.md');
    mkdirSync(join(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, '# Example\n', 'utf8');

    const route = { mode: 'fallback' as const, source: 'fallback' as const };
    const cacheKey = buildExtractCacheKey({
      sourceUri: 'https://example.com',
      route,
    });

    writeExtractCache(vaultRoot, {
      cache_key: cacheKey,
      source_uri: 'https://example.com',
      skill_key: 'fallback',
      output_path: outputPath,
      meta_path: join(vaultRoot, 'sources/extracted/example.meta.json'),
      meta: {
        source_uri: 'https://example.com',
        extract_kind: 'web',
        extracted_at: '2026-06-26T10:00:00.000Z',
        content_hash: 'sha256:abc',
        fallback: true,
      },
      cached_at: '2026-06-26T10:00:00.000Z',
    });

    const cached = readExtractCache(vaultRoot, cacheKey);
    expect(cached?.output_path).toBe(outputPath);
  });
});
