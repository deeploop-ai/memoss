import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FsKnowledgeStore } from '../../src/adapters/fs-store.js';
import { loadVaultConfig } from '../../src/config/vault-config.js';
import { runVaultLintChecks } from '../../src/lint/vault-lint.js';
import { upsertSourceManifestEntry } from '../../src/provenance/manifest.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-e2e-stale-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  mkdirSync(join(root, 'topics'), { recursive: true });
  mkdirSync(join(root, 'sources'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    [
      'name: stale-vault',
      'okf_version: "0.1"',
      'schema_pack: research',
      'agent:',
      '  default_model:',
      '    provider: anthropic',
      '    model: claude-sonnet-4-6',
      '  lightweight_model:',
      '    provider: anthropic',
      '    model: claude-haiku-4-5',
      'git:',
      '  enabled: false',
      'policies:',
      '  provenance:',
      '    stale_check_on_lint: warn',
    ].join('\n'),
  );
  writeFileSync(join(root, 'index.md'), '# Index\n');
  return root;
}

describe('E2E provenance stale @e2e', () => {
  it('lint flags STALE_VERIFIED_AT after re-ingest with newer manifest timestamp', async () => {
    const vaultRoot = createVault();
    const store = new FsKnowledgeStore(vaultRoot);
    const pagePath = 'topics/stale-doc.md';

    await store.writePage(pagePath, {
      frontmatter: {
        type: 'Concept',
        title: 'Stale Doc',
        description: 'Document affected by provenance stale check.',
        sources: [{ source_id: 'example-com-doc' }],
        verified_at: '2026-06-27T08:00:00.000Z',
      },
      body: '# Stale Doc\n\nContent.\n\n# Citations\n\n- [Doc](https://example.com/doc)',
    });

    upsertSourceManifestEntry(vaultRoot, {
      id: 'example-com-doc',
      uri: 'https://example.com/doc',
      content_hash: 'sha256:abc',
      fetched_at: '2026-06-27T12:00:00.000Z',
      ingested_at: '2026-06-27T12:00:00.000Z',
      affects: [pagePath],
    });

    const config = loadVaultConfig(vaultRoot);
    const lint = await runVaultLintChecks({ vaultRoot, config });
    const staleIssue = lint.issues.find(
      (issue) => issue.code === 'STALE_VERIFIED_AT' && issue.path === pagePath,
    );

    expect(staleIssue).toBeDefined();
    expect(staleIssue?.severity).toBe('warning');
  });
});
