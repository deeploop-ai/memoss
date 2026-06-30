import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FsKnowledgeStore } from '../adapters/fs-store.js';
import { SimpleGitAdapter } from '../adapters/simple-git.js';
import { loadVaultConfig } from '../config/vault-config.js';
import { PolicyRunner } from '../policies/runner.js';
import { createWritePageTool } from './page-tools.js';
import type { ToolContext } from './context.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createContext(ingestSourceId?: string): ToolContext {
  const vaultRoot = mkdtempSync(join(tmpdir(), 'memoss-page-tools-'));
  tempDirs.push(vaultRoot);
  mkdirSync(join(vaultRoot, '.memoss'), { recursive: true });
  mkdirSync(join(vaultRoot, 'topics'), { recursive: true });

  const configYaml = [
    'name: page-tools-vault',
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
  ].join('\n');
  writeFileSync(join(vaultRoot, '.memoss', 'config.yaml'), configYaml);

  const config = loadVaultConfig(vaultRoot);
  return {
    store: new FsKnowledgeStore(vaultRoot),
    git: new SimpleGitAdapter(vaultRoot),
    config,
    policies: new PolicyRunner(config),
    draftMode: false,
    ingestSourceId,
  };
}

describe('createWritePageTool', () => {
  it('auto-fills verified_at and ingest source on new pages', async () => {
    const ctx = createContext('example-com-article');
    ctx.policies.augment.markRead('topics/article-summary.md');
    const writePage = createWritePageTool(ctx);

    await writePage.execute!(
      {
        path: 'topics/article-summary.md',
        frontmatter: {
          type: 'Concept',
          title: 'Article Summary',
          description: 'Summary of the ingested article.',
        },
        body: [
          '# Article Summary',
          '',
          'This page captures the key ideas from the ingested article with enough detail to be useful.',
          '',
          '# Citations',
          '',
          '- [Article](https://example.com/article)',
        ].join('\n'),
      },
      { toolCallId: 'test', messages: [] },
    );

    const doc = await ctx.store.readPage('topics/article-summary.md');
    expect(typeof doc.frontmatter.verified_at).toBe('string');
    expect(doc.frontmatter.sources).toEqual([{ source_id: 'example-com-article' }]);
  });

  it('merges sources when updating an existing page', async () => {
    const ctx = createContext('example-com-update');
    const writePage = createWritePageTool(ctx);

    await ctx.store.writePage('topics/existing.md', {
      frontmatter: {
        type: 'Concept',
        title: 'Existing',
        description: 'Existing page.',
        sources: [{ source_id: 'example-com-original', section: 'intro' }],
        verified_at: '2026-06-01T00:00:00.000Z',
      },
      body: '# Existing\n\nOriginal content with enough length to pass validation checks easily.\n\n# Citations\n\n- [Original](https://example.com/original)',
    });
    ctx.policies.augment.markRead('topics/existing.md');

    await writePage.execute!(
      {
        path: 'topics/existing.md',
        frontmatter: {
          type: 'Concept',
          title: 'Existing',
          description: 'Existing page updated.',
        },
        body: '# Existing\n\nUpdated content with enough length to pass validation checks easily.\n\n# Citations\n\n- [Original](https://example.com/original)',
      },
      { toolCallId: 'test', messages: [] },
    );

    const doc = await ctx.store.readPage('topics/existing.md');
    expect(doc.frontmatter.sources).toEqual([
      { source_id: 'example-com-original', section: 'intro' },
      { source_id: 'example-com-update' },
    ]);
    expect(doc.frontmatter.verified_at).toBe('2026-06-01T00:00:00.000Z');
  });
});
