import type { KnowledgeStore } from '../adapters/types.js';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  severity: LintSeverity;
  code: string;
  path?: string;
  message: string;
}

export interface LintCheckResult {
  issues: LintIssue[];
  pageCount: number;
}

const CITATIONS_HEADING = /^#\s+Citations\s*$/m;

function isReservedPage(path: string): boolean {
  const base = path.split('/').pop() ?? path;
  return base === 'index.md' || base === 'log.md';
}

export async function runDeterministicLint(
  store: KnowledgeStore,
): Promise<LintCheckResult> {
  const pages = await store.listPages();
  const contentPages = pages.filter((page) => !isReservedPage(page));
  const issues: LintIssue[] = [];
  const inboundLinks = new Map<string, number>();

  for (const page of contentPages) {
    if (!(await store.exists(page))) {
      continue;
    }
    const doc = await store.readPage(page);
    const body = doc.body;
    const fm = doc.frontmatter;

    if (!fm.title || !fm.description) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_FRONTMATTER',
        path: page,
        message: 'Missing title or description in frontmatter',
      });
    }

    if (!CITATIONS_HEADING.test(body)) {
      const hasSubstance = body
        .split('\n')
        .some((line) => line.trim().length >= 80 && !line.trim().startsWith('#'));
      if (hasSubstance) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_CITATIONS',
          path: page,
          message: 'Substantive content without # Citations section',
        });
      }
    }

    const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(body)) !== null) {
      const target = match[1].replace(/#.*$/, '');
      if (target.endsWith('.md') && !target.startsWith('http')) {
        inboundLinks.set(target, (inboundLinks.get(target) ?? 0) + 1);
      }
    }
  }

  for (const page of contentPages) {
    const count = inboundLinks.get(page) ?? 0;
    if (count === 0) {
      issues.push({
        severity: 'warning',
        code: 'ORPHAN_PAGE',
        path: page,
        message: 'No inbound markdown links from other pages',
      });
    }
  }

  for (const page of contentPages) {
    const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/')) : '';
    let indexContent = '';
    try {
      indexContent = (await store.readIndex(dir || undefined)) ?? '';
    } catch {
      indexContent = '';
    }
    const base = page.split('/').pop() ?? page;
    if (indexContent && !indexContent.includes(base)) {
      issues.push({
        severity: 'info',
        code: 'INDEX_GAP',
        path: page,
        message: `Page not linked from ${dir ? `${dir}/` : ''}index.md`,
      });
    }
  }

  return { issues, pageCount: contentPages.length };
}
