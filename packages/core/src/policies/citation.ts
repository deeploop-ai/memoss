import type { PolicyWarning } from './types.js';

const CITATIONS_HEADING = /^#\s+Citations\s*$/m;

export class CitationPolicy {
  /** Phase 1a: warn when substantive content lacks a Citations section. */
  check(body: string): PolicyWarning | undefined {
    if (CITATIONS_HEADING.test(body)) {
      return undefined;
    }

    const hasSubstantiveClaim = body
      .split('\n')
      .some((line) => {
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          !trimmed.startsWith('#') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('-') &&
          trimmed.length >= 80
        );
      });

    if (!hasSubstantiveClaim) {
      return undefined;
    }

    return {
      code: 'MISSING_CITATIONS',
      message:
        'Substantive factual content should include a `# Citations` section with traceable sources',
    };
  }
}
