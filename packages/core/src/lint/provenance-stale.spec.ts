import { describe, expect, it } from 'vitest';
import { checkProvenanceStale } from './provenance-stale.js';
import type { SourceManifest } from '../provenance/manifest.js';

describe('checkProvenanceStale', () => {
  it('flags re-fetched source after ingest', () => {
    const manifest: SourceManifest = {
      sources: [
        {
          id: 'example-com-doc',
          uri: 'https://example.com/doc',
          content_hash: 'sha256:abc',
          fetched_at: '2026-06-27T12:00:00.000Z',
          ingested_at: '2026-06-27T10:00:00.000Z',
          affects: ['topics/doc.md'],
        },
      ],
    };
    const verified = new Map<string, string | undefined>();
    const issues = checkProvenanceStale(manifest, verified, 'warn');
    expect(issues.some((i) => i.code === 'STALE_SOURCE_REINGEST')).toBe(true);
  });

  it('returns empty when policy is off', () => {
    const manifest: SourceManifest = { sources: [] };
    expect(checkProvenanceStale(manifest, new Map(), 'off')).toEqual([]);
  });
});
