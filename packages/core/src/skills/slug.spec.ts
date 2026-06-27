import { describe, expect, it } from 'vitest';
import { sourceToSlug } from './slug.js';

describe('sourceToSlug', () => {
  it('builds slug from URL host and path', () => {
    expect(sourceToSlug('https://example.com/article')).toBe(
      'example-com-article',
    );
  });

  it('distinguishes URLs that differ only by query string', () => {
    expect(sourceToSlug('http://domain/article?id=1')).toBe(
      'domain-article-id-1',
    );
    expect(sourceToSlug('http://domain/article?id=2')).toBe(
      'domain-article-id-2',
    );
    expect(sourceToSlug('http://domain/article?id=1')).not.toBe(
      sourceToSlug('http://domain/article?id=2'),
    );
  });

  it('normalizes query parameter order', () => {
    expect(sourceToSlug('http://domain/article?b=2&a=1')).toBe(
      sourceToSlug('http://domain/article?a=1&b=2'),
    );
  });

  it('uses basename for local file paths', () => {
    expect(sourceToSlug('C:\\docs\\notes.pdf')).toBe('notes');
    expect(sourceToSlug('/tmp/report.pdf')).toBe('report');
  });

  it('hashes very long query strings', () => {
    const longQuery = `http://domain/article?${'x'.repeat(80)}=1`;
    const slug = sourceToSlug(longQuery);
    expect(slug).toMatch(/^domain-article-q-[a-f0-9]{10}$/);
  });
});
