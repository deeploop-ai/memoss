import type { LintIssue } from './checks.js';

const WEIGHTS: Record<string, number> = {
  MISSING_CITATIONS: 10,
  MISSING_FRONTMATTER: 3,
  ORPHAN_PAGE: 5,
  INDEX_GAP: 2,
  REFERENCE_SLUG_BLOCKED: 8,
  HEADINGS_NOT_PRESERVED: 15,
  CONTRADICTION: 15,
};

export function computeHealthScore(issues: LintIssue[], pageCount: number): number {
  if (pageCount === 0) {
    return 100;
  }

  let penalty = 0;
  for (const issue of issues) {
    const base = WEIGHTS[issue.code] ?? 2;
    const multiplier =
      issue.severity === 'error' ? 1.5 : issue.severity === 'warning' ? 1 : 0.5;
    penalty += base * multiplier;
  }

  const normalized = Math.min(100, (penalty / Math.max(pageCount, 1)) * 8);
  return Math.max(0, Math.round(100 - normalized));
}

export function summarizeLintIssues(issues: LintIssue[]): {
  errors: number;
  warnings: number;
  info: number;
} {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };
}
