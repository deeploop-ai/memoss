import type { PoliciesConfig } from './config.js';
import type { PolicyViolation } from './augment.js';

const CITATIONS_HEADING = /^#\s+Citations\s*$/m;

export class CitationPolicy {
  constructor(private readonly config: PoliciesConfig['citation']) {}

  check(body: string): PolicyViolation | undefined {
    if (this.config.require_section === 'off') {
      return undefined;
    }
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
      action: this.config.require_section,
    };
  }
}
