import { describe, expect, it } from 'vitest';
import {
  extractAgentOutputRejectReason,
  isAllowedExtractAgentOutput,
  isExtractArtifactToRemove,
} from './output-policy.js';

describe('extract output policy', () => {
  it('allows markdown and crawl sidecars', () => {
    expect(isAllowedExtractAgentOutput('sources/extracted/foo.md')).toBe(true);
    expect(
      isAllowedExtractAgentOutput('sources/extracted/site/page.md'),
    ).toBe(true);
    expect(
      isAllowedExtractAgentOutput('sources/extracted/site/page.md.url.txt'),
    ).toBe(true);
  });

  it('rejects scripts and temp files', () => {
    expect(isAllowedExtractAgentOutput('sources/extracted/extract_pdf.py')).toBe(
      false,
    );
    expect(isAllowedExtractAgentOutput('sources/extracted/tmp.txt')).toBe(
      false,
    );
    expect(
      isAllowedExtractAgentOutput('sources/extracted/foo.meta.json'),
    ).toBe(false);
  });

  it('describes rejection reasons for agents', () => {
    expect(extractAgentOutputRejectReason('sources/extracted/run.py')).toContain(
      'Intermediate or script files',
    );
  });

  it('flags artifacts for cleanup', () => {
    expect(isExtractArtifactToRemove('sources/extracted/run.py')).toBe(true);
    expect(isExtractArtifactToRemove('sources/extracted/foo.md')).toBe(false);
    expect(
      isExtractArtifactToRemove('sources/extracted/foo.meta.json'),
    ).toBe(false);
    expect(
      isExtractArtifactToRemove('sources/extracted/page.md.url.txt'),
    ).toBe(false);
  });
});
