import type { KnowledgeStore } from '../adapters/types.js';
import type { LintIssue } from './checks.js';

export async function runDataCatalogLint(
  store: KnowledgeStore,
  pages: string[],
): Promise<LintIssue[]> {
  const issues: LintIssue[] = [];

  for (const page of pages) {
    if (!(await store.exists(page))) {
      continue;
    }
    const doc = await store.readPage(page);
    const body = doc.body;
    const normalized = page.replace(/\\/g, '/');

    if (normalized.startsWith('references/metrics/')) {
      if (!/```sql[\s\S]*?```/i.test(body)) {
        issues.push({
          severity: 'error',
          code: 'METRIC_MISSING_SQL',
          path: page,
          message: 'Metric reference must include a fenced ```sql block with the formula',
        });
      }
    }

    if (normalized.startsWith('references/joins/')) {
      if (!/```sql[\s\S]*?\bON\b[\s\S]*?```/i.test(body)) {
        issues.push({
          severity: 'error',
          code: 'JOIN_MISSING_ON',
          path: page,
          message: 'Join reference must include a fenced ```sql block with an ON clause',
        });
      }
    }

    if (normalized.startsWith('data/') && doc.frontmatter.type === 'BigQuery Table') {
      if (!/^#\s+Schema\s*$/m.test(body)) {
        issues.push({
          severity: 'warning',
          code: 'TABLE_MISSING_SCHEMA',
          path: page,
          message: 'BigQuery Table doc should include a # Schema section',
        });
      }
    }

    if (
      normalized.startsWith('data/') &&
      /^#\s+Metrics\s*$/m.test(body) &&
      !/\[[^\]]+\]\(\.\.\/references\/metrics\/[^)]+\.md\)/.test(body)
    ) {
      issues.push({
        severity: 'info',
        code: 'METRICS_SECTION_UNLINKED',
        path: page,
        message: '# Metrics section should link to references/metrics/ pages',
      });
    }
  }

  return issues;
}
