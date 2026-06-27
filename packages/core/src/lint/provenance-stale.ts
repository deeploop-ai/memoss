import type { SourceManifest, SourceManifestEntry } from '../provenance/manifest.js';
import type { LintIssue } from './checks.js';
import type { PolicyAction } from '../policies/config.js';

function parseIso(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

export function checkProvenanceStale(
  manifest: SourceManifest,
  pageVerifiedAt: Map<string, string | undefined>,
  action: PolicyAction,
): LintIssue[] {
  if (action === 'off') {
    return [];
  }

  const severity = action === 'error' ? 'error' : 'warning';
  const issues: LintIssue[] = [];

  for (const source of manifest.sources) {
    const fetchedAt = parseIso(source.fetched_at);
    const ingestedAt = parseIso(source.ingested_at);

    if (fetchedAt && ingestedAt && fetchedAt > ingestedAt) {
      for (const page of source.affects ?? []) {
        issues.push({
          severity,
          code: 'STALE_SOURCE_REINGEST',
          path: page,
          message: `Source "${source.uri}" was re-fetched after last ingest; page may be stale`,
        });
      }
    }

    for (const page of source.affects ?? []) {
      const verifiedAt = parseIso(pageVerifiedAt.get(page));
      if (verifiedAt && ingestedAt && verifiedAt < ingestedAt) {
        issues.push({
          severity,
          code: 'STALE_VERIFIED_AT',
          path: page,
          message: `verified_at is older than source ingest (${source.uri})`,
        });
      }
    }
  }

  return dedupeIssues(issues);
}

function dedupeIssues(issues: LintIssue[]): LintIssue[] {
  const seen = new Set<string>();
  const result: LintIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.path ?? ''}:${issue.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(issue);
  }
  return result;
}

export function indexManifestAffects(
  manifest: SourceManifest,
): Map<string, SourceManifestEntry> {
  const map = new Map<string, SourceManifestEntry>();
  for (const source of manifest.sources) {
    for (const page of source.affects ?? []) {
      map.set(page, source);
    }
  }
  return map;
}
