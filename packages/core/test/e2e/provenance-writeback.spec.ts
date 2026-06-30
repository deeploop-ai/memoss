import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FsKnowledgeStore } from '../../src/adapters/fs-store.js';
import { loadVaultConfig } from '../../src/config/vault-config.js';
import { createRunnerSetup } from '../../src/engine/runner-setup.js';
import { INGEST_TOOL_NAMES, pickTools } from '../../src/engine/pick-tools.js';
import { sourceManifestId } from '../../src/provenance/hash.js';
import { executeToolCalls } from './mock-model.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore Windows file locks
    }
  }
});

function createVault(): string {
  const root = mkdtempSync(join(tmpdir(), 'memoss-provenance-wb-'));
  tempDirs.push(root);
  mkdirSync(join(root, '.memoss'), { recursive: true });
  mkdirSync(join(root, 'topics'), { recursive: true });
  writeFileSync(
    join(root, '.memoss', 'config.yaml'),
    [
      'name: provenance-wb-vault',
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
    ].join('\n'),
  );
  writeFileSync(join(root, 'index.md'), '# Index\n');
  return root;
}

describe('E2E provenance write-back @e2e', () => {
  it('write_page auto-fills verified_at and sources for all ingest writes', async () => {
    const vaultRoot = createVault();
    const sourceUri = 'https://example.com/article';
    const sourceId = sourceManifestId(sourceUri);

    const setup = createRunnerSetup({ vaultRoot, draftMode: false });
    setup.ctx.ingestSourceId = sourceId;
    setup.ctx.policies.reset();

    const tools = pickTools(setup.tools, INGEST_TOOL_NAMES);
    const pages = [
      {
        path: 'topics/concept-a.md',
        title: 'Concept A',
        description: 'First concept from the ingested article with enough detail.',
      },
      {
        path: 'topics/concept-b.md',
        title: 'Concept B',
        description: 'Second concept from the ingested article with enough detail.',
      },
    ];

    for (const page of pages) {
      await executeToolCalls(tools, [
        { toolName: 'read_page', input: { path: page.path } },
        {
          toolName: 'write_page',
          input: {
            path: page.path,
            frontmatter: {
              type: 'Concept',
              title: page.title,
              description: page.description,
            },
            body: [
              `# ${page.title}`,
              '',
              `${page.description} Additional synthesized content from the source material.`,
              '',
              '# Citations',
              '',
              `- [Article](${sourceUri})`,
            ].join('\n'),
          },
        },
      ]);
    }

    const store = new FsKnowledgeStore(vaultRoot);
    let withVerifiedAt = 0;
    let withSources = 0;

    for (const page of pages) {
      const doc = await store.readPage(page.path);
      if (typeof doc.frontmatter.verified_at === 'string' && doc.frontmatter.verified_at) {
        withVerifiedAt += 1;
      }
      if (Array.isArray(doc.frontmatter.sources) && doc.frontmatter.sources.length > 0) {
        withSources += 1;
      }
    }

    expect(withVerifiedAt).toBe(pages.length);
    expect(withSources / pages.length).toBeGreaterThanOrEqual(0.9);

    const config = loadVaultConfig(vaultRoot);
    const { runVaultLintChecks } = await import('../../src/lint/vault-lint.js');
    const lint = await runVaultLintChecks({ vaultRoot, config });
    expect(lint.provenanceCoverage.verified_at_pct).toBe(100);
    expect(lint.provenanceCoverage.sources_pct).toBeGreaterThanOrEqual(90);
  });
});
