import { describe, expect, it } from 'vitest';
import { CitationPolicy } from './citation.js';
import { parsePoliciesConfig } from './config.js';

describe('CitationPolicy', () => {
  const policy = new CitationPolicy(parsePoliciesConfig({}).citation);

  it('passes when Citations section exists', () => {
    const body = '# Summary\n\nShort note.\n\n# Citations\n\n- https://example.com\n';
    expect(policy.check(body)).toBeUndefined();
  });

  it('warns on substantive content without citations', () => {
    const body = `${'This is a long factual claim about the system architecture and data flow. '.repeat(3)}\n`;
    expect(policy.check(body)?.code).toBe('MISSING_CITATIONS');
    expect(policy.check(body)?.action).toBe('warn');
  });
});
