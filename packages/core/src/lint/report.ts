import { writeFileSync } from 'node:fs';
import type { LintIssue } from './checks.js';
import { computeHealthScore, summarizeLintIssues } from './score.js';
export interface LintReport {
  health_score: number;
  page_count: number;
  summary: ReturnType<typeof summarizeLintIssues>;
  issues: LintIssue[];
  agent_summary?: string;
  generated_at: string;
}

export function buildLintReport(input: {
  issues: LintIssue[];
  pageCount: number;
  agentSummary?: string;
}): LintReport {
  return {
    health_score: computeHealthScore(input.issues, input.pageCount),
    page_count: input.pageCount,
    summary: summarizeLintIssues(input.issues),
    issues: input.issues,
    agent_summary: input.agentSummary,
    generated_at: new Date().toISOString(),
  };
}

export function writeLintReport(path: string, report: LintReport): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
