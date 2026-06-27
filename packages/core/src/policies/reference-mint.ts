import type { PoliciesConfig } from './config.js';
import { DEFAULT_REFERENCE_SLUG_BLOCKLIST } from './config.js';
import type { PolicyViolation } from './augment.js';

const META_TITLE_PATTERN =
  /\b(overview|introduction|getting started|quickstart|tutorial|walkthrough|release notes|changelog|roadmap|faq)\b/i;

function slugFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? normalized;
  return base.replace(/\.md$/i, '').toLowerCase();
}

export class ReferenceMintPolicy {
  constructor(private readonly config: PoliciesConfig['reference_mint']) {}

  checkNewReferencePage(
    path: string,
    frontmatter: Record<string, unknown>,
    body: string,
  ): PolicyViolation | undefined {
    if (!this.config.enabled || this.config.gate_mode === 'off') {
      return undefined;
    }

    const normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('references/')) {
      return undefined;
    }

    const slug = slugFromPath(normalized);
    const blocklist = new Set(
      this.config.slug_blocklist.map((entry) => entry.toLowerCase()),
    );

    for (const blocked of DEFAULT_REFERENCE_SLUG_BLOCKLIST) {
      blocklist.add(blocked);
    }

    if (blocklist.has(slug)) {
      return this.violation(
        'REFERENCE_SLUG_BLOCKED',
        `Reference slug "${slug}" matches the meta-page blocklist`,
      );
    }

    for (const part of slug.split(/[-_]/)) {
      if (blocklist.has(part)) {
        return this.violation(
          'REFERENCE_SLUG_BLOCKED',
          `Reference slug "${slug}" contains blocked segment "${part}"`,
        );
      }
    }

    const title = String(frontmatter.title ?? '');
    if (META_TITLE_PATTERN.test(title)) {
      return this.violation(
        'REFERENCE_META_TITLE',
        `Reference title looks like bundle-level meta content: "${title}"`,
      );
    }

    if (body.trim().length < 80) {
      return this.violation(
        'REFERENCE_TOO_THIN',
        'Reference page body is too thin to be a reusable definition',
      );
    }

    return undefined;
  }

  private violation(code: string, message: string): PolicyViolation {
    return {
      code,
      message,
      action: this.config.gate_mode === 'block' ? 'error' : 'warn',
    };
  }
}
