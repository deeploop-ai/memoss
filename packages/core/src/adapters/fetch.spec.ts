import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUrl } from './fetch.js';
import { parseGitHubUri } from './source-github.js';
import { createSourceAdapter } from './source-registry.js';

describe('fetchUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-http URLs', async () => {
    await expect(fetchUrl('file:///etc/passwd')).rejects.toThrow(/Only http\/https/);
  });

  it('returns markdown for text/markdown responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://example.com/doc.md',
        headers: { get: () => 'text/markdown; charset=utf-8' },
        text: async () => '# Hello\n',
      }),
    );

    const result = await fetchUrl('https://example.com/doc.md');
    expect(result.mime).toBe('text/markdown');
    expect(result.text).toBe('# Hello\n');
  });
});

describe('parseGitHubUri', () => {
  it('parses shorthand and full GitHub URLs', () => {
    expect(parseGitHubUri('deeploop-ai/memoss')).toEqual({
      owner: 'deeploop-ai',
      repo: 'memoss',
      ref: 'main',
    });
    expect(parseGitHubUri('https://github.com/GoogleCloudPlatform/knowledge-catalog')).toEqual({
      owner: 'GoogleCloudPlatform',
      repo: 'knowledge-catalog',
      ref: 'main',
    });
  });
});

describe('createSourceAdapter', () => {
  it('creates adapters by kind', () => {
    const web = createSourceAdapter({
      kind: 'web',
      uri: 'https://example.com',
    });
    expect(web.kind).toBe('web');
  });
});
