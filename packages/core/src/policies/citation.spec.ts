import { describe, expect, it } from 'vitest';
import { CitationPolicy } from './citation.js';

describe('CitationPolicy', () => {
  const policy = new CitationPolicy();

  it('passes when Citations section exists', () => {
    const body = '# Summary\n\nShort note.\n\n# Citations\n\n- https://example.com\n';
    expect(policy.check(body)).toBeUndefined();
  });

  it('warns on substantive content without citations', () => {
    const body = `${'This is a long factual claim about the system architecture and data flow. '.repeat(3)}\n`;
    expect(policy.check(body)?.code).toBe('MISSING_CITATIONS');
  });
});
