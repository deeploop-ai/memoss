import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLintReport, writeLintReport } from './report.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildLintReport', () => {
  it('includes provenance_coverage metrics', () => {
    const report = buildLintReport({
      pageCount: 4,
      provenanceCoverage: {
        total_pages: 4,
        with_sources: 3,
        with_verified_at: 4,
        sources_pct: 75,
        verified_at_pct: 100,
      },
      issues: [
        {
          severity: 'info',
          code: 'MISSING_SOURCES',
          path: 'topics/a.md',
          message: 'Substantive content without sources in frontmatter',
        },
      ],
    });

    expect(report.provenance_coverage).toEqual({
      total_pages: 4,
      with_sources: 3,
      with_verified_at: 4,
      sources_pct: 75,
      verified_at_pct: 100,
    });
  });

  it('writes JSON with provenance_coverage to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'memoss-lint-report-'));
    tempDirs.push(dir);
    const path = join(dir, 'lint-report.json');

    writeLintReport(
      path,
      buildLintReport({
        pageCount: 1,
        provenanceCoverage: {
          total_pages: 1,
          with_sources: 1,
          with_verified_at: 1,
          sources_pct: 100,
          verified_at_pct: 100,
        },
        issues: [],
      }),
    );

    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      provenance_coverage: { sources_pct: number };
    };
    expect(parsed.provenance_coverage.sources_pct).toBe(100);
  });
});
