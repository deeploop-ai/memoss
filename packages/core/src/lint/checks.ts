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
  provenanceCoverage: ProvenanceCoverage;
}

export interface ProvenanceCoverage {
  total_pages: number;
  with_sources: number;
  with_verified_at: number;
  sources_pct: number;
  verified_at_pct: number;
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
  let withSources = 0;
  let withVerifiedAt = 0;

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

    const sources = fm.sources;
    const hasSources = Array.isArray(sources) && sources.length > 0;
    if (hasSources) {
      withSources += 1;
    }
    if (typeof fm.verified_at === 'string' && fm.verified_at) {
      withVerifiedAt += 1;
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

    if (!hasSources) {
      const hasSubstance = body
        .split('\n')
        .some((line) => line.trim().length >= 80 && !line.trim().startsWith('#'));
      if (hasSubstance) {
        issues.push({
          severity: 'info',
          code: 'MISSING_SOURCES',
          path: page,
          message: 'Substantive content without sources in frontmatter',
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

  const totalPages = contentPages.length;
  const provenanceCoverage: ProvenanceCoverage = {
    total_pages: totalPages,
    with_sources: withSources,
    with_verified_at: withVerifiedAt,
    sources_pct:
      totalPages === 0 ? 100 : Math.round((withSources / totalPages) * 100),
    verified_at_pct:
      totalPages === 0 ? 100 : Math.round((withVerifiedAt / totalPages) * 100),
  };

  return { issues, pageCount: totalPages, provenanceCoverage };
}
