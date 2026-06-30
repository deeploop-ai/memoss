import { writeFileSync } from 'node:fs';
import type { LintIssue, ProvenanceCoverage } from './checks.js';
import { computeHealthScore, summarizeLintIssues } from './score.js';
export interface LintReport {
  health_score: number;
  page_count: number;
  summary: ReturnType<typeof summarizeLintIssues>;
  issues: LintIssue[];
  provenance_coverage: ProvenanceCoverage;
  agent_summary?: string;
  generated_at: string;
}

export function buildLintReport(input: {
  issues: LintIssue[];
  pageCount: number;
  provenanceCoverage?: ProvenanceCoverage;
  agentSummary?: string;
}): LintReport {
  const emptyCoverage: ProvenanceCoverage = {
    total_pages: input.pageCount,
    with_sources: 0,
    with_verified_at: 0,
    sources_pct: input.pageCount === 0 ? 100 : 0,
    verified_at_pct: input.pageCount === 0 ? 100 : 0,
  };

  return {
    health_score: computeHealthScore(input.issues, input.pageCount),
    page_count: input.pageCount,
    summary: summarizeLintIssues(input.issues),
    issues: input.issues,
    provenance_coverage: input.provenanceCoverage ?? emptyCoverage,
    agent_summary: input.agentSummary,
    generated_at: new Date().toISOString(),
  };
}

export function writeLintReport(path: string, report: LintReport): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
