import { FsKnowledgeStore } from '../adapters/fs-store.js';
import type { VaultConfig } from '../config/vault-config.js';
import { loadSourceManifest } from '../provenance/manifest.js';
import { runDataCatalogLint } from './data-catalog-checks.js';
import { runDeterministicLint, type LintCheckResult, type LintIssue } from './checks.js';
import { checkProvenanceStale } from './provenance-stale.js';

export interface VaultLintOptions {
  vaultRoot: string;
  config: VaultConfig;
}

export async function runVaultLintChecks(
  opts: VaultLintOptions,
): Promise<LintCheckResult> {
  const store = new FsKnowledgeStore(opts.vaultRoot);
  const base = await runDeterministicLint(store);
  const issues: LintIssue[] = [...base.issues];

  const manifest = loadSourceManifest(opts.vaultRoot);
  const verifiedAt = new Map<string, string | undefined>();
  for (const page of await store.listPages()) {
    if (page.endsWith('index.md') || page.endsWith('log.md')) {
      continue;
    }
    if (!(await store.exists(page))) {
      continue;
    }
    const doc = await store.readPage(page);
    const value = doc.frontmatter.verified_at;
    verifiedAt.set(page, typeof value === 'string' ? value : undefined);
  }

  issues.push(
    ...checkProvenanceStale(
      manifest,
      verifiedAt,
      opts.config.policies.provenance.stale_check_on_lint,
    ),
  );

  if (opts.config.schema_pack === 'data-catalog') {
    issues.push(...(await runDataCatalogLint(store, await store.listPages())));
  }

  return {
    issues: dedupeIssues(issues),
    pageCount: base.pageCount,
    provenanceCoverage: base.provenanceCoverage,
  };
}

function dedupeIssues(issues: LintIssue[]): LintIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.code}:${issue.path ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
